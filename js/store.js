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

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SCRIPT_STAGES = [
  { id: 'raw', label: 'Raw idea' },
  { id: 'writing', label: 'Writing' },
  { id: 'ready', label: 'Script ready' },
  { id: 'shot', label: 'Shot' }
];

const DEFAULT_TEAM = ['Vikas', 'Sruthi', 'Hardik', 'Spandana', 'Aparna', 'Student Leads'];
const DEFAULT_GENRES = ['Nutrition/Food', 'Cafe', 'Education', 'Personal', 'Tech', 'Comedy'];

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
    settings: { shootLeadDays: 5, speakingSpeed: 2.5, postBuffer: 3, team: DEFAULT_TEAM.slice(), brandsAdded: true, templateCleanup: true, generated: {} },
    clients: [kerbside, nutraahi, ...ownBrands()],
    items: [],
    ideas: [],
    footage: [],
    trends: []
  };
}

// Own brands: EduMoon and Vikas Senior, with their weekly posting format.
// Vikas's face-to-camera reels live on Vikas Senior as collabs with EduMoon,
// so each one counts for both accounts without being entered twice.
function ownBrands() {
  const edumoon = {
    id: uid(),
    name: 'EduMoon',
    kind: 'brand',
    color: '#185FA5',
    reelsPerWeek: 7,
    postsPerWeek: 3,
    shootEveryDays: 7,
    status: 'active',
    categories: ['Internship', 'Meme', 'Poll video', 'Event', 'Career', 'Coding', 'Trend-Led'],
    hashtags: '#edumoon #students #college #vizag #careers',
    notes: 'Instagram @edumoon_global. Sruthi owns the weekly format.',
    template: []
  };
  const vikas = {
    id: uid(),
    name: 'Vikas Senior',
    kind: 'brand',
    color: '#534AB7',
    reelsPerWeek: 4,
    postsPerWeek: 0,
    shootEveryDays: 7,
    status: 'active',
    categories: ['Tech', 'Career', 'Internships', 'AI', 'Personal', 'Trend-Led'],
    hashtags: '#vikassenior #students #careers #ai',
    notes: 'Face-to-camera reels, collab with EduMoon.',
    template: []
  };
  const slot = (day, type, label, owner, collabWith) => ({ id: uid(), day, type, label, owner, collabWith: collabWith || '' });
  edumoon.template = [
    slot(1, 'reel', 'Internship reel', 'Sruthi'),
    slot(1, 'post', 'Meme', 'Sruthi'),
    slot(2, 'reel', 'Poll video', 'Student Leads'),
    slot(4, 'reel', 'Internship reel', 'Sruthi'),
    slot(4, 'post', 'Meme', 'Sruthi'),
    slot(6, 'post', 'Event post', 'Sruthi')
  ];
  vikas.template = [0, 3, 5, 6].map(d => slot(d, 'reel', 'Vikas face-to-camera reel', 'Vikas', edumoon.id));
  return [edumoon, vikas];
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
    data.settings = Object.assign({ shootLeadDays: 5, speakingSpeed: 2.5, postBuffer: 3, team: DEFAULT_TEAM.slice(), generated: {} }, data.settings || {});
    if (!Array.isArray(data.settings.team)) data.settings.team = DEFAULT_TEAM.slice();
    if (!data.settings.generated || typeof data.settings.generated !== 'object') data.settings.generated = {};
    data.clients = Array.isArray(data.clients) ? data.clients : [];
    data.items = Array.isArray(data.items) ? data.items : [];
    data.ideas = Array.isArray(data.ideas) ? data.ideas : [];
    data.footage = Array.isArray(data.footage) ? data.footage : [];
    data.trends = Array.isArray(data.trends) ? data.trends : [];

    // Older data: fill in the new fields
    data.clients.forEach(c => {
      if (!c.kind) c.kind = 'client';
      if (!Array.isArray(c.template)) c.template = [];
      if (typeof c.hashtags !== 'string') c.hashtags = '';
    });
    data.items.forEach(i => {
      if (!Array.isArray(i.collabWith)) i.collabWith = [];
      if (typeof i.owner !== 'string') i.owner = '';
      if (typeof i.caption !== 'string') i.caption = '';
      if (typeof i.hashtags !== 'string') i.hashtags = '';
      if (typeof i.script !== 'string') i.script = '';
    });
    data.ideas.forEach(x => {
      if (!x.scriptStage) x.scriptStage = x.used ? 'shot' : 'raw';
      if (typeof x.script !== 'string') x.script = '';
      if (!Array.isArray(x.collabWith)) x.collabWith = [];
      if (typeof x.owner !== 'string') x.owner = '';
    });

    // Add EduMoon and Vikas Senior once (skipped if they already exist by name)
    if (!data.settings.brandsAdded) {
      const has = name => data.clients.some(c => c.name.trim().toLowerCase() === name);
      const [edumoon, vikas] = ownBrands();
      const existingEdu = data.clients.find(c => c.name.trim().toLowerCase() === 'edumoon');
      if (!existingEdu) data.clients.push(edumoon);
      if (!has('vikas senior')) {
        if (existingEdu) vikas.template.forEach(sl => { sl.collabWith = existingEdu.id; });
        data.clients.push(vikas);
      }
      data.settings.brandsAdded = true;
    }
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

  // ----- Trends -----
  saveTrend(t) {
    const i = this.data.trends.findIndex(x => x.id === t.id);
    if (i >= 0) this.data.trends[i] = t;
    else this.data.trends.push(t);
    this.save();
  },
  deleteTrend(id) {
    this.data.trends = this.data.trends.filter(x => x.id !== id);
    this.save();
  },

  // ----- Weekly plan is reference only -----
  // Earlier versions created pieces from the weekly plan automatically.
  // Remove those once, unless you already worked on them.
  cleanupTemplateItems() {
    if (this.data.settings.templateCleanup) return 0;
    const before = this.data.items.length;
    this.data.items = this.data.items.filter(i =>
      !(i.fromTemplate && i.stage !== 'posted' && !i.script && !i.caption && !i.link && !i.notes));
    this.data.items.forEach(i => { if (i.fromTemplate) delete i.fromTemplate; });
    this.data.settings.templateCleanup = true;
    this.data.settings.generated = {};
    this.save();
    return before - this.data.items.length;
  },

  // A name removed from the team is cleared from open pieces, scripts and plans
  removeTeamNames(names) {
    if (!names.length) return;
    this.data.items.forEach(i => { if (i.stage !== 'posted' && names.includes(i.owner)) i.owner = ''; });
    this.data.ideas.forEach(x => { if (x.scriptStage !== 'shot' && names.includes(x.owner)) x.owner = ''; });
    this.data.clients.forEach(c => (c.template || []).forEach(sl => { if (names.includes(sl.owner)) sl.owner = ''; }));
  },

  // ----- Weekly templates (old, no longer called) -----
  // Creates this week's and next week's slots for every account with a template.
  // Only from today onwards, and each slot only once (deleting a slot won't bring it back).
  generateTemplateSlots() {
    const today = todayStr();
    const gen = this.data.settings.generated;
    let added = 0;
    [0, 7].forEach(offset => {
      const weekStart = addDays(startOfWeek(today), offset);
      this.data.clients.forEach(c => {
        if (c.status !== 'active' || !c.template || !c.template.length) return;
        c.template.forEach(slot => {
          const date = addDays(weekStart, Number(slot.day) || 0);
          if (date < today) return;
          const key = `${c.id}|${slot.id}|${date}`;
          if (gen[key]) return;
          gen[key] = today;
          this.data.items.push({
            id: uid(),
            clientId: c.id,
            type: slot.type || 'reel',
            title: slot.label || 'Planned content',
            category: '',
            stage: 'to_shoot',
            plannedDate: date,
            postedDate: '',
            link: '',
            notes: '',
            script: '',
            caption: '',
            hashtags: '',
            owner: slot.owner || '',
            collabWith: slot.collabWith ? [slot.collabWith] : [],
            fromTemplate: true,
            createdAt: new Date().toISOString()
          });
          added++;
        });
      });
    });
    // Forget keys older than 60 days so the list stays small
    const cutoff = addDays(today, -60);
    Object.keys(gen).forEach(k => { if (k.split('|')[2] < cutoff) delete gen[k]; });
    if (added) this.save();
    return added;
  },

  allCategories() {
    const set = new Set();
    this.data.clients.forEach(c => (c.categories || []).forEach(cat => set.add(cat)));
    return [...set].sort();
  }
};

