// MySocial - data layer
// Data lives in Store.data. It is always saved in the browser (localStorage),
// and when you are logged in it is also synced to Supabase (see cloud.js).

const STORE_KEY = 'mysocial-data-v1';

const STAGES = [
  { id: 'to_shoot', label: 'To shoot' },
  { id: 'to_edit', label: 'To edit' },
  { id: 'ready', label: 'Ready' },
  { id: 'posted', label: 'Posted' }
];

const CLIENT_COLORS = ['#185FA5', '#0F6E56', '#993C1D', '#534AB7', '#993556', '#854F0B', '#3B6D11', '#5F5E5A'];

// ---------- Small helpers ----------

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Date helpers (all dates stored as "YYYY-MM-DD" in local time) ----------

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayStr() {
  return toDateStr(new Date());
}

function addDays(str, days) {
  const d = parseDate(str);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

// Monday of the week containing the given date
function startOfWeek(str) {
  const d = parseDate(str);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return toDateStr(d);
}

function prettyDate(str) {
  if (!str) return '';
  return parseDate(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function shortDate(str) {
  if (!str) return '';
  return parseDate(str).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function monthLabel(yyyyMm) {
  const [y, m] = yyyyMm.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

// ---------- Starting data ----------

function seedData() {
  const kerbside = {
    id: uid(),
    name: 'Kerbside Cafe',
    color: '#993C1D',
    reelsPerWeek: 2,
    postsPerWeek: 2,
    shootEveryDays: 7,
    status: 'active',
    categories: [
      'Ambience/Aesthetics', 'Food Spotlight', 'Coffee Spotlight', 'Juices/Cold Drinks',
      'Customer Reviews', 'Owner/Founder Story', 'Trend-Led', 'Behind the Scenes',
      'Food Making Process', "Today's Special/Discounts", 'Community/Local'
    ],
    notes: 'Owner sends raw photos and clips; we edit and post.'
  };
  const nutraahi = {
    id: uid(),
    name: 'Nutraahi',
    color: '#0F6E56',
    reelsPerWeek: 3,
    postsPerWeek: 2,
    shootEveryDays: 14,
    status: 'active',
    categories: [
      'Product Spotlight', 'Recipe', 'Health Tips', 'Founder Story',
      'Customer Review', 'Behind the Scenes', 'Trend-Led', 'Offer/Launch'
    ],
    notes: 'Shoot every two weeks, edit in batches.'
  };
  return {
    version: 1,
    settings: { shootLeadDays: 5 },
    clients: [kerbside, nutraahi],
    items: [],
    ideas: [],
    footage: []
  };
}

// ---------- Store ----------

const Store = {
  data: null,

  // Data saved in this browser (also used as an offline copy in cloud mode)
  readLocal() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  writeLocal() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
      return true;
    } catch (e) {
      console.error('Could not save', e);
      return false;
    }
  },

  clearLocal() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
  },

  // Local mode: load from this browser, or start with the sample clients
  load() {
    this.data = this.normalize(this.readLocal() || seedData());
    this.save();
  },

  // Replace data without sending it to the cloud (used when data comes from the cloud)
  setData(data) {
    this.data = this.normalize(data);
    this.writeLocal();
  },

  normalize(data) {
    data.settings = Object.assign({ shootLeadDays: 5 }, data.settings || {});
    data.clients = Array.isArray(data.clients) ? data.clients : [];
    data.items = Array.isArray(data.items) ? data.items : [];
    data.ideas = Array.isArray(data.ideas) ? data.ideas : [];
    data.footage = Array.isArray(data.footage) ? data.footage : [];
    return data;
  },

  // Every change goes through here: saved in the browser, then synced to the cloud if logged in
  save() {
    const ok = this.writeLocal();
    if (typeof Cloud !== 'undefined' && Cloud.enabled) Cloud.queueSave();
    return ok;
  },

  replaceAll(data) {
    this.data = this.normalize(data);
    this.save();
  },

  reset() {
    this.data = seedData();
    this.save();
  },

  // ----- Clients -----
  client(id) {
    return this.data.clients.find(c => c.id === id);
  },
  activeClients() {
    return this.data.clients.filter(c => c.status === 'active');
  },
  saveClient(client) {
    const i = this.data.clients.findIndex(c => c.id === client.id);
    if (i >= 0) this.data.clients[i] = client;
    else this.data.clients.push(client);
    this.save();
  },
  deleteClient(id) {
    this.data.clients = this.data.clients.filter(c => c.id !== id);
    this.data.items = this.data.items.filter(x => x.clientId !== id);
    this.data.footage = this.data.footage.filter(x => x.clientId !== id);
    this.data.ideas = this.data.ideas.filter(x => x.clientId !== id);
    this.save();
  },

  // ----- Content items (reels and posts) -----
  item(id) {
    return this.data.items.find(x => x.id === id);
  },
  saveItem(item) {
    const i = this.data.items.findIndex(x => x.id === item.id);
    if (i >= 0) this.data.items[i] = item;
    else this.data.items.push(item);
    this.save();
  },
  deleteItem(id) {
    this.data.items = this.data.items.filter(x => x.id !== id);
    this.save();
  },

  // ----- Ideas -----
  saveIdea(idea) {
    const i = this.data.ideas.findIndex(x => x.id === idea.id);
    if (i >= 0) this.data.ideas[i] = idea;
    else this.data.ideas.push(idea);
    this.save();
  },
  deleteIdea(id) {
    this.data.ideas = this.data.ideas.filter(x => x.id !== id);
    this.save();
  },

  // ----- Footage -----
  saveFootage(clip) {
    const i = this.data.footage.findIndex(x => x.id === clip.id);
    if (i >= 0) this.data.footage[i] = clip;
    else this.data.footage.push(clip);
    this.save();
  },
  deleteFootage(id) {
    this.data.footage = this.data.footage.filter(x => x.id !== id);
    this.save();
  },

  allCategories() {
    const set = new Set();
    this.data.clients.forEach(c => (c.categories || []).forEach(cat => set.add(cat)));
    return [...set].sort();
  }
};

// ---------- Calculations ----------

const Calc = {
  // Posted and planned counts for a client in the week starting weekStart (Monday)
  weekProgress(clientId, weekStart) {
    const weekEnd = addDays(weekStart, 6);
    const inWeek = d => d && d >= weekStart && d <= weekEnd;
    const result = { reel: { posted: 0, planned: 0 }, post: { posted: 0, planned: 0 } };
    Store.data.items.forEach(item => {
      if (item.clientId !== clientId || !result[item.type]) return;
      if (item.stage === 'posted' && inWeek(item.postedDate)) result[item.type].posted++;
      else if (item.stage !== 'posted' && inWeek(item.plannedDate)) result[item.type].planned++;
    });
    return result;
  },

  counts(clientId) {
    const items = Store.data.items.filter(x => x.clientId === clientId);
    const by = stage => items.filter(x => x.stage === stage).length;
    return {
      toShoot: by('to_shoot'),
      toEdit: by('to_edit'),
      ready: by('ready'),
      pending: by('to_shoot') + by('to_edit'),
      posted: by('posted'),
      unusedFootage: Store.data.footage.filter(f => f.clientId === clientId && !f.used).length
    };
  },

  // When should the next shoot happen for this client?
  // Stock = reels already shot (to edit) or ready. It runs out at reelsPerWeek.
  shootAlert(client) {
    const perWeek = Number(client.reelsPerWeek) || 0;
    if (perWeek <= 0) return null;
    const today = todayStr();
    const lead = Number(Store.data.settings.shootLeadDays) || 0;
    const stock = Store.data.items.filter(x =>
      x.clientId === client.id && x.type === 'reel' && (x.stage === 'to_edit' || x.stage === 'ready')
    ).length;
    const perShoot = Math.max(1, Math.round(perWeek * (Number(client.shootEveryDays) || 7) / 7));
    const daysCovered = Math.floor((stock / perWeek) * 7);
    const runsOut = addDays(today, daysCovered);
    const shootBy = addDays(runsOut, -lead);

    if (stock === 0) {
      return { level: 'bad', stock, perShoot, text: `No reels in stock. Shoot now - plan about ${perShoot} reels.` };
    }
    if (shootBy <= today) {
      return { level: 'warn', stock, perShoot, text: `${stock} reel${stock === 1 ? '' : 's'} in stock, lasts until ${shortDate(runsOut)}. Shoot now - plan about ${perShoot} reels.` };
    }
    return { level: 'ok', stock, perShoot, text: `${stock} reel${stock === 1 ? '' : 's'} in stock, lasts until ${shortDate(runsOut)}. Next shoot by ${shortDate(shootBy)} (about ${perShoot} reels).` };
  },

  overdue() {
    const today = todayStr();
    return Store.data.items
      .filter(x => x.stage !== 'posted' && x.plannedDate && x.plannedDate < today)
      .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  },

  upcoming(days) {
    const today = todayStr();
    const end = addDays(today, days);
    return Store.data.items
      .filter(x => x.stage !== 'posted' && x.plannedDate && x.plannedDate >= today && x.plannedDate <= end)
      .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  },

  // Posted counts per month for the last n months
  postedByMonth(n) {
    const now = new Date();
    const months = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(toDateStr(d).slice(0, 7));
    }
    return months.map(month => {
      const row = { month, total: 0, byClient: {} };
      Store.data.items.forEach(item => {
        if (item.stage === 'posted' && item.postedDate && item.postedDate.startsWith(month)) {
          row.total++;
          row.byClient[item.clientId] = (row.byClient[item.clientId] || 0) + 1;
        }
      });
      return row;
    });
  }
};
