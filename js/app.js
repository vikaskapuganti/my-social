// MySocial - user interface
// Each page is a render function that returns HTML. Clicks are handled with
// event delegation using data-action attributes.

const state = {
  view: 'dashboard',
  calMonth: todayStr().slice(0, 7), // "YYYY-MM"
  calClient: '',
  pipeClient: '',
  ideaFilter: 'open',
  ideaClient: '',
  footClient: '',
  footCategory: '',
  footShowUsed: false,
  histClient: '',
  histType: '',
  histMonth: '',
  readyClient: '',
  readyLastClient: ''
};

const viewEl = document.getElementById('view');
const modalRoot = document.getElementById('modal-root');

// ---------- Small UI helpers ----------

function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
}

function clientColor(clientId) {
  const c = Store.client(clientId);
  return c ? c.color : '#888888';
}

function clientName(clientId) {
  const c = Store.client(clientId);
  return c ? c.name : 'No client';
}

function typeBadge(type) {
  return `<span class="badge ${type}">${type === 'reel' ? 'Reel' : 'Post'}</span>`;
}

function stageLabel(stageId) {
  const s = STAGES.find(x => x.id === stageId);
  return s ? s.label : stageId;
}

function clientOptions(selectedId, includeBlank, blankLabel) {
  let html = includeBlank ? `<option value="">${escapeHtml(blankLabel || 'All clients')}</option>` : '';
  Store.data.clients.forEach(c => {
    html += `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${escapeHtml(c.name)}${c.status === 'paused' ? ' (paused)' : ''}</option>`;
  });
  return html;
}

function categoryOptions(clientId, selected) {
  const client = Store.client(clientId);
  const cats = client ? client.categories || [] : Store.allCategories();
  let html = '<option value="">No category</option>';
  cats.forEach(cat => {
    html += `<option ${cat === selected ? 'selected' : ''}>${escapeHtml(cat)}</option>`;
  });
  if (selected && !cats.includes(selected)) {
    html += `<option selected>${escapeHtml(selected)}</option>`;
  }
  return html;
}

function categoryDatalist() {
  return `<datalist id="all-categories">${Store.allCategories().map(c => `<option value="${escapeHtml(c)}">`).join('')}</datalist>`;
}

function itemRow(item, extraMeta) {
  const today = todayStr();
  const overdue = item.stage !== 'posted' && item.plannedDate && item.plannedDate < today;
  const dateText = item.stage === 'posted'
    ? `Posted ${prettyDate(item.postedDate)}`
    : (item.plannedDate ? `Planned ${shortDate(item.plannedDate)}` : 'No date yet');
  return `
    <div class="list-item clickable" style="--client:${clientColor(item.clientId)}" data-action="edit-item" data-id="${item.id}">
      <div class="main">
        <div class="title">${escapeHtml(item.title || 'Untitled')}</div>
        <div class="meta">
          ${typeBadge(item.type)}
          <span>${escapeHtml(clientName(item.clientId))}</span>
          ${item.category ? `<span>${escapeHtml(item.category)}</span>` : ''}
          <span>${dateText}</span>
          ${overdue ? '<span class="badge overdue">Overdue</span>' : ''}
          ${extraMeta || ''}
        </div>
      </div>
      <span class="badge">${stageLabel(item.stage)}</span>
    </div>`;
}

// ---------- Modal ----------