// ---------- Calculations ----------

// Does this content piece count for this account? (its own, or a collab)
function belongsTo(item, clientId) {
  return item.clientId === clientId || (Array.isArray(item.collabWith) && item.collabWith.includes(clientId));
}

// Words, estimated seconds and a length rating for a script
function scriptLength(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  const speed = Number(Store.data && Store.data.settings.speakingSpeed) || 2.5;
  const secs = Math.round(words / speed);
  let level = 'none';
  if (words) level = secs < 30 ? 'short' : secs <= 40 ? 'good' : 'long';
  return { words, secs, level };
}

// Deadline on a script: post a few days before it, shoot the day before that
function deadlineInfo(idea) {
  if (!idea || !idea.deadline || idea.scriptStage === 'shot') return null;
  const buffer = Number(Store.data.settings.postBuffer);
  const postBy = addDays(idea.deadline, -(isNaN(buffer) ? 3 : buffer));
  const shootBy = addDays(postBy, -1);
  const days = Math.round((parseDate(shootBy) - parseDate(todayStr())) / 86400000);
  const level = days <= 1 ? 'red' : days <= 3 ? 'amber' : 'green';
  let when;
  if (days < 0) when = 'Shoot was due ' + shortDate(shootBy);
  else if (days === 0) when = 'Shoot by today';
  else if (days === 1) when = 'Shoot by tomorrow';
  else when = 'Shoot by ' + shortDate(shootBy).split(',')[0] + ' · ' + days + ' days';
  return { postBy, shootBy, days, level, when };
}

