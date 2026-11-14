// MySocial - cloud sync with Supabase
// The whole app data is stored as one JSON row per user in the "app_data" table.
// Row Level Security in the database makes sure you can only ever see your own row.

const Cloud = {
  enabled: false,
  client: null,
  user: null,
  lastSyncedAt: null, // updated_at of the version we last loaded or saved
  saveTimer: null,
  pending: false,
  saving: false,

  init() {
    const hasConfig = typeof SUPABASE_URL === 'string' && SUPABASE_URL && typeof SUPABASE_KEY === 'string' && SUPABASE_KEY;
    if (!hasConfig) return false;
    if (!window.supabase || !window.supabase.createClient) {
      console.error('Supabase library did not load');
      return false;
    }
    this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    this.enabled = true;
    return true;
  },

  async getUser() {
    const { data } = await this.client.auth.getSession();
    this.user = data && data.session ? data.session.user : null;
    return this.user;
  },

  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.user = data.user;
    return data.user;
  },

  async signOut() {
    await this.flush();
    await this.client.auth.signOut();
    this.user = null;
    this.lastSyncedAt = null;
  },

  // Returns { data, updated_at } or null if this user has no saved data yet
  async fetch() {
    const { data, error } = await this.client
      .from('app_data')
      .select('data, updated_at')
      .eq('user_id', this.user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // Save soon (waits a moment so quick edits are sent together)
  queueSave() {
    if (!this.enabled || !this.user) return;
    this.pending = true;
    this.setStatus('saving');
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.push(), 800);
  },

  async push() {
    if (!this.user || this.saving) return;
    this.saving = true;
    this.pending = false;
    const updatedAt = new Date().toISOString();
    const { error } = await this.client
      .from('app_data')
      .upsert({ user_id: this.user.id, data: Store.data, updated_at: updatedAt });
    this.saving = false;
    if (error) {
      console.error('Sync failed', error);
      this.pending = true;
      this.setStatus('error');
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.push(), 15000); // try again later
      return;
    }
    this.lastSyncedAt = updatedAt;
    if (this.pending) this.queueSave(); // more edits came in while saving
    else this.setStatus('saved');
  },

  // Send any waiting changes right now
  async flush() {
    clearTimeout(this.saveTimer);
    if (this.pending) await this.push();
  },

  // When you come back to the tab, pull changes made on another device
  async refreshIfChanged() {
    if (!this.user || this.pending || this.saving) return false;
    try {
      const remote = await this.fetch();
      if (remote && remote.updated_at && (!this.lastSyncedAt || remote.updated_at > this.lastSyncedAt)) {
        Store.setData(remote.data);
        this.lastSyncedAt = remote.updated_at;
        this.setStatus('saved');
        return true;
      }
    } catch (e) {
      this.setStatus('error');
    }
    return false;
  },

  setStatus(status) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    const labels = {
      saving: 'Saving...',
      saved: 'All changes saved',
      error: 'Not synced - will retry',
      local: 'Local mode'
    };
    el.textContent = labels[status] || '';
    el.dataset.status = status;
  }
};
