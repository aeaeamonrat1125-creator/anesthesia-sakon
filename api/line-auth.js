// api/line-auth.js — Vercel Serverless Function
// POST /api/line-auth
// actions: login | link | unlink

const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const LINE_CHANNEL_ID   = process.env.LINE_CHANNEL_ID;
const SUPABASE_URL      = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET        = process.env.SUPABASE_JWT_SECRET;

// ─── helpers ─────────────────────────────────────────────────────────

function sbAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function verifyLineToken(idToken) {
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: LINE_CHANNEL_ID }),
  });
  const data = await res.json();
  if (data.error || !data.sub) {
    throw new Error(data.error_description || 'LINE token ไม่ถูกต้อง');
  }
  return data; // { sub, name, picture, email }
}

function getUserIdFromToken(accessToken) {
  const payload = jwt.verify(accessToken, JWT_SECRET);
  if (!payload?.sub) throw new Error('Invalid session');
  return payload.sub;
}

function mintSupabaseToken(profile) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      sub:  profile.id,
      aud:  'authenticated',
      role: 'authenticated',
      iss:  `${SUPABASE_URL}/auth/v1`,
      email: profile.email || '',
      iat:  now,
      exp:  now + 28800, // 8 ชั่วโมง (1 เวรทำงาน)
      app_metadata:  { provider: 'line', providers: ['line'] },
      user_metadata: { full_name: profile.full_name || '' },
    },
    JWT_SECRET
  );
}

// ─── main handler ────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { action, idToken, accessToken } = req.body || {};

  // unlink ไม่ต้องใช้ LINE token
  if (action === 'unlink') {
    if (!accessToken) return res.status(400).json({ error: 'accessToken required' });
    try {
      const userId = getUserIdFromToken(accessToken);
      const sb = sbAdmin();
      const { error } = await sb.from('profiles').update({ line_user_id: null }).eq('id', userId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, message: 'ยกเลิกการผูก LINE สำเร็จ' });
    } catch (e) { return res.status(401).json({ error: e.message }); }
  }

  if (!idToken) return res.status(400).json({ error: 'idToken required' });

  try {
    const lineUser   = await verifyLineToken(idToken);
    const lineUserId = lineUser.sub;
    const sb         = sbAdmin();

    // ── 1. LOGIN ────────────────────────────────────────────────────
    if (action === 'login') {
      const { data: profile } = await sb
        .from('profiles')
        .select('id, email, full_name, role, status')
        .eq('line_user_id', lineUserId)
        .single();

      if (!profile) {
        // บัญชียังไม่ผูก → ให้ใส่รหัสผ่านครั้งแรก
        return res.status(200).json({ linked: false });
      }

      if (profile.status === 'pending') {
        return res.status(403).json({ error: 'บัญชียังรอการอนุมัติจาก Admin' });
      }

      const token = mintSupabaseToken(profile);
      return res.status(200).json({ linked: true, access_token: token });
    }

    // ── 2. LINK ─────────────────────────────────────────────────────
    if (action === 'link') {
      if (!accessToken) return res.status(400).json({ error: 'accessToken required' });

      let userId;
      try { userId = getUserIdFromToken(accessToken); }
      catch { return res.status(401).json({ error: 'Session ไม่ถูกต้อง' }); }

      // ตรวจว่า line_user_id นี้ผูกกับคนอื่นอยู่หรือเปล่า
      const { data: clash } = await sb
        .from('profiles')
        .select('id')
        .eq('line_user_id', lineUserId)
        .single();

      if (clash && clash.id !== userId) {
        return res.status(409).json({ error: 'LINE account นี้ผูกกับบัญชีอื่นแล้ว' });
      }

      const { error } = await sb
        .from('profiles')
        .update({ line_user_id: lineUserId })
        .eq('id', userId);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, message: 'ผูก LINE สำเร็จ' });
    }

    // ── 3. UNLINK ───────────────────────────────────────────────────
    if (action === 'unlink') {
      if (!accessToken) return res.status(400).json({ error: 'accessToken required' });

      let userId;
      try { userId = getUserIdFromToken(accessToken); }
      catch { return res.status(401).json({ error: 'Session ไม่ถูกต้อง' }); }

      const { error } = await sb
        .from('profiles')
        .update({ line_user_id: null })
        .eq('id', userId);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, message: 'ยกเลิกการผูก LINE สำเร็จ' });
    }

    return res.status(400).json({ error: 'action ไม่ถูกต้อง' });
  } catch (e) {
    console.error('[line-auth]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
