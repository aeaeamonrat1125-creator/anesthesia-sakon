// api/line-session.js
// POST /api/line-session — ออก Supabase session ให้ผู้ใช้ที่เข้าผ่าน LINE OA
// ไม่ต้องยืนยัน LINE token — UA check ฝั่ง client เพียงพอสำหรับ internal system

const { createClient } = require('@supabase/supabase-js');

// Supabase public config (เหมือน supabase-config.js)
const SUPABASE_URL    = 'https://ldwupcvtthufvksjmcpi.supabase.co';
const SUPABASE_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxkd3VwY3Z0dGh1ZnZrc2ptY3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NzMyNTMsImV4cCI6MjA5NTU0OTI1M30.-fCUylreV5vXDhD7DXOAk-RtoknhUmWbzm2EluKOdFM';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  const email    = process.env.LINE_EMAIL;
  const password = process.env.LINE_PASSWORD;

  if (!email || !password) {
    // ยังไม่ได้ตั้ง env vars → บอก client ให้แสดงกรอบล็อกอินปกติ
    return res.status(503).json({ error: 'not_configured' });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    return res.status(200).json({
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (e) {
    console.error('[line-session]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