const Calc = {
  // Posted and planned counts for a client in the week starting weekStart (Monday)
  weekProgress(clientId, weekStart) {
    const weekEnd = addDays(weekStart, 6);
    const inWeek = d => d && d >= weekStart && d <= weekEnd;
    const result = { reel: { posted: 0, planned: 0 }, post: { posted: 0, planned: 0 } };
    Store.data.items.forEach(item => {
      if (!belongsTo(item, clientId) || !result[item.type]) return;
      if (item.stage === 'posted' && inWeek(item.postedDate)) result[item.type].posted++;
      else if (item.stage !== 'posted' && inWeek(item.plannedDate)) result[item.type].planned++;
    });
    return result;
  },

  counts(clientId) {
    const items = Store.data.items.filter(x => belongsTo(x, clientId));
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
      belongsTo(x, client.id) && x.type === 'reel' && (x.stage === 'to_edit' || x.stage === 'ready')
    ).length;
    const perShoot = Math.max(1, Math.round(perWeek * (Number(client.shootEveryDays) || 7) / 7));
    const daysCovered = Math.floor((stock / perWeek) * 7);
    const runsOut = addDays(today, daysCovered);
    const shootBy = addDays(runsOut, -lead);

    if (stock === 0) {
      return { level: 'bad', stock, perShoot, text: `No reels in stock. Shoot now - plan about ${perShoot} ${perShoot === 1 ? 'reel' : 'reels'}.` };
    }
    if (shootBy <= today) {
      return { level: 'warn', stock, perShoot, text: `${stock} reel${stock === 1 ? '' : 's'} in stock, lasts until ${shortDate(runsOut)}. Shoot now - plan about ${perShoot} ${perShoot === 1 ? 'reel' : 'reels'}.` };
    }
    return { level: 'ok', stock, perShoot, text: `${stock} reel${stock === 1 ? '' : 's'} in stock, lasts until ${shortDate(runsOut)}. Next shoot by ${shortDate(shootBy)} (about ${perShoot} ${perShoot === 1 ? 'reel' : 'reels'}).` };
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
          [item.clientId, ...(item.collabWith || [])].forEach(id => { row.byClient[id] = (row.byClient[id] || 0) + 1; });
        }
      });
      return row;
    });
  }
};