function openModal(title, bodyHtml, onMount) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="close-modal-backdrop">
      <div class="modal" role="dialog" aria-label="${escapeHtml(title)}">
        <div class="modal-head">
          <h2 style="margin:0">${escapeHtml(title)}</h2>
          <button class="close" data-action="close-modal" aria-label="Close">&times;</button>
        </div>
        ${bodyHtml}
      </div>
    </div>`;
  if (onMount) onMount(modalRoot.querySelector('.modal'));
}

function closeModal() {
  modalRoot.innerHTML = '';
}

// ---------- Content item form (used everywhere) ----------

function openItemForm(item) {
  const isNew = !item.id;
  const data = Object.assign({
    clientId: (Store.activeClients()[0] || Store.data.clients[0] || {}).id || '',
    type: 'reel',
    category: '',
    title: '',
    notes: '',
    stage: 'to_shoot',
    plannedDate: '',
    postedDate: '',
    link: ''
  }, item);

  if (!Store.data.clients.length) {
    toast('Add a client first');
    switchView('clients');
    return;
  }

  const html = `
    <form id="item-form">
      <div class="grid-2">
        <div class="field">
          <label>Client</label>
          <select name="clientId" required>${clientOptions(data.clientId, false)}</select>
        </div>
        <div class="field">
          <label>Type</label>
          <select name="type">
            <option value="reel" ${data.type === 'reel' ? 'selected' : ''}>Reel</option>
            <option value="post" ${data.type === 'post' ? 'selected' : ''}>Post</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label>Title / idea</label>
        <input name="title" value="${escapeHtml(data.title)}" placeholder="e.g. Ragi laddu making process" required>
      </div>
      <div class="grid-2">
        <div class="field">
          <label>Category</label>
          <select name="category">${categoryOptions(data.clientId, data.category)}</select>
        </div>
        <div class="field">
          <label>Stage</label>
          <select name="stage">
            ${STAGES.map(s => `<option value="${s.id}" ${s.id === data.stage ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid-2">
        <div class="field">
          <label>Planned posting date</label>
          <input type="date" name="plannedDate" value="${data.plannedDate}">
        </div>
        <div class="field posted-only">
          <label>Posted on</label>
          <input type="date" name="postedDate" value="${data.postedDate}">
        </div>
      </div>
      <div class="field posted-only">
        <label>Instagram link</label>
        <input name="link" value="${escapeHtml(data.link)}" placeholder="https://www.instagram.com/reel/...">
      </div>
      <div class="field">
        <label>Notes (script, caption, hook, music)</label>
        <textarea name="notes">${escapeHtml(data.notes)}</textarea>
      </div>
      <div class="modal-foot">
        <div>${isNew ? '' : '<button type="button" class="btn danger" data-action="delete-item">Delete</button>'}</div>
        <div class="btn-row">
          <button type="button" class="btn" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn primary">${isNew ? 'Add' : 'Save'}</button>
        </div>
      </div>
    </form>`;

  openModal(isNew ? 'New content' : 'Edit content', html, modal => {
    const form = modal.querySelector('#item-form');
    const stageSel = form.elements.stage;
    const togglePosted = () => {
      const posted = stageSel.value === 'posted';
      form.querySelectorAll('.posted-only').forEach(el => { el.style.display = posted ? '' : 'none'; });
      if (posted && !form.elements.postedDate.value) {
        form.elements.postedDate.value = form.elements.plannedDate.value && form.elements.plannedDate.value <= todayStr()
          ? form.elements.plannedDate.value
          : todayStr();
      }
    };
    togglePosted();
    stageSel.addEventListener('change', togglePosted);

    form.elements.clientId.addEventListener('change', () => {
      form.elements.category.innerHTML = categoryOptions(form.elements.clientId.value, '');
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = form.elements;
      const saved = Object.assign({}, data, {
        id: data.id || uid(),
        clientId: f.clientId.value,
        type: f.type.value,
        title: f.title.value.trim(),
        category: f.category.value,
        stage: f.stage.value,
        plannedDate: f.plannedDate.value,
        postedDate: f.stage.value === 'posted' ? f.postedDate.value : '',
        link: f.link.value.trim(),
        notes: f.notes.value.trim(),
        createdAt: data.createdAt || new Date().toISOString()
      });
      if (saved.stage === 'posted' && !saved.postedDate) {
        toast('Add the date it was posted');
        return;
      }
      Store.saveItem(saved);
      closeModal();
      toast(isNew ? 'Content added' : 'Saved');
      render();
    });

    const del = modal.querySelector('[data-action="delete-item"]');
    if (del) {
      del.addEventListener('click', () => {
        if (confirm('Delete this content piece?')) {
          Store.deleteItem(data.id);
          closeModal();
          toast('Deleted');
          render();
        }
      });
    }
  });
}

// ---------- Pages ----------

function renderDashboard() {
  const today = todayStr();
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const active = Store.activeClients();
  const paused = Store.data.clients.filter(c => c.status === 'paused');

  const progressLine = (label, p, target) => {
    const t = Number(target) || 0;
    const done = Math.min(p.posted, t);
    const planned = Math.min(p.planned, Math.max(t - done, 0));
    const pct = n => t ? (n / t) * 100 : 0;
    return `
      <div class="progress-line">
        <div class="top"><span>${label}</span><span><strong>${p.posted}/${t}</strong> posted${p.planned ? `, ${p.planned} planned` : ''}</span></div>
        <div class="bar"><div class="done" style="width:${pct(done)}%"></div><div class="planned" style="width:${pct(planned)}%"></div></div>
      </div>`;
  };

  const cards = active.map(c => {
    const prog = Calc.weekProgress(c.id, weekStart);
    const n = Calc.counts(c.id);
    const alert = Calc.shootAlert(c);
    return `
      <div class="card client-card" style="--client:${c.color}">
        <div class="head">
          <h3 style="margin:0"><a href="#client/${c.id}" class="client-link">${escapeHtml(c.name)}</a></h3>
          <span class="hint">${c.reelsPerWeek} reels + ${c.postsPerWeek} posts / week</span>
        </div>
        ${progressLine('Reels this week', prog.reel, c.reelsPerWeek)}
        ${progressLine('Posts this week', prog.post, c.postsPerWeek)}
        <div class="stat-row">
          <div class="stat"><div class="num">${n.toShoot}</div><div class="lbl">To shoot</div></div>
          <div class="stat"><div class="num">${n.toEdit}</div><div class="lbl">To edit</div></div>
          <div class="stat"><div class="num">${n.ready}</div><div class="lbl">Ready</div></div>
          <div class="stat"><div class="num">${n.unusedFootage}</div><div class="lbl">Unused clips</div></div>
        </div>
        ${alert ? `<div class="alert ${alert.level}">${escapeHtml(alert.text)}</div>` : ''}
      </div>`;
  }).join('');

  const overdue = Calc.overdue();
  const upcoming = Calc.upcoming(7);
  const months = Calc.postedByMonth(3);

  // Edited pieces waiting to go live, in one place
  const ready = Store.data.items
    .filter(x => x.stage === 'ready' && (!state.readyClient || x.clientId === state.readyClient))
    .sort((a, b) => (a.plannedDate || '9999').localeCompare(b.plannedDate || '9999'));
  const readyRows = ready.map(item => {
    const late = item.plannedDate && item.plannedDate < today;
    return `
      <div class="list-item" style="--client:${clientColor(item.clientId)}">
        <div class="main clickable" data-action="edit-item" data-id="${item.id}" style="cursor:pointer">
          <div class="title">${escapeHtml(item.title || 'Untitled')}</div>
          <div class="meta">
            ${typeBadge(item.type)}
            <span>${escapeHtml(clientName(item.clientId))}</span>
            ${item.category ? `<span>${escapeHtml(item.category)}</span>` : ''}
            <span>${item.plannedDate ? 'Post on ' + shortDate(item.plannedDate) : 'No posting date yet'}</span>
            ${late ? '<span class="badge overdue">Overdue</span>' : ''}
          </div>
        </div>
        <button class="btn small primary" data-action="mark-posted" data-id="${item.id}">Mark posted</button>
      </div>`;
  }).join('');
  const readyClients = Store.activeClients();

  return `
    <div class="page-head">
      <div>
        <h1>Dashboard</h1>
        <p class="sub">This week: ${shortDate(weekStart)} to ${shortDate(weekEnd)}</p>
      </div>
      <button class="btn primary" data-action="new-item">Add content</button>
    </div>

    ${active.length ? `<div class="cards">${cards}</div>` : '<div class="empty" style="margin-bottom:24px">No active clients. Add one on the Clients page.</div>'}
    ${paused.length ? `<p class="hint" style="margin:-12px 0 24px">Paused: ${paused.map(c => escapeHtml(c.name)).join(', ')}</p>` : ''}

    <div class="card ready-box">
      <div class="ready-head">
        <h2 style="margin:0">Edited, ready to post <span class="badge">${ready.length}</span></h2>
        <select data-change="readyClient" style="width:auto">${clientOptions(state.readyClient, true)}</select>
      </div>
      <form id="ready-form" class="ready-form">
        <select name="clientId" required>${clientOptions(state.readyClient || state.readyLastClient || (readyClients[0] || {}).id, false)}</select>
        <select name="type"><option value="reel">Reel</option><option value="post">Post</option></select>
        <input name="title" placeholder="What did you edit? e.g. Ragi laddu recipe reel" required>
        <input type="date" name="plannedDate" title="When to post">
        <button class="btn primary" type="submit">Add</button>
      </form>
      <div class="list">${readyRows || '<div class="empty">Nothing edited and waiting. Add a piece above when you finish editing.</div>'}</div>
    </div>

    <div class="two-col">
      <div>
        <h2>Overdue ${overdue.length ? `<span class="badge overdue">${overdue.length}</span>` : ''}</h2>
        <div class="list">${overdue.length ? overdue.map(i => itemRow(i)).join('') : '<div class="empty">Nothing overdue. Nice.</div>'}</div>
        <h2 style="margin-top:24px">Next 7 days</h2>
        <div class="list">${upcoming.length ? upcoming.map(i => itemRow(i)).join('') : '<div class="empty">Nothing planned for the next 7 days.</div>'}</div>
      </div>
      <div>
        <h2>Posted per month</h2>
        <table>
          <thead><tr><th>Month</th>${Store.data.clients.map(c => `<th>${escapeHtml(c.name)}</th>`).join('')}<th>Total</th></tr></thead>
          <tbody>
            ${months.map(m => `<tr><td>${monthLabel(m.month)}</td>${Store.data.clients.map(c => `<td>${m.byClient[c.id] || 0}</td>`).join('')}<td><strong>${m.total}</strong></td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderCalendar() {
  const [y, m] = state.calMonth.split('-').map(Number);
  const first = toDateStr(new Date(y, m - 1, 1));
  const gridStart = startOfWeek(first);
  const today = todayStr();

  const items = Store.data.items.filter(x => !state.calClient || x.clientId === state.calClient);
  const byDate = {};
  items.forEach(item => {
    const d = item.stage === 'posted' ? item.postedDate : item.plannedDate;
    if (!d) return;
    (byDate[d] = byDate[d] || []).push(item);
  });

  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    if (i === 35 && d.slice(0, 7) !== state.calMonth) break; // skip a 6th row that is all next month
    const inMonth = d.slice(0, 7) === state.calMonth;
    const chips = (byDate[d] || []).map(item => {
      const overdue = item.stage !== 'posted' && d < today;
      return `<div class="chip ${item.stage === 'posted' ? 'posted' : ''} ${overdue ? 'overdue' : ''}" style="--client:${clientColor(item.clientId)}" data-action="edit-item" data-id="${item.id}" title="${escapeHtml(clientName(item.clientId) + ': ' + item.title)}">
        <span class="t">${item.type === 'reel' ? 'R' : 'P'}</span><span class="label">${escapeHtml(item.title)}</span>
      </div>`;
    }).join('');
    cells += `<div class="day ${inMonth ? '' : 'other'} ${d === today ? 'today' : ''}" data-action="new-item-on" data-date="${d}">
      <div class="num">${parseDate(d).getDate()}</div>${chips}
    </div>`;
  }

  return `
    <div class="page-head">
      <div>
        <h1>Content calendar</h1>
        <p class="sub">Click a day to plan content on that date.</p>
      </div>
      <div class="btn-row">
        <select data-change="calClient" style="width:auto">${clientOptions(state.calClient, true)}</select>
        <div class="cal-head">
          <button class="btn small" data-action="cal-prev" aria-label="Previous month">&lt;</button>
          <div class="month">${monthLabel(state.calMonth)}</div>
          <button class="btn small" data-action="cal-next" aria-label="Next month">&gt;</button>
          <button class="btn small" data-action="cal-today">Today</button>
        </div>
      </div>
    </div>
    <div class="cal">
      ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="dow">${d}</div>`).join('')}
      ${cells}
    </div>
    <div class="legend">
      ${Store.data.clients.map(c => `<span><i class="dot" style="--client:${c.color}"></i>${escapeHtml(c.name)}</span>`).join('')}
      <span><strong>R</strong> reel, <strong>P</strong> post</span>
      <span style="text-decoration:line-through">Posted</span>
      <span style="color:var(--danger)">Red = overdue</span>
    </div>`;
}

function renderPipeline() {
  const items = Store.data.items.filter(x => !state.pipeClient || x.clientId === state.pipeClient);
  const columns = STAGES.map(stage => {
    let list = items.filter(x => x.stage === stage.id);
    if (stage.id === 'posted') {
      list = list.sort((a, b) => (b.postedDate || '').localeCompare(a.postedDate || '')).slice(0, 15);
    } else {
      list = list.sort((a, b) => (a.plannedDate || '9999').localeCompare(b.plannedDate || '9999'));
    }
    const total = items.filter(x => x.stage === stage.id).length;
    const cards = list.map(item => `
      <div class="kcard" draggable="true" data-drag-id="${item.id}" style="--client:${clientColor(item.clientId)}">
        <div class="title" data-action="edit-item" data-id="${item.id}">${escapeHtml(item.title || 'Untitled')}</div>
        <div class="meta">
          ${typeBadge(item.type)}
          <span>${escapeHtml(clientName(item.clientId))}</span>
          ${item.category ? `<span>${escapeHtml(item.category)}</span>` : ''}
        </div>
        <div class="meta" style="margin-top:4px">
          ${item.stage === 'posted' ? `Posted ${shortDate(item.postedDate)}` : (item.plannedDate ? `Planned ${shortDate(item.plannedDate)}` : 'No date')}
          ${item.stage !== 'posted' && item.plannedDate && item.plannedDate < todayStr() ? '<span class="badge overdue">Overdue</span>' : ''}
        </div>
        <select data-move-id="${item.id}" aria-label="Move to stage">
          ${STAGES.map(s => `<option value="${s.id}" ${s.id === item.stage ? 'selected' : ''}>Move to: ${s.label}</option>`).join('')}
        </select>
      </div>`).join('');
    return `
      <div class="column" data-drop-stage="${stage.id}">
        <div class="col-head"><span>${stage.label}</span><span class="badge">${total}</span></div>
        ${cards || '<div class="hint">Nothing here</div>'}
        ${stage.id === 'posted' && total > 15 ? '<div class="hint">Showing latest 15. See History for all.</div>' : ''}
      </div>`;
  }).join('');

  return `
    <div class="page-head">
      <div>
        <h1>Pipeline</h1>
        <p class="sub">Drag cards between columns, or use the "Move to" menu on your phone.</p>
      </div>
      <div class="btn-row">
        <select data-change="pipeClient" style="width:auto">${clientOptions(state.pipeClient, true)}</select>
        <button class="btn primary" data-action="new-item">Add content</button>
      </div>
    </div>
    <div class="board">${columns}</div>`;
}

function renderIdeas() {
  let ideas = Store.data.ideas.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (state.ideaClient) ideas = ideas.filter(x => x.clientId === state.ideaClient || !x.clientId);
  if (state.ideaFilter === 'open') ideas = ideas.filter(x => !x.used);
  if (state.ideaFilter === 'trending') ideas = ideas.filter(x => x.trending && !x.used);
  if (state.ideaFilter === 'used') ideas = ideas.filter(x => x.used);

  const rows = ideas.map(idea => `
    <div class="list-item ${idea.used ? 'faded' : ''}" style="--client:${idea.clientId ? clientColor(idea.clientId) : 'var(--border)'}">
      <div class="main">
        <div class="title">${escapeHtml(idea.title)}</div>
        <div class="meta">
          ${idea.trending ? '<span class="badge trend">Trending</span>' : ''}
          ${typeBadge(idea.type || 'reel')}
          <span>${idea.clientId ? escapeHtml(clientName(idea.clientId)) : 'Any client'}</span>
          ${idea.category ? `<span>${escapeHtml(idea.category)}</span>` : ''}
          ${idea.link ? `<a href="${escapeHtml(idea.link)}" target="_blank" rel="noopener">Reference</a>` : ''}
          ${idea.used ? '<span>Used</span>' : ''}
        </div>
        ${idea.notes ? `<div class="hint" style="margin-top:4px">${escapeHtml(idea.notes)}</div>` : ''}
      </div>
      <div class="btn-row">
        ${idea.used ? '' : `<button class="btn small primary" data-action="idea-to-content" data-id="${idea.id}">Make content</button>`}
        <button class="btn small danger" data-action="delete-idea" data-id="${idea.id}">Delete</button>
      </div>
    </div>`).join('');

  return `
    <div class="page-head">
      <div>
        <h1>Idea bank</h1>
        <p class="sub">What to shoot next, including trends you spot. Turn an idea into a content piece when you're ready.</p>
      </div>
    </div>
    ${categoryDatalist()}
    <form id="idea-form" class="card" style="margin-bottom:20px">
      <div class="grid-3">
        <div class="field" style="grid-column: span 2">
          <label>Idea</label>
          <input name="title" placeholder="e.g. 'Day in the life' trend with founder" required>
        </div>
        <div class="field">
          <label>Client</label>
          <select name="clientId">${clientOptions(state.ideaClient, true, 'Any client')}</select>
        </div>
      </div>
      <div class="grid-3">
        <div class="field">
          <label>Type</label>
          <select name="type"><option value="reel">Reel</option><option value="post">Post</option></select>
        </div>
        <div class="field">
          <label>Category</label>
          <input name="category" list="all-categories" placeholder="Optional">
        </div>
        <div class="field">
          <label>Reference link</label>
          <input name="link" placeholder="Trend audio or example reel">
        </div>
      </div>
      <div class="field">
        <label>Notes</label>
        <input name="notes" placeholder="Hook, audio, shots needed">
      </div>
      <div class="btn-row" style="justify-content:space-between;align-items:center">
        <label class="check"><input type="checkbox" name="trending"> Trending</label>
        <button class="btn primary" type="submit">Add idea</button>
      </div>
    </form>
    <div class="filters">
      <select data-change="ideaFilter">
        <option value="open" ${state.ideaFilter === 'open' ? 'selected' : ''}>Open ideas</option>
        <option value="trending" ${state.ideaFilter === 'trending' ? 'selected' : ''}>Trending only</option>
        <option value="used" ${state.ideaFilter === 'used' ? 'selected' : ''}>Used</option>
        <option value="all" ${state.ideaFilter === 'all' ? 'selected' : ''}>All</option>
      </select>
      <select data-change="ideaClient">${clientOptions(state.ideaClient, true)}</select>
    </div>
    <div class="list">${rows || '<div class="empty">No ideas here yet.</div>'}</div>`;
}

function renderFootage() {
  let clips = Store.data.footage.slice().sort((a, b) => (b.shotDate || '').localeCompare(a.shotDate || ''));
  if (state.footClient) clips = clips.filter(x => x.clientId === state.footClient);
  if (state.footCategory) clips = clips.filter(x => x.category === state.footCategory);
  if (!state.footShowUsed) clips = clips.filter(x => !x.used);

  const cats = [...new Set(Store.data.footage.map(f => f.category).filter(Boolean))].sort();

  // Category summary: how many unused clips per category, so you can see what you can make
  const summary = {};
  Store.data.footage.filter(f => !f.used && (!state.footClient || f.clientId === state.footClient)).forEach(f => {
    const key = f.category || 'Uncategorised';
    summary[key] = (summary[key] || 0) + 1;
  });

  const rows = clips.map(f => `
    <div class="list-item ${f.used ? 'faded' : ''}" style="--client:${clientColor(f.clientId)}">
      <div class="main">
        <div class="title">${escapeHtml(f.description)}</div>
        <div class="meta">
          <span>${escapeHtml(clientName(f.clientId))}</span>
          ${f.category ? `<span class="badge">${escapeHtml(f.category)}</span>` : ''}
          ${f.shotDate ? `<span>Shot ${prettyDate(f.shotDate)}</span>` : ''}
          ${f.location ? `<span>Saved in: ${escapeHtml(f.location)}</span>` : ''}
          ${f.used ? '<span>Used</span>' : ''}
        </div>
      </div>
      <div class="btn-row">
        ${f.used
          ? `<button class="btn small" data-action="footage-unuse" data-id="${f.id}">Mark unused</button>`
          : `<button class="btn small primary" data-action="footage-to-content" data-id="${f.id}">Use for content</button>`}
        <button class="btn small danger" data-action="delete-footage" data-id="${f.id}">Delete</button>
      </div>
    </div>`).join('');

  return `
    <div class="page-head">
      <div>
        <h1>Footage library</h1>
        <p class="sub">Log raw clips you already have, so you can make content without a new shoot.</p>
      </div>
    </div>
    ${categoryDatalist()}
    <form id="footage-form" class="card" style="margin-bottom:20px">
      <div class="grid-3">
        <div class="field" style="grid-column: span 2">
          <label>What's in the clip</label>
          <input name="description" placeholder="e.g. Slow-mo coffee pour, 3 angles" required>
        </div>
        <div class="field">
          <label>Client</label>
          <select name="clientId" required>${clientOptions(state.footClient || (Store.activeClients()[0] || {}).id, false)}</select>
        </div>
      </div>
      <div class="grid-3">
        <div class="field">
          <label>Category</label>
          <input name="category" list="all-categories" placeholder="e.g. Ambience/Aesthetics">
        </div>
        <div class="field">
          <label>Date shot</label>
          <input type="date" name="shotDate" value="${todayStr()}">
        </div>
        <div class="field">
          <label>Where it's saved</label>
          <input name="location" placeholder="Drive folder, phone album">
        </div>
      </div>
      <div class="btn-row" style="justify-content:flex-end">
        <button class="btn primary" type="submit">Add clip</button>
      </div>
    </form>
    ${Object.keys(summary).length ? `
      <div class="card" style="margin-bottom:16px">
        <h3>Unused clips by category</h3>
        <div class="btn-row">${Object.entries(summary).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="badge">${escapeHtml(k)}: ${v}</span>`).join('')}</div>
      </div>` : ''}
    <div class="filters">
      <select data-change="footClient">${clientOptions(state.footClient, true)}</select>
      <select data-change="footCategory">
        <option value="">All categories</option>
        ${cats.map(c => `<option ${c === state.footCategory ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
      </select>
      <label class="check"><input type="checkbox" data-change="footShowUsed" ${state.footShowUsed ? 'checked' : ''}> Show used clips</label>
    </div>
    <div class="list">${rows || '<div class="empty">No clips logged yet.</div>'}</div>`;
}

function renderHistory() {
  let posted = Store.data.items.filter(x => x.stage === 'posted');
  if (state.histClient) posted = posted.filter(x => x.clientId === state.histClient);
  if (state.histType) posted = posted.filter(x => x.type === state.histType);
  if (state.histMonth) posted = posted.filter(x => (x.postedDate || '').startsWith(state.histMonth));
  posted.sort((a, b) => (b.postedDate || '').localeCompare(a.postedDate || ''));

  const reels = posted.filter(x => x.type === 'reel').length;
  const posts = posted.length - reels;

  const rows = posted.map(item => `
    <tr class="clickable" data-action="edit-item" data-id="${item.id}">
      <td>${prettyDate(item.postedDate)}</td>
      <td><span class="dot" style="--client:${clientColor(item.clientId)}"></span> ${escapeHtml(clientName(item.clientId))}</td>
      <td>${typeBadge(item.type)}</td>
      <td>${escapeHtml(item.title)}</td>
      <td class="hide-mobile">${escapeHtml(item.category || '')}</td>
      <td class="hide-mobile">${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener" data-stop>Open</a>` : ''}</td>
    </tr>`).join('');

  return `
    <div class="page-head">
      <div>
        <h1>Posting history</h1>
        <p class="sub">Everything that went live. Add older posts so your record is complete.</p>
      </div>
      <button class="btn primary" data-action="add-past-post">Add past post</button>
    </div>
    <div class="filters">
      <select data-change="histClient">${clientOptions(state.histClient, true)}</select>
      <select data-change="histType">
        <option value="">Reels and posts</option>
        <option value="reel" ${state.histType === 'reel' ? 'selected' : ''}>Reels</option>
        <option value="post" ${state.histType === 'post' ? 'selected' : ''}>Posts</option>
      </select>
      <input type="month" data-change="histMonth" value="${state.histMonth}">
      ${state.histMonth ? '<button class="btn small" data-action="hist-clear-month">All months</button>' : ''}
    </div>
    <p class="hint">${posted.length} total: ${reels} reels, ${posts} posts</p>
    ${posted.length ? `
      <table>
        <thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Title</th><th class="hide-mobile">Category</th><th class="hide-mobile">Link</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` : '<div class="empty">Nothing posted yet for this filter.</div>'}`;
}

function renderClients() {
  const cards = Store.data.clients.map(c => {
    const n = Calc.counts(c.id);
    return `
      <div class="card client-card" style="--client:${c.color}">
        <div class="head">
          <h3 style="margin:0"><a href="#client/${c.id}" class="client-link">${escapeHtml(c.name)}</a></h3>
          <span class="badge ${c.status}">${c.status === 'active' ? 'Active' : 'Paused'}</span>
        </div>
        <p class="hint">${c.reelsPerWeek} reels + ${c.postsPerWeek} posts per week. Shoot every ${c.shootEveryDays} days.</p>
        <p class="hint">${n.pending} pending, ${n.ready} ready, ${n.posted} posted.</p>
        <p class="hint">${(c.categories || []).length} categories: ${escapeHtml((c.categories || []).slice(0, 4).join(', '))}${(c.categories || []).length > 4 ? '...' : ''}</p>
        ${c.notes ? `<p class="hint">${escapeHtml(c.notes)}</p>` : ''}
        <div class="btn-row" style="margin-top:12px">
          <a class="btn small primary" href="#client/${c.id}">View</a>
          <button class="btn small" data-action="edit-client" data-id="${c.id}">Edit</button>
          <button class="btn small" data-action="toggle-client" data-id="${c.id}">${c.status === 'active' ? 'Pause' : 'Resume'}</button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="page-head">
      <div>
        <h1>Clients</h1>
        <p class="sub">Weekly targets, categories and shoot rhythm for each client.</p>
      </div>
      <button class="btn primary" data-action="new-client">Add client</button>
    </div>
    <div class="cards">${cards || '<div class="empty">No clients yet.</div>'}</div>`;
}

function openClientForm(client) {
  const isNew = !client;
  const c = client || {
    name: '',
    color: CLIENT_COLORS[Store.data.clients.length % CLIENT_COLORS.length],
    reelsPerWeek: 2,
    postsPerWeek: 2,
    shootEveryDays: 14,
    status: 'active',
    categories: [],
    notes: ''
  };
  const html = `
    <form id="client-form">
      <div class="grid-2">
        <div class="field">
          <label>Client name</label>
          <input name="name" value="${escapeHtml(c.name)}" required>
        </div>
        <div class="field">
          <label>Colour</label>
          <input type="color" name="color" value="${c.color}">
        </div>
      </div>
      <div class="grid-3">
        <div class="field">
          <label>Reels per week</label>
          <input type="number" min="0" name="reelsPerWeek" value="${c.reelsPerWeek}">
        </div>
        <div class="field">
          <label>Posts per week</label>
          <input type="number" min="0" name="postsPerWeek" value="${c.postsPerWeek}">
        </div>
        <div class="field">
          <label>Shoot every (days)</label>
          <input type="number" min="1" name="shootEveryDays" value="${c.shootEveryDays}">
        </div>
      </div>
      <div class="field">
        <label>Content categories (one per line)</label>
        <textarea name="categories" rows="6">${escapeHtml((c.categories || []).join('\n'))}</textarea>
      </div>
      <div class="field">
        <label>Status</label>
        <select name="status">
          <option value="active" ${c.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="paused" ${c.status === 'paused' ? 'selected' : ''}>Paused</option>
        </select>
      </div>
      <div class="field">
        <label>Notes</label>
        <textarea name="notes">${escapeHtml(c.notes || '')}</textarea>
      </div>
      <div class="modal-foot">
        <div>${isNew ? '' : '<button type="button" class="btn danger" data-action="delete-client">Delete client</button>'}</div>
        <div class="btn-row">
          <button type="button" class="btn" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn primary">${isNew ? 'Add client' : 'Save'}</button>
        </div>
      </div>
    </form>`;

  openModal(isNew ? 'New client' : 'Edit client', html, modal => {
    const form = modal.querySelector('#client-form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = form.elements;
      Store.saveClient(Object.assign({}, c, {
        id: c.id || uid(),
        name: f.name.value.trim(),
        color: f.color.value,
        reelsPerWeek: Number(f.reelsPerWeek.value) || 0,
        postsPerWeek: Number(f.postsPerWeek.value) || 0,
        shootEveryDays: Number(f.shootEveryDays.value) || 7,
        categories: f.categories.value.split('\n').map(s => s.trim()).filter(Boolean),
        status: f.status.value,
        notes: f.notes.value.trim()
      }));
      closeModal();
      toast(isNew ? 'Client added' : 'Client saved');
      render();
    });
    const del = modal.querySelector('[data-action="delete-client"]');
    if (del) {
      del.addEventListener('click', () => {
        if (confirm(`Delete ${c.name} and all its content, ideas and footage? Tip: use Pause instead to keep the history.`)) {
          Store.deleteClient(c.id);
          closeModal();
          toast('Client deleted');
          render();
        }
      });
    }
  });
}

function renderBackup() {
  const d = Store.data;
  return `
    <div class="page-head">
      <div>
        <h1>Backup and settings</h1>
        <p class="sub">${Cloud.enabled ? 'Your data is synced to your account. An extra backup file is still a good idea once in a while.' : 'Your data is saved in this browser only. Export a backup regularly.'}</p>
      </div>
    </div>
    <div class="two-col">
      <div class="card">
        <h2>Backup</h2>
        <p class="hint">${d.clients.length} clients, ${d.items.length} content pieces, ${d.ideas.length} ideas, ${d.footage.length} clips.</p>
        <div class="btn-row" style="margin:12px 0">
          <button class="btn primary" data-action="export">Export backup</button>
          <label class="btn" style="margin:0">Import backup<input type="file" id="import-file" accept=".json,application/json" hidden></label>
        </div>
        <p class="hint">Importing replaces everything currently in the app${Cloud.enabled ? ' and in your account' : ''}.${Cloud.enabled ? '' : ' To move to another laptop or browser, export here and import there.'}</p>
      </div>
      <div class="card">
        <h2>Settings</h2>
        <form id="settings-form">
          <div class="field">
            <label>Shoot reminder: days before reel stock runs out</label>
            <input type="number" min="0" name="shootLeadDays" value="${d.settings.shootLeadDays}">
          </div>
          <button class="btn primary" type="submit">Save settings</button>
        </form>
        <hr style="border:none;border-top:1px solid var(--border);margin:20px 0">
        <h3>Start over</h3>
        <p class="hint">Deletes everything and puts back the two starting clients.</p>
        <button class="btn danger" data-action="reset">Reset app</button>
      </div>
    </div>`;
}


// ---------- Single client page ----------

function renderClientDetail() {
  const c = Store.client(state.clientId);
  if (!c) return renderClients();
  const today = todayStr();
  const items = Store.data.items.filter(x => x.clientId === c.id);
  const posted = items.filter(x => x.stage === 'posted').sort((a, b) => (b.postedDate || '').localeCompare(a.postedDate || ''));
  const reels = posted.filter(x => x.type === 'reel').length;
  const posts = posted.length - reels;
  const n = Calc.counts(c.id);
  const alert = Calc.shootAlert(c);
  const thisWeek = Calc.weekProgress(c.id, startOfWeek(today));
  const month = today.slice(0, 7);
  const monthPosted = posted.filter(x => (x.postedDate || '').startsWith(month));
  const firstDate = posted.length ? posted[posted.length - 1].postedDate : '';

  // Last 8 weeks, newest first
  const weeks = [];
  for (let i = 0; i < 8; i++) {
    const start = addDays(startOfWeek(today), -7 * i);
    const p = Calc.weekProgress(c.id, start);
    weeks.push({ start, reels: p.reel.posted, posts: p.post.posted, before: !firstDate || addDays(start, 6) < firstDate });
  }
  const cell = (got, target) => {
    const t = Number(target) || 0;
    const cls = !t ? '' : got >= t ? 'met' : got > 0 ? 'part' : 'miss';
    return `<td><span class="score ${cls}">${got}/${t}</span></td>`;
  };

  // Month by month since the first post
  const months = {};
  posted.forEach(x => {
    const m = (x.postedDate || '').slice(0, 7);
    if (!m) return;
    months[m] = months[m] || { reel: 0, post: 0 };
    months[m][x.type]++;
  });
  const monthRows = Object.keys(months).sort().reverse().map(m =>
    `<tr><td>${monthLabel(m)}</td><td>${months[m].reel}</td><td>${months[m].post}</td><td><strong>${months[m].reel + months[m].post}</strong></td></tr>`).join('');

  // Category mix of posted content
  const cats = {};
  posted.forEach(x => { const k = x.category || 'No category'; cats[k] = (cats[k] || 0) + 1; });
  const catMax = Math.max(1, ...Object.values(cats));
  const catRows = Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `
    <div class="hbar"><span class="hbar-label">${escapeHtml(k)}</span>
      <span class="hbar-track"><span class="hbar-fill" style="width:${(v / catMax) * 100}%;background:${c.color}"></span></span>
      <span class="hbar-num">${v}</span></div>`).join('');

  const inProgress = items.filter(x => x.stage !== 'posted')
    .sort((a, b) => (a.plannedDate || '9999').localeCompare(b.plannedDate || '9999'));

  const tile = (num, label) => `<div class="stat"><div class="num">${num}</div><div class="lbl">${label}</div></div>`;

  return `
    <div class="page-head">
      <div>
        <p class="hint" style="margin:0 0 4px"><a href="#clients">Clients</a> / ${escapeHtml(c.name)}</p>
        <h1 style="display:flex;align-items:center;gap:10px"><span class="dot" style="--client:${c.color};width:14px;height:14px"></span>${escapeHtml(c.name)}
          <span class="badge ${c.status}">${c.status === 'active' ? 'Active' : 'Paused'}</span></h1>
        <p class="sub">Target ${c.reelsPerWeek} reels + ${c.postsPerWeek} posts a week${firstDate ? ` · Posting since ${prettyDate(firstDate)}` : ''}</p>
      </div>
      <div class="btn-row">
        <button class="btn" data-action="edit-client" data-id="${c.id}">Edit client</button>
        <button class="btn primary" data-action="new-item-client" data-id="${c.id}">Add content</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="stat-row stat-row-wide">
        ${tile(posted.length, 'Total posted')}
        ${tile(reels, 'Reels posted')}
        ${tile(posts, 'Posts posted')}
        ${tile(monthPosted.length, 'Posted this month')}
      </div>
      <div class="stat-row stat-row-wide">
        ${tile(`${thisWeek.reel.posted}/${c.reelsPerWeek}`, 'Reels this week')}
        ${tile(`${thisWeek.post.posted}/${c.postsPerWeek}`, 'Posts this week')}
        ${tile(n.pending, 'Pending (shoot + edit)')}
        ${tile(n.ready, 'Ready to post')}
      </div>
      ${alert && c.status === 'active' ? `<div class="alert ${alert.level}">${escapeHtml(alert.text)}</div>` : ''}
    </div>

    <div class="two-col" style="margin-bottom:24px">
      <div>
        <h2>Last 8 weeks</h2>
        <table>
          <thead><tr><th>Week starting</th><th>Reels</th><th>Posts</th></tr></thead>
          <tbody>${weeks.map(w => `<tr><td>${shortDate(w.start)}</td>${w.before ? '<td class="hint">-</td><td class="hint">-</td>' : cell(w.reels, c.reelsPerWeek) + cell(w.posts, c.postsPerWeek)}</tr>`).join('')}</tbody>
        </table>
        <p class="hint" style="margin-top:6px">Green = target met, amber = partly, red = nothing posted.</p>
      </div>
      <div>
        <h2>Month by month</h2>
        ${monthRows ? `<table><thead><tr><th>Month</th><th>Reels</th><th>Posts</th><th>Total</th></tr></thead><tbody>${monthRows}</tbody></table>` : '<div class="empty">Nothing posted yet.</div>'}
        <h2 style="margin-top:24px">Content mix</h2>
        ${catRows ? `<div class="card">${catRows}</div>` : '<div class="empty">No categories yet.</div>'}
      </div>
    </div>

    <div class="two-col">
      <div>
        <h2>In progress <span class="badge">${inProgress.length}</span></h2>
        <div class="list">${inProgress.length ? inProgress.map(i => itemRow(i)).join('') : '<div class="empty">Nothing in progress.</div>'}</div>
      </div>
      <div>
        <h2>Posted <span class="badge">${posted.length}</span></h2>
        <div class="list">${posted.length ? posted.map(i => itemRow(i, i.link ? `<a href="${escapeHtml(i.link)}" target="_blank" rel="noopener" data-stop>Open on Instagram</a>` : '')).join('') : '<div class="empty">Nothing posted yet.</div>'}</div>
      </div>
    </div>`;
}

// ---------- Rendering and navigation ----------

const PAGES = {
  dashboard: renderDashboard,
  calendar: renderCalendar,
  pipeline: renderPipeline,
  ideas: renderIdeas,
  footage: renderFootage,
  history: renderHistory,
  clients: renderClients,
  client: renderClientDetail,
  backup: renderBackup
};

function render() {
  viewEl.innerHTML = (PAGES[state.view] || renderDashboard)();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === (state.view === 'client' ? 'clients' : state.view)));
  bindPageForms();
}

function switchView(view) {
  view = view || 'dashboard';
  if (view.startsWith('client/')) {
    state.clientId = view.slice(7);
    view = 'client';
  }
  if (view === 'client' && !Store.client(state.clientId)) view = 'clients';
  state.view = PAGES[view] ? view : 'dashboard';
  const hash = state.view === 'client' ? '#client/' + state.clientId : '#' + state.view;
  if (location.hash !== hash) history.replaceState(null, '', hash);
  window.scrollTo(0, 0);
  render();
}

// Forms that live on pages (not in modals) are bound after each render
function bindPageForms() {
  const ideaForm = document.getElementById('idea-form');
  if (ideaForm) {
    ideaForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = ideaForm.elements;
      Store.saveIdea({
        id: uid(),
        title: f.title.value.trim(),
        clientId: f.clientId.value,
        type: f.type.value,
        category: f.category.value.trim(),
        link: f.link.value.trim(),
        notes: f.notes.value.trim(),
        trending: f.trending.checked,
        used: false,
        createdAt: new Date().toISOString()
      });
      toast('Idea added');
      render();
    });
  }

  const readyForm = document.getElementById('ready-form');
  if (readyForm) {
    readyForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = readyForm.elements;
      state.readyLastClient = f.clientId.value;
      Store.saveItem({
        id: uid(),
        clientId: f.clientId.value,
        type: f.type.value,
        title: f.title.value.trim(),
        category: '',
        stage: 'ready',
        plannedDate: f.plannedDate.value,
        postedDate: '',
        link: '',
        notes: '',
        createdAt: new Date().toISOString()
      });
      toast('Added to ready to post');
      render();
    });
  }

  const footForm = document.getElementById('footage-form');
  if (footForm) {
    footForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = footForm.elements;
      Store.saveFootage({
        id: uid(),
        description: f.description.value.trim(),
        clientId: f.clientId.value,
        category: f.category.value.trim(),
        shotDate: f.shotDate.value,
        location: f.location.value.trim(),
        used: false,
        createdAt: new Date().toISOString()
      });
      toast('Clip added');
      render();
    });
  }

  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', e => {
      e.preventDefault();
      Store.data.settings.shootLeadDays = Number(settingsForm.elements.shootLeadDays.value) || 0;
      Store.save();
      toast('Settings saved');
    });
  }

  const importInput = document.getElementById('import-file');
  if (importInput) {
    importInput.addEventListener('change', () => {
      const file = importInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || !Array.isArray(data.clients)) throw new Error('Not a MySocial backup');
          if (confirm('Replace everything in the app with this backup?')) {
            Store.replaceAll(data);
            toast('Backup imported');
            render();
          }
        } catch (err) {
          toast('That file is not a valid MySocial backup');
        }
        importInput.value = '';
      };
      reader.readAsText(file);
    });
  }
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mysocial-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup downloaded');
}

function moveItem(id, stage) {
  const item = Store.item(id);
  if (!item || item.stage === stage) return;
  item.stage = stage;
  if (stage === 'posted') {
    if (!item.postedDate) item.postedDate = todayStr();
    Store.saveItem(item);
    render();
    openItemForm(item); // let them confirm the date and paste the link
    return;
  }
  item.postedDate = '';
  Store.saveItem(item);
  toast(`Moved to ${stageLabel(stage)}`);
  render();
}

// ---------- Event delegation ----------

document.addEventListener('click', e => {
  if (e.target.closest('[data-stop]')) { e.stopPropagation(); return; }

  const navBtn = e.target.closest('#nav button');
  if (navBtn) { if (Store.data) switchView(navBtn.dataset.view); return; }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;

  switch (action) {
    case 'close-modal':
      closeModal();
      break;
    case 'close-modal-backdrop':
      if (e.target === el) closeModal();
      break;
    case 'new-item':
      openItemForm({ clientId: state.pipeClient || state.calClient || undefined });
      break;
    case 'new-item-on':
      openItemForm({ plannedDate: el.dataset.date, clientId: state.calClient || undefined });
      break;
    case 'edit-item': {
      e.stopPropagation();
      const item = Store.item(id);
      if (item) openItemForm(Object.assign({}, item));
      break;
    }
    case 'add-past-post':
      openItemForm({ stage: 'posted', postedDate: todayStr(), clientId: state.histClient || undefined });
      break;
    case 'cal-prev':
    case 'cal-next': {
      const [y, m] = state.calMonth.split('-').map(Number);
      const d = new Date(y, m - 1 + (action === 'cal-next' ? 1 : -1), 1);
      state.calMonth = toDateStr(d).slice(0, 7);
      render();
      break;
    }
    case 'cal-today':
      state.calMonth = todayStr().slice(0, 7);
      render();
      break;
    case 'idea-to-content': {
      const idea = Store.data.ideas.find(x => x.id === id);
      if (!idea) break;
      idea.used = true;
      Store.saveIdea(idea);
      render();
      openItemForm({
        title: idea.title,
        clientId: idea.clientId || undefined,
        type: idea.type || 'reel',
        category: idea.category,
        notes: [idea.notes, idea.link].filter(Boolean).join('\n'),
        stage: 'to_shoot'
      });
      break;
    }
    case 'delete-idea':
      if (confirm('Delete this idea?')) { Store.deleteIdea(id); render(); }
      break;
    case 'footage-to-content': {
      const clip = Store.data.footage.find(x => x.id === id);
      if (!clip) break;
      clip.used = true;
      Store.saveFootage(clip);
      render();
      openItemForm({
        title: clip.description,
        clientId: clip.clientId,
        type: 'reel',
        category: clip.category,
        notes: clip.location ? `Footage saved in: ${clip.location}` : '',
        stage: 'to_edit',
        footageId: clip.id
      });
      break;
    }
    case 'footage-unuse': {
      const clip = Store.data.footage.find(x => x.id === id);
      if (clip) { clip.used = false; Store.saveFootage(clip); render(); }
      break;
    }
    case 'delete-footage':
      if (confirm('Delete this clip from the library?')) { Store.deleteFootage(id); render(); }
      break;
    case 'hist-clear-month':
      state.histMonth = '';
      render();
      break;
    case 'mark-posted':
      moveItem(id, 'posted');
      break;
    case 'new-item-client':
      openItemForm({ clientId: id });
      break;
    case 'new-client':
      openClientForm(null);
      break;
    case 'edit-client':
      openClientForm(Object.assign({}, Store.client(id)));
      break;
    case 'toggle-client': {
      const c = Store.client(id);
      if (c) {
        c.status = c.status === 'active' ? 'paused' : 'active';
        Store.saveClient(c);
        toast(`${c.name} ${c.status === 'active' ? 'resumed' : 'paused'}`);
        render();
      }
      break;
    }
    case 'export':
      exportBackup();
      break;
    case 'logout':
      logout();
      break;
    case 'reset':
      if (confirm('Delete all data and start over? Export a backup first if you want to keep it.')) {
        Store.reset();
        toast('App reset');
        render();
      }
      break;
  }
});

// Filters and "Move to" selects
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.moveId) {
    moveItem(el.dataset.moveId, el.value);
    return;
  }
  const key = el.dataset.change;
  if (key && key in state) {
    state[key] = el.type === 'checkbox' ? el.checked : el.value;
    render();
  }
});

// Drag and drop on the pipeline board
document.addEventListener('dragstart', e => {
  const card = e.target.closest && e.target.closest('[data-drag-id]');
  if (card) e.dataTransfer.setData('text/plain', card.dataset.dragId);
});
document.addEventListener('dragover', e => {
  const col = e.target.closest && e.target.closest('[data-drop-stage]');
  if (col) { e.preventDefault(); col.classList.add('drag-over'); }
});
document.addEventListener('dragleave', e => {
  const col = e.target.closest && e.target.closest('[data-drop-stage]');
  if (col && !col.contains(e.relatedTarget)) col.classList.remove('drag-over');
});
document.addEventListener('drop', e => {
  const col = e.target.closest && e.target.closest('[data-drop-stage]');
  if (!col) return;
  e.preventDefault();
  col.classList.remove('drag-over');
  const id = e.dataTransfer.getData('text/plain');
  if (id) moveItem(id, col.dataset.dropStage);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalRoot.innerHTML) closeModal();
});

window.addEventListener('hashchange', () => { if (Store.data) switchView(location.hash.slice(1)); });

// ---------- Login and start ----------

function renderLogin(message) {
  document.body.classList.add('logged-out');
  document.body.classList.remove('booting');
  closeModal();
  viewEl.innerHTML = `
    <div class="login-wrap">
      <form id="login-form" class="card login-card">
        <h1>MySocial</h1>
        <p class="hint" style="margin-bottom:16px">Log in to see your clients and content.</p>
        <div class="field">
          <label>Email</label>
          <input type="email" name="email" autocomplete="username" required>
        </div>
        <div class="field">
          <label>Password</label>
          <input type="password" name="password" autocomplete="current-password" required>
        </div>
        <p class="form-error" id="login-error">${escapeHtml(message || '')}</p>
        <button class="btn primary" type="submit" style="width:100%;justify-content:center">Log in</button>
      </form>
    </div>`;
  const form = document.getElementById('login-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const errEl = document.getElementById('login-error');
    btn.disabled = true;
    btn.textContent = 'Logging in...';
    errEl.textContent = '';
    try {
      await Cloud.signIn(form.elements.email.value.trim(), form.elements.password.value);
      await startCloud();
    } catch (err) {
      errEl.textContent = err && err.message ? err.message : 'Could not log in';
      btn.disabled = false;
      btn.textContent = 'Log in';
    }
  });
}

// Load your data from the cloud. The first time, whatever is already in this
// browser (your v1 data) is uploaded so nothing is lost.
async function startCloud() {
  document.body.classList.remove('logged-out');
  viewEl.innerHTML = '<div class="loading">Loading your data...</div>';
  try {
    const remote = await Cloud.fetch();
    if (remote) {
      Store.setData(remote.data);
      Cloud.lastSyncedAt = remote.updated_at;
      Cloud.setStatus('saved');
    } else {
      Store.setData(Store.readLocal() || seedData());
      Cloud.pending = true;
      await Cloud.push();
      toast('Your data is now saved to your account');
    }
  } catch (err) {
    console.error(err);
    const local = Store.readLocal();
    if (!local) {
      renderLogin('Could not reach the server. Check your internet and try again.');
      return;
    }
    Store.setData(local);
    Cloud.setStatus('error');
    toast('Offline - showing the copy saved on this device');
  }
  document.getElementById('logout-btn').hidden = false;
  startApp();
}

function startApp() {
  document.body.classList.remove('booting', 'logged-out');
  switchView(location.hash.slice(1) || 'dashboard');
}

async function logout() {
  if (Cloud.pending && !confirm('Some changes have not synced yet. Log out anyway?')) return;
  await Cloud.signOut();
  Store.clearLocal(); // don't leave your data on a shared device
  Store.data = null;
  document.getElementById('logout-btn').hidden = true;
  renderLogin();
}

async function boot() {
  if (!Cloud.init()) {
    // No Supabase settings: local mode, data stays in this browser
    Store.load();
    Cloud.setStatus('local');
    startApp();
    return;
  }
  viewEl.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const user = await Cloud.getUser();
    if (user) await startCloud();
    else renderLogin();
  } catch (err) {
    renderLogin('Could not reach the server. Check your internet and try again.');
  }
}

// Coming back to the tab: pick up changes made on your phone or another device
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !Cloud.enabled || !Cloud.user || !Store.data) return;
  if (modalRoot.innerHTML) return; // don't refresh while you're editing
  if (await Cloud.refreshIfChanged()) render();
});

// Try to send unsynced changes before the page closes
window.addEventListener('pagehide', () => { if (Cloud.enabled) Cloud.flush(); });
window.addEventListener('online', () => { if (Cloud.enabled && Cloud.pending) Cloud.push(); });

boot();
