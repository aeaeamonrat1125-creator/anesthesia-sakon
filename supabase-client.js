// =====================================================================
// SUPABASE CLIENT + HELPERS V2
// ต้อง include supabase-js CDN ก่อนไฟล์นี้:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="supabase-config.js"></script>
//   <script src="supabase-client.js"></script>
// =====================================================================
(function () {
  const cfg = window.SUPABASE_CONFIG;
  if (!cfg || !cfg.url || !cfg.anonKey) {
    console.error('Missing SUPABASE_CONFIG');
    return;
  }
  if (!window.supabase) {
    console.error('supabase-js not loaded');
    return;
  }
  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 10 } }
  });
  window.sb = client;

  // ----------------- AUTH HELPERS -----------------
  window.sbAuth = {
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
    async signUp(email, password, fullName) {
      const { data, error } = await client.auth.signUp({
        email, password,
        options: { data: { full_name: fullName || email } }
      });
      if (error) throw error;
      return data;
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    async getUser() {
      const { data } = await client.auth.getUser();
      return data?.user || null;
    },
    async getProfile() {
      const u = await this.getUser();
      if (!u) return null;
      const { data } = await client.from('profiles').select('*').eq('id', u.id).single();
      return data;
    },
    onAuth(cb) {
      return client.auth.onAuthStateChange((event, session) => cb(event, session));
    }
  };

  // ----------------- CRUD HELPERS -----------------
  window.sbDB = {
    async list(table, opts = {}) {
      let q = client.from(table).select(opts.select || '*');
      if (opts.eq) Object.entries(opts.eq).forEach(([k, v]) => (q = q.eq(k, v)));
      if (opts.order) q = q.order(opts.order, { ascending: opts.asc !== false });
      if (opts.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    async one(table, id) {
      const { data, error } = await client.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    async insert(table, row) {
      const { data, error } = await client.from(table).insert(row).select().single();
      if (error) throw error;
      return data;
    },
    async update(table, id, patch) {
      const { data, error } = await client.from(table).update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async upsert(table, row, opts = {}) {
      const { data, error } = await client.from(table).upsert(row, opts).select();
      if (error) throw error;
      return data;
    },
    async remove(table, id) {
      const { error } = await client.from(table).delete().eq('id', id);
      if (error) throw error;
    }
  };

  // ----------------- REALTIME SUBSCRIBE -----------------
  // sbRT.subscribe('kpis', (payload) => { ... })
  // returns channel — call .unsubscribe() to stop
  window.sbRT = {
    channels: {},
    subscribe(table, cb) {
      const chanName = `realtime:${table}:${Math.random().toString(36).slice(2, 7)}`;
      const ch = client
        .channel(chanName)
        .on('postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => cb(payload))
        .subscribe();
      this.channels[chanName] = ch;
      return ch;
    },
    unsubAll() {
      Object.values(this.channels).forEach(c => client.removeChannel(c));
      this.channels = {};
    }
  };

  // ----------------- UTILS -----------------
  window.sbUtils = {
    toast(msg, type = 'info') {
      const div = document.createElement('div');
      div.className = `sb-toast sb-toast-${type}`;
      div.textContent = msg;
      Object.assign(div.style, {
        position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        background: type === 'error' ? '#ef4444' : type === 'success' ? '#16a34a' : '#2563eb',
        color: '#fff', padding: '10px 18px', borderRadius: '8px', zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,.2)', fontSize: '14px'
      });
      document.body.appendChild(div);
      setTimeout(() => div.remove(), 3000);
    },
    fmtDate(d) {
      if (!d) return '';
      const x = new Date(d);
      return x.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    },
    fmtThaiYear(y) {
      // ค่า fiscal_year ใน db เก็บเป็นพ.ศ. แล้ว
      return y;
    },
    fmtNum(n, dec = 2) {
      if (n === null || n === undefined || isNaN(n)) return '-';
      return Number(n).toLocaleString('th-TH', {
        minimumFractionDigits: dec, maximumFractionDigits: dec
      });
    }
  };

  console.log('[sb] ready', cfg.url);
})();
