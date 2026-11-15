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
  queueTab: 'to_edit',
  queueClient: '',
  queueOwner: '',
  queueLastClient: '',
  scriptClient: '',
  scriptsOpen: {},
  trendGenre: '',
  planWeek: 0,
  calMode: 'month',
  calWeek: 0,
  pfMissing: ''
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

function plural(n, word) {
  return `${n} ${word}${Number(n) === 1 ? '' : 's'}`;
}

function teamOptions(selected, blankLabel) {
  const team = Store.data.settings.team || [];
  let html = `<option value="">${escapeHtml(blankLabel || 'No one')}</option>`;
  team.forEach(name => { html += `<option ${name === selected ? 'selected' : ''}>${escapeHtml(name)}</option>`; });
  if (selected && !team.includes(selected)) html += `<option selected>${escapeHtml(selected)}</option>`;
  return html;
}

// Checkboxes for "Collab with" (every account except the main one)
function collabChecks(selected, excludeId) {
  const list = Store.data.clients.filter(c => c.id !== excludeId);
  if (!list.length) return '<span class="hint">No other accounts</span>';
  return list.map(c => `
    <label class="check collab-check"><input type="checkbox" name="collabWith" value="${c.id}" ${(selected || []).includes(c.id) ? 'checked' : ''}>
      <span class="dot" style="--client:${c.color}"></span>${escapeHtml(c.name)}</label>`).join('');
}

function collabBadge(item) {
  const ids = (item.collabWith || []).filter(id => Store.client(id));
  return ids.length ? `<span class="badge collab">Collab: ${ids.map(id => escapeHtml(clientName(id))).join(', ')}</span>` : '';
}

function ownerBadge(owner) {
  return owner ? `<span class="badge owner">${escapeHtml(owner)}</span>` : '';
}

// Live "88 words · ~35s" chip for scripts
function lengthChip(text) {
  const l = scriptLength(text);
  if (!l.words) return '<span class="len-chip none">No script yet</span>';
  const tip = l.level === 'good' ? '' : l.level === 'short' ? ' · short' : ' · too long';
  return `<span class="len-chip ${l.level}">${l.words} words · ~${l.secs}s${tip}</span>`;
}

function bindLengthChip(textarea, chipHolder) {
  if (!textarea || !chipHolder) return;
  const update = () => { chipHolder.innerHTML = lengthChip(textarea.value); };
  textarea.addEventListener('input', update);
  update();
}

function copyText(text) {
  const done = () => toast('Copied');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'absolute';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('Could not copy'); }
  ta.remove();
}

// Small IG / YT / in / X buttons for one piece. One row per account (main + collabs).
function platformRows(item) {
  if (item.stage !== 'posted') return '';
  const accts = accountsOf(item).filter(a => (Store.client(a).platforms || []).length);
  if (!accts.length) return '';
  const many = accts.length > 1;
  return `<div class="pf-wrap">${accts.map(acct => {
    const c = Store.client(acct);
    const btns = PLATFORMS.filter(p => c.platforms.includes(p.id)).map(p => {
      const on = isPostedOn(item, acct, p.id);
      const link = item.platformLinks && item.platformLinks[acct] && item.platformLinks[acct][p.id];
      return `<button type="button" class="pf ${on ? 'on' : ''}" data-action="toggle-platform" data-id="${item.id}" data-acct="${acct}" data-pf="${p.id}" title="${p.label}${on ? ': posted' : ': not yet'}${link ? ' (has link)' : ''}">${on ? '&#10003; ' : ''}${p.short}</button>`;
    }).join('');
    return `<span class="pf-row">${many ? `<span class="pf-name"><span class="dot" style="--client:${c.color}"></span><span class="full">${escapeHtml(c.name)}</span><span class="short">${escapeHtml(c.name.split(' ')[0])}</span></span>` : ''}${btns}</span>`;
  }).join('')}</div>`;
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
          ${collabBadge(item)}
          ${item.category ? `<span>${escapeHtml(item.category)}</span>` : ''}
          <span>${dateText}</span>
          ${ownerBadge(item.owner)}
          ${overdue ? '<span class="badge overdue">Overdue</span>' : ''}
          ${extraMeta || ''}
        </div>
        ${platformRows(item)}
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
    link: '',
    owner: '',
    collabWith: [],
    script: '',
    caption: '',
    hashtags: ''
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
      <div class="field posted-only">
        <label>Posted on platforms <span class="hint">tap to tick</span></label>
        <div id="pf-form"></div>
        <details class="pf-links"><summary>Add links for other platforms (optional)</summary><div id="pf-link-fields"></div></details>
      </div>
      <div class="grid-2">
        <div class="field">
          <label>Who's doing it</label>
          <select name="owner">${teamOptions(data.owner)}</select>
        </div>
        <div class="field">
          <label>Collab with</label>
          <div class="collab-box" id="collab-box">${collabChecks(data.collabWith, data.clientId)}</div>
        </div>
      </div>
      <div class="field">
        <label style="display:flex;justify-content:space-between;align-items:center">Script <span id="item-len"></span></label>
        <textarea name="script" rows="5" placeholder="Hook, then the main points, then the call to action">${escapeHtml(data.script)}</textarea>
      </div>
      <div class="field">
        <label>Caption</label>
        <textarea name="caption" rows="3" placeholder="Caption for Instagram">${escapeHtml(data.caption)}</textarea>
      </div>
      <div class="field">
        <label style="display:flex;justify-content:space-between;align-items:center">Hashtags
          <button type="button" class="btn small" data-action="use-saved-hashtags">Use saved hashtags</button></label>
        <input name="hashtags" value="${escapeHtml(data.hashtags)}" placeholder="#nutrition #vizag">
      </div>
      <div class="btn-row" style="margin:-4px 0 12px">
        <button type="button" class="btn small" data-action="copy-caption">Copy caption + hashtags</button>
      </div>
      <div class="field">
        <label>Notes (music, shots, anything else)</label>
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
    // Platform ticks inside the form (kept here until Save)
    const cp = JSON.parse(JSON.stringify(data.crossPost || {}));
    const pl = JSON.parse(JSON.stringify(data.platformLinks || {}));
    const formAccounts = () => [form.elements.clientId.value, ...[...form.querySelectorAll('input[name="collabWith"]:checked')].map(x => x.value)]
      .filter((id, i, a) => id && a.indexOf(id) === i && Store.client(id));
    const drawPlatforms = () => {
      const accts = formAccounts();
      const many = accts.length > 1;
      modal.querySelector('#pf-form').innerHTML = accts.map(acct => {
        const c = Store.client(acct);
        const list = PLATFORMS.filter(p => (c.platforms || []).includes(p.id));
        if (!list.length) return `<p class="hint" style="margin:0">${escapeHtml(c.name)}: no platforms set (Edit the account to add some)</p>`;
        return `<div class="pf-row pf-form-row">${many ? `<span class="pf-acct"><span class="dot" style="--client:${c.color}"></span>${escapeHtml(c.name)}</span>` : ''}
          ${list.map(p => `<button type="button" class="pf ${cp[acct] && cp[acct][p.id] ? 'on' : ''}" data-pf-acct="${acct}" data-pf-id="${p.id}">${cp[acct] && cp[acct][p.id] ? '&#10003; ' : ''}${p.label}</button>`).join('')}</div>`;
      }).join('');
      modal.querySelector('#pf-link-fields').innerHTML = accts.map(acct => {
        const c = Store.client(acct);
        return PLATFORMS.filter(p => p.id !== 'ig' && (c.platforms || []).includes(p.id)).map(p =>
          `<div class="pf-link-row"><span>${many ? escapeHtml(c.name) + ' · ' : ''}${p.label}</span><input data-pfl-acct="${acct}" data-pfl-id="${p.id}" value="${escapeHtml((pl[acct] || {})[p.id] || '')}" placeholder="Link"></div>`).join('');
      }).join('') || '<p class="hint">No other platforms for this account.</p>';
    };
    modal.querySelector('#pf-form').addEventListener('click', e => {
      const b = e.target.closest('[data-pf-acct]');
      if (!b) return;
      const a = b.dataset.pfAcct, id = b.dataset.pfId;
      cp[a] = Object.assign({}, cp[a]);
      cp[a][id] = !cp[a][id];
      drawPlatforms();
    });
    form.addEventListener('change', e => { if (e.target.name === 'collabWith') drawPlatforms(); });
    form.elements.link.addEventListener('input', () => {
      if (!/instagram\.com/i.test(form.elements.link.value)) return;
      formAccounts().forEach(a => {
        if ((Store.client(a).platforms || []).includes('ig')) cp[a] = Object.assign({}, cp[a], { ig: true });
      });
      drawPlatforms();
    });
    drawPlatforms();

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

    const checkedCollabs = () => [...form.querySelectorAll('input[name="collabWith"]:checked')].map(x => x.value);
    form.elements.clientId.addEventListener('change', () => {
      form.elements.category.innerHTML = categoryOptions(form.elements.clientId.value, '');
      const keep = checkedCollabs().filter(id => id !== form.elements.clientId.value);
      modal.querySelector('#collab-box').innerHTML = collabChecks(keep, form.elements.clientId.value);
      drawPlatforms();
    });
    bindLengthChip(form.elements.script, modal.querySelector('#item-len'));
    modal.querySelector('[data-action="use-saved-hashtags"]').addEventListener('click', () => {
      const c = Store.client(form.elements.clientId.value);
      if (c && c.hashtags) form.elements.hashtags.value = c.hashtags;
      else toast('No saved hashtags for this account yet');
    });
    modal.querySelector('[data-action="copy-caption"]').addEventListener('click', () => {
      const text = [form.elements.caption.value.trim(), form.elements.hashtags.value.trim()].filter(Boolean).join('\n\n');
      if (text) copyText(text); else toast('Write a caption first');
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = form.elements;
      const saved = Object.assign({}, data, {
        id: data.id || data.presetId || uid(),
        clientId: f.clientId.value,
        type: f.type.value,
        title: f.title.value.trim(),
        category: f.category.value,
        stage: f.stage.value,
        plannedDate: f.plannedDate.value,
        postedDate: f.stage.value === 'posted' ? f.postedDate.value : '',
        link: f.link.value.trim(),
        notes: f.notes.value.trim(),
        owner: f.owner.value,
        collabWith: checkedCollabs().filter(id => id !== f.clientId.value),
        script: f.script.value.trim(),
        caption: f.caption.value.trim(),
        hashtags: f.hashtags.value.trim(),
        crossPost: cp,
        platformLinks: (() => {
          const out = {};
          modal.querySelectorAll('[data-pfl-acct]').forEach(inp => {
            const v = inp.value.trim();
            if (!v) return;
            out[inp.dataset.pflAcct] = Object.assign({}, out[inp.dataset.pflAcct], { [inp.dataset.pflId]: v });
          });
          return out;
        })(),
        createdAt: data.createdAt || new Date().toISOString()
      });
      autoTickInstagram(saved);
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
  const activeAll = Store.activeClients();
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

  const cardFor = c => {
    const prog = Calc.weekProgress(c.id, weekStart);
    const n = Calc.counts(c.id);
    const alert = Calc.shootAlert(c);
    return `
      <div class="card client-card" style="--client:${c.color}">
        <div class="head">
          <h3 style="margin:0"><a href="#client/${c.id}" class="client-link">${escapeHtml(c.name)}</a></h3>
          <span class="hint">${[Number(c.reelsPerWeek) ? plural(c.reelsPerWeek, 'reel') : '', Number(c.postsPerWeek) ? plural(c.postsPerWeek, 'post') : ''].filter(Boolean).join(' + ')} / week</span>
        </div>
        ${Number(c.reelsPerWeek) ? progressLine('Reels this week', prog.reel, c.reelsPerWeek) : ''}
        ${Number(c.postsPerWeek) ? progressLine('Posts this week', prog.post, c.postsPerWeek) : ''}
        <div class="stat-row">
          <div class="stat"><div class="num">${n.toShoot}</div><div class="lbl">To shoot</div></div>
          <div class="stat"><div class="num">${n.toEdit}</div><div class="lbl">To edit</div></div>
          <div class="stat"><div class="num">${n.ready}</div><div class="lbl">Ready</div></div>
          <div class="stat"><div class="num">${n.unusedFootage}</div><div class="lbl">Unused clips</div></div>
        </div>
        ${alert ? `<div class="alert ${alert.level}">${escapeHtml(alert.text)}</div>` : ''}
      </div>`;
  };
  const clientCards = activeAll.filter(c => c.kind !== 'brand').map(cardFor).join('');
  const brandCards = activeAll.filter(c => c.kind === 'brand').map(cardFor).join('');

  const overdue = Calc.overdue();
  const upcoming = Calc.upcoming(7);
  const months = Calc.postedByMonth(3);

  return `
    <div class="page-head">
      <div>
        <h1>Dashboard</h1>
        <p class="sub">This week: ${shortDate(weekStart)} to ${shortDate(weekEnd)}</p>
      </div>
      <button class="btn primary" data-action="new-item">Add content</button>
    </div>

    ${renderToday()}

    <h2>Clients</h2>
    ${clientCards ? `<div class="cards">${clientCards}</div>` : '<div class="empty" style="margin-bottom:24px">No active clients. Add one on the Clients page.</div>'}
    ${brandCards ? `<h2>Own brands</h2><div class="cards">${brandCards}</div>` : ''}
    ${paused.length ? `<p class="hint" style="margin:-12px 0 24px">Paused: ${paused.map(c => escapeHtml(c.name)).join(', ')}</p>` : ''}

    ${renderWorkQueue()}

    <div class="two-col">
      <div>
        <h2>Overdue ${overdue.length ? `<span class="badge overdue">${overdue.length}</span>` : ''}</h2>
        <div class="list">${overdue.length ? overdue.map(i => itemRow(i)).join('') : '<div class="empty">Nothing overdue. Nice.</div>'}</div>
        <h2 style="margin-top:24px">Next 7 days</h2>
        <div class="list">${upcoming.length ? upcoming.slice(0, 6).map(i => itemRow(i)).join('') : '<div class="empty">Nothing planned for the next 7 days.</div>'}</div>
        ${upcoming.length > 6 ? `<p class="hint" style="margin-top:8px">+${upcoming.length - 6} more. <a href="#calendar">See the calendar</a></p>` : ''}
      </div>
      <div>
        <h2>Posted per month</h2>
        <div class="table-wrap"><table>
          <thead><tr><th>Month</th>${Store.data.clients.map(c => `<th><span class="full">${escapeHtml(c.name)}</span><span class="short">${escapeHtml(c.name.split(' ')[0])}</span></th>`).join('')}<th>Total</th></tr></thead>
          <tbody>
            ${months.map(m => `<tr><td>${monthLabel(m.month).replace(/ \d{4}$/, '')}</td>${Store.data.clients.map(c => `<td>${m.byClient[c.id] || 0}</td>`).join('')}<td><strong>${m.total}</strong></td></tr>`).join('')}
          </tbody>
        </table></div>
      </div>
    </div>

    ${renderScriptsBoard()}`;
}


// ---------- Dashboard: Today ----------

function renderToday() {
  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const weekStart = startOfWeek(today);
  const items = Store.data.items;

  // This week across all active accounts (each piece counted once)
  const active = Store.activeClients();
  const target = active.reduce((n, c) => n + (Number(c.reelsPerWeek) || 0) + (Number(c.postsPerWeek) || 0), 0);
  const weekEnd = addDays(weekStart, 6);
  const postedWeek = items.filter(x => x.stage === 'posted' && x.postedDate >= weekStart && x.postedDate <= weekEnd).length;

  const open = x => x.stage !== 'posted';
  const dueToday = items.filter(x => open(x) && x.plannedDate === today);
  const overdue = Calc.overdue();
  const dueTomorrow = items.filter(x => open(x) && x.plannedDate === tomorrow);
  const deadlines = Store.data.ideas
    .map(x => ({ x, d: deadlineInfo(x) }))
    .filter(o => o.d && o.d.days <= 7)
    .sort((a, b) => a.d.shootBy.localeCompare(b.d.shootBy));

  // Waiting on the team: only pieces you tagged yourself (not from the weekly plan)
  const byOwner = {};
  items.forEach(x => {
    if (!open(x) || !x.owner || x.owner === 'Vikas' || x.fromTemplate) return;
    const o = (byOwner[x.owner] = byOwner[x.owner] || { n: 0, late: 0 });
    o.n++;
    if (x.plannedDate && x.plannedDate < today) o.late++;
  });

  const status = x => x.stage === 'ready'
    ? '<span class="pill ok">Ready</span>'
    : `<span class="pill ${x.stage === 'to_edit' ? 'am' : 'no'}">${x.plannedDate && x.plannedDate <= today ? 'Not ready · ' : ''}${stageLabel(x.stage)}</span>`;
  const row = (x, withButton) => `
    <div class="td-row">
      <span class="dot" style="--client:${clientColor(x.clientId)}"></span>
      <span class="td-tx" data-action="edit-item" data-id="${x.id}">${escapeHtml(clientName(x.clientId))} · ${escapeHtml(x.title || 'Untitled')}${x.plannedDate && x.plannedDate < today ? ` <span class="hint">· ${shortDate(x.plannedDate).split(',')[0]}</span>` : ''}</span>
      ${status(x)}
      ${withButton ? `<button class="btn small" data-action="mark-posted" data-id="${x.id}">Mark posted</button>` : ''}
    </div>`;
  const block = (title, list, body) => `
    <div class="td-block">
      <div class="td-title">${title}${list !== null ? ` <span class="badge">${list}</span>` : ''}</div>
      ${body}
    </div>`;

  const blocks = [];
  blocks.push(block('Post today', dueToday.length, dueToday.length ? dueToday.map(x => row(x, true)).join('') : '<p class="hint" style="margin:0">Nothing planned for today.</p>'));
  if (overdue.length) blocks.push(block('Overdue', overdue.length, overdue.slice(0, 6).map(x => row(x, true)).join('') + (overdue.length > 6 ? `<p class="hint" style="margin:4px 0 0">+${overdue.length - 6} more</p>` : '')));
  if (dueTomorrow.length) blocks.push(block('Tomorrow', dueTomorrow.length, dueTomorrow.map(x => row(x, false)).join('')));
  if (deadlines.length) blocks.push(block('Deadlines', deadlines.length, deadlines.map(({ x, d }) => `
    <div class="td-row">
      <span class="dot" style="--client:${x.clientId ? clientColor(x.clientId) : 'var(--border)'}"></span>
      <span class="td-tx" data-action="edit-script" data-id="${x.id}">${escapeHtml(x.title)}</span>
      <span class="pill dl-${d.level}">${escapeHtml(d.when.split(' · ')[0])}</span>
    </div>`).join('')));
  if (Object.keys(byOwner).length) blocks.push(block('Waiting on the team', null, Object.entries(byOwner).map(([name, o]) =>
    `<p class="today-note"><strong>${escapeHtml(name)}:</strong> ${o.n} open${o.late ? `, <span style="color:var(--danger)">${o.late} late</span>` : ''}</p>`).join('')));

  return `
    <div class="card today">
      <div class="today-head">
        <h2 style="margin:0">Today</h2>
        <span class="hint">${parseDate(today).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </div>
      <p class="td-week">This week: <strong>${postedWeek} of ${target}</strong> posted across all accounts</p>
      <div class="td-grid">${blocks.join('')}</div>
    </div>`;
}

// ---------- Dashboard: Work queue ----------

const QUEUE_TABS = [
  { id: 'to_shoot', label: 'To shoot', next: 'to_edit', button: 'Mark shot' },
  { id: 'to_edit', label: 'To edit', next: 'ready', button: 'Mark edited' },
  { id: 'ready', label: 'Ready', next: 'posted', button: 'Mark posted' }
];

function renderWorkQueue() {
  const today = todayStr();
  const filtered = Store.data.items.filter(x =>
    x.stage !== 'posted' &&
    (!state.queueClient || belongsTo(x, state.queueClient)) &&
    (!state.queueOwner || x.owner === state.queueOwner));
  const tab = QUEUE_TABS.find(t => t.id === state.queueTab) || QUEUE_TABS[1];
  const list = filtered.filter(x => x.stage === tab.id)
    .sort((a, b) => (a.plannedDate || '9999').localeCompare(b.plannedDate || '9999'));
  const active = Store.activeClients();

  const rows = list.slice(0, 30).map(item => {
    const late = item.plannedDate && item.plannedDate < today;
    return `
      <div class="list-item" style="--client:${clientColor(item.clientId)}">
        <div class="main" data-action="edit-item" data-id="${item.id}" style="cursor:pointer">
          <div class="title">${escapeHtml(item.title || 'Untitled')}</div>
          <div class="meta">
            ${typeBadge(item.type)}
            <span>${escapeHtml(clientName(item.clientId))}</span>
            ${collabBadge(item)}
            <span>${item.plannedDate ? 'Post ' + shortDate(item.plannedDate) : 'No date'}</span>
            ${ownerBadge(item.owner)}
            ${item.script ? lengthChip(item.script) : ''}
            ${late ? '<span class="badge overdue">Overdue</span>' : ''}
          </div>
        </div>
        <button class="btn small primary" data-action="queue-next" data-id="${item.id}" data-next="${tab.next}">${tab.button}</button>
      </div>`;
  }).join('');

  return `
    <div class="card queue-box">
      <div class="ready-head">
        <h2 style="margin:0">Work queue</h2>
        <div class="btn-row">
          <select data-change="queueClient" style="width:auto">${clientOptions(state.queueClient, true, 'All accounts')}</select>
          <select data-change="queueOwner" style="width:auto">${teamOptions(state.queueOwner, 'Everyone')}</select>
        </div>
      </div>
      <form id="queue-form" class="queue-form">
        <select name="clientId" required>${clientOptions(state.queueClient || state.queueLastClient || (active[0] || {}).id, false)}</select>
        <select name="type"><option value="reel">Reel</option><option value="post">Post</option></select>
        <select name="stage">${QUEUE_TABS.map(t => `<option value="${t.id}" ${t.id === state.queueTab ? 'selected' : ''}>${t.label}</option>`).join('')}</select>
        <input name="title" placeholder="What is it? e.g. Ragi laddu recipe reel" required>
        <input type="date" name="plannedDate" title="Posting date">
        <select name="owner">${teamOptions('', 'Who?')}</select>
        <button class="btn primary" type="submit">Add</button>
      </form>
      <div class="tabs">
        ${QUEUE_TABS.map(t => `<button class="tab ${t.id === tab.id ? 'active' : ''}" data-action="queue-tab" data-tab="${t.id}">${t.label} <span class="badge">${filtered.filter(x => x.stage === t.id).length}</span></button>`).join('')}
      </div>
      <div class="list">${rows || `<div class="empty">Nothing in "${tab.label}" right now.</div>`}</div>
      ${list.length > 30 ? `<p class="hint" style="margin-top:8px">Showing 30 of ${list.length}. Use the Pipeline page for everything.</p>` : ''}
    </div>`;
}

// ---------- Dashboard: Scripts board ----------

function renderScriptsBoard() {
  const ideas = Store.data.ideas.filter(x => !state.scriptClient || x.clientId === state.scriptClient || (x.collabWith || []).includes(state.scriptClient));
  const chips = [{ id: '', name: 'All' }, ...Store.data.clients.filter(c => c.status === 'active')].map(c =>
    `<button class="chip-btn ${state.scriptClient === c.id ? 'active' : ''}" data-action="script-filter" data-id="${c.id}">${c.id ? `<span class="dot" style="--client:${c.color}"></span>` : ''}${escapeHtml(c.name)}</button>`).join('');

  const nextButton = { raw: 'Start writing', writing: 'Script done', ready: 'Shoot done' };
  const card = x => {
    const linked = x.itemId ? Store.item(x.itemId) : null;
    const preview = (x.script || '').trim().split(/\n/)[0];
    return `
      <div class="sb-card" style="--client:${x.clientId ? clientColor(x.clientId) : 'var(--border)'}">
        <div class="sb-open" data-action="edit-script" data-id="${x.id}">
          <div class="sb-who">${x.clientId ? escapeHtml(clientName(x.clientId)) : 'Any account'} ${typeBadge(x.type || 'reel')} ${x.trending ? '<span class="badge trend">Trending</span>' : ''}</div>
          <div class="sb-title">${escapeHtml(x.title)}</div>
          ${(x.collabWith || []).length ? `<div class="sb-who">${collabBadge(x)}</div>` : ''}
          ${deadlineInfo(x) ? `<div class="sb-dl"><span class="pill dl-${deadlineInfo(x).level}">${escapeHtml(deadlineInfo(x).when)}</span><span class="pill dl-note">Closes ${shortDate(x.deadline).split(',')[1] || shortDate(x.deadline)}</span></div>` : ''}
          ${x.scriptStage !== 'shot' ? `<div class="sb-prev">${preview ? escapeHtml(preview.slice(0, 90)) : ''}</div>${lengthChip(x.script)}` : ''}
          ${x.scriptStage === 'shot' ? `<div class="sb-prev">${linked ? (linked.stage === 'posted' ? 'Posted ' + shortDate(linked.postedDate) : 'In work queue: ' + stageLabel(linked.stage)) : 'Shot'}</div>` : ''}
        </div>
        ${nextButton[x.scriptStage] ? `<button class="btn small sb-btn" data-action="script-next" data-id="${x.id}">${nextButton[x.scriptStage]}</button>` : ''}
      </div>`;
  };

  const cols = SCRIPT_STAGES.map(st => {
    let list = ideas.filter(x => x.scriptStage === st.id);
    list = list.sort((a, b) => {
      if (st.id === 'shot') return (b.shotAt || b.createdAt || '').localeCompare(a.shotAt || a.createdAt || '');
      const da = a.deadline || '9999', db = b.deadline || '9999';
      if (da !== db) return da.localeCompare(db);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    const open = state.scriptsOpen[st.id];
    const shown = open ? list : list.slice(0, 6);
    return `
      <div class="sb-col">
        <div class="sb-head"><span>${st.label}</span><span class="badge">${list.length}</span></div>
        ${shown.map(card).join('') || '<p class="hint">Nothing here</p>'}
        ${list.length > 6 ? `<button class="btn small" style="width:100%" data-action="script-more" data-col="${st.id}">${open ? 'Show less' : `Show ${list.length - 6} more`}</button>` : ''}
      </div>`;
  }).join('');

  const active = Store.activeClients();
  return `
    <div class="scripts-section">
      <div class="ready-head">
        <h2 style="margin:0">Scripts</h2>
        <div class="chip-row">${chips}</div>
      </div>
      <form id="script-form" class="script-form">
        <select name="clientId">${clientOptions(state.scriptClient || (active[0] || {}).id, true, 'Any account')}</select>
        <select name="type"><option value="reel">Reel</option><option value="post">Post</option></select>
        <input name="title" placeholder="New idea, e.g. 3 internships nobody talks about" required>
        <button class="btn primary" type="submit">Add idea</button>
      </form>
      <div class="sb-board">${cols}</div>
      <p class="hint" style="margin-top:8px">Length chip: green = 30-40 sec, amber = short, red = too long. Based on your speaking speed in Settings.</p>
    </div>`;
}

function openScriptForm(idea) {
  const x = Object.assign({ title: '', clientId: '', type: 'reel', script: '', notes: '', link: '', collabWith: [], owner: '', scriptStage: 'raw', trending: false }, idea);
  const html = `
    <form id="script-edit">
      <div class="grid-3">
        <div class="field"><label>Account</label><select name="clientId">${clientOptions(x.clientId, true, 'Any account')}</select></div>
        <div class="field"><label>Type</label><select name="type"><option value="reel" ${x.type === 'reel' ? 'selected' : ''}>Reel</option><option value="post" ${x.type === 'post' ? 'selected' : ''}>Post</option></select></div>
        <div class="field"><label>Stage</label><select name="scriptStage">${SCRIPT_STAGES.map(s => `<option value="${s.id}" ${s.id === x.scriptStage ? 'selected' : ''}>${s.label}</option>`).join('')}</select></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Title</label><input name="title" value="${escapeHtml(x.title)}" required></div>
        <div class="field"><label>Deadline (optional)</label><input type="date" name="deadline" value="${x.deadline || ''}" title="When the internship, course or offer closes"></div>
      </div>
      <p class="hint" id="deadline-hint" style="margin:-6px 0 10px"></p>
      <div class="field">
        <label style="display:flex;justify-content:space-between;align-items:center">Script <span id="script-len"></span></label>
        <textarea name="script" rows="10" placeholder="Hook (first 2 seconds)&#10;Main points&#10;Call to action">${escapeHtml(x.script)}</textarea>
      </div>
      <div class="grid-2">
        <div class="field"><label>Who's doing it</label><select name="owner">${teamOptions(x.owner)}</select></div>
        <div class="field"><label>Collab with</label><div class="collab-box" id="script-collab">${collabChecks(x.collabWith, x.clientId)}</div></div>
      </div>
      <div class="field"><label>Notes / reference link</label><textarea name="notes" rows="2">${escapeHtml([x.notes, x.link].filter(Boolean).join('\n'))}</textarea></div>
      <label class="check" style="margin-bottom:8px"><input type="checkbox" name="trending" ${x.trending ? 'checked' : ''}> Trending</label>
      <div class="modal-foot">
        <div>${x.id ? '<button type="button" class="btn danger" data-action="delete-script">Delete</button>' : ''}</div>
        <div class="btn-row">
          <button type="button" class="btn" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn primary">Save</button>
        </div>
      </div>
    </form>`;
  openModal(x.id ? 'Edit script' : 'New script', html, modal => {
    const form = modal.querySelector('#script-edit');
    bindLengthChip(form.elements.script, modal.querySelector('#script-len'));
    const dlHint = () => {
      const d = deadlineInfo({ deadline: form.elements.deadline.value, scriptStage: 'raw' });
      modal.querySelector('#deadline-hint').textContent = d ? `Post by ${shortDate(d.postBy)}, shoot by ${shortDate(d.shootBy)}.` : '';
    };
    form.elements.deadline.addEventListener('input', dlHint);
    dlHint();
    const checked = () => [...form.querySelectorAll('input[name="collabWith"]:checked')].map(i => i.value);
    form.elements.clientId.addEventListener('change', () => {
      modal.querySelector('#script-collab').innerHTML = collabChecks(checked().filter(id => id !== form.elements.clientId.value), form.elements.clientId.value);
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = form.elements;
      const saved = Object.assign({}, x, {
        id: x.id || uid(),
        title: f.title.value.trim(),
        clientId: f.clientId.value,
        type: f.type.value,
        scriptStage: f.scriptStage.value,
        script: f.script.value.trim(),
        owner: f.owner.value,
        collabWith: checked().filter(id => id !== f.clientId.value),
        notes: f.notes.value.trim(),
        link: '',
        deadline: f.deadline.value,
        trending: f.trending.checked,
        createdAt: x.createdAt || new Date().toISOString()
      });
      if (saved.scriptStage === 'shot' && x.scriptStage !== 'shot') {
        if (!shootDone(saved)) return;
      } else {
        Store.saveIdea(saved);
      }
      closeModal();
      toast('Script saved');
      render();
    });
    const del = modal.querySelector('[data-action="delete-script"]');
    if (del) del.addEventListener('click', () => {
      if (confirm('Delete this script?')) { Store.deleteIdea(x.id); closeModal(); render(); }
    });
  });
}

// Script is shot: create the content piece in the Work queue (To edit)
function shootDone(idea) {
  if (!idea.clientId) {
    toast('Pick which account this is for first');
    openScriptForm(idea);
    return false;
  }
  const item = {
    id: uid(),
    clientId: idea.clientId,
    type: idea.type || 'reel',
    title: idea.title,
    category: idea.category || '',
    stage: 'to_edit',
    plannedDate: '',
    postedDate: '',
    link: '',
    notes: idea.notes || '',
    script: idea.script || '',
    caption: '',
    hashtags: '',
    owner: idea.owner || '',
    collabWith: idea.collabWith || [],
    fromScript: idea.id,
    createdAt: new Date().toISOString()
  };
  Store.saveItem(item);
  idea.scriptStage = 'shot';
  idea.used = true;
  idea.itemId = item.id;
  idea.shotAt = new Date().toISOString();
  Store.saveIdea(idea);
  toast('Moved to Work queue: To edit');
  return true;
}

function bindQueueAndScripts() {
  const qf = document.getElementById('queue-form');
  if (qf) {
    qf.addEventListener('submit', e => {
      e.preventDefault();
      const f = qf.elements;
      state.queueLastClient = f.clientId.value;
      Store.saveItem({
        id: uid(), clientId: f.clientId.value, type: f.type.value, title: f.title.value.trim(),
        category: '', stage: f.stage.value, plannedDate: f.plannedDate.value, postedDate: '', link: '',
        notes: '', script: '', caption: '', hashtags: '', owner: f.owner.value, collabWith: [],
        createdAt: new Date().toISOString()
      });
      state.queueTab = f.stage.value;
      toast('Added to work queue');
      render();
    });
  }
  const sf = document.getElementById('script-form');
  if (sf) {
    sf.addEventListener('submit', e => {
      e.preventDefault();
      const f = sf.elements;
      Store.saveIdea({
        id: uid(), title: f.title.value.trim(), clientId: f.clientId.value, type: f.type.value,
        category: '', link: '', notes: '', script: '', owner: '', collabWith: [], trending: false,
        used: false, scriptStage: 'raw', createdAt: new Date().toISOString()
      });
      toast('Idea added');
      render();
    });
  }
  const tf = document.getElementById('trend-form');
  if (tf) {
    tf.addEventListener('submit', e => {
      e.preventDefault();
      const f = tf.elements;
      Store.saveTrend({
        id: uid(), url: f.url.value.trim(), audio: f.audio.value.trim(), genre: f.genre.value.trim(),
        notes: f.notes.value.trim(), addedAt: todayStr(), used: false
      });
      toast('Trend saved');
      render();
    });
  }
}

// ---------- Trends page ----------

function trendAge(t) {
  const days = Math.round((parseDate(todayStr()) - parseDate(t.addedAt || todayStr())) / 86400000);
  if (days < 7) return { cls: 'fresh', label: 'Fresh' };
  if (days < 14) return { cls: 'ageing', label: 'Ageing' };
  return { cls: 'old', label: 'Old' };
}

function renderTrends() {
  const genres = [...new Set([...DEFAULT_GENRES, ...Store.data.trends.map(t => t.genre).filter(Boolean)])];
  const list = Store.data.trends
    .filter(t => !state.trendGenre || t.genre === state.trendGenre)
    .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
  const rows = list.map(t => {
    const age = trendAge(t);
    return `
      <div class="list-item ${t.used ? 'faded' : ''}">
        <div class="main">
          <div class="title">${escapeHtml(t.audio || 'Trend')}</div>
          <div class="meta">
            <span class="badge age-${age.cls}">${age.label}</span>
            ${t.genre ? `<span class="badge">${escapeHtml(t.genre)}</span>` : ''}
            <span>Added ${shortDate(t.addedAt)}</span>
            ${t.url ? `<a href="${escapeHtml(t.url)}" target="_blank" rel="noopener">Open reel</a>` : ''}
            ${t.used ? '<span>Used</span>' : ''}
          </div>
          ${t.notes ? `<div class="hint" style="margin-top:4px">${escapeHtml(t.notes)}</div>` : ''}
        </div>
        <div class="btn-row">
          ${t.used ? '' : `<button class="btn small primary" data-action="trend-use" data-id="${t.id}">Use this</button>`}
          <button class="btn small danger" data-action="trend-delete" data-id="${t.id}">Delete</button>
        </div>
      </div>`;
  }).join('');
  return `
    <div class="page-head">
      <div>
        <h1>Trends</h1>
        <p class="sub">Trending reels and audio worth copying, sorted by genre. Trends go stale fast, so use the fresh ones first.</p>
      </div>
    </div>
    <datalist id="trend-genres">${genres.map(g => `<option value="${escapeHtml(g)}">`).join('')}</datalist>
    <form id="trend-form" class="card" style="margin-bottom:20px">
      <div class="grid-3">
        <div class="field" style="grid-column: span 2"><label>Reel or audio link</label><input name="url" placeholder="https://www.instagram.com/reel/..."></div>
        <div class="field"><label>Genre</label><input name="genre" list="trend-genres" placeholder="Education" required></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Audio / trend name</label><input name="audio" placeholder="Name of the sound or format" required></div>
        <div class="field"><label>Why it works</label><input name="notes" placeholder="Hook in first 2 sec, text overlay"></div>
      </div>
      <div class="btn-row" style="justify-content:flex-end"><button class="btn primary" type="submit">Save trend</button></div>
    </form>
    <div class="chip-row" style="margin-bottom:16px">
      ${['', ...genres].map(g => `<button class="chip-btn ${state.trendGenre === g ? 'active' : ''}" data-action="trend-genre" data-genre="${escapeHtml(g)}">${g ? escapeHtml(g) : 'All'}</button>`).join('')}
    </div>
    <div class="list">${rows || '<div class="empty">No trends saved yet. Send Claude your links and they can be added in one go.</div>'}</div>`;
}


// ---------- Weekly plan vs actual ----------

// For one account and one week: each planned slot with a tick if something of
// that type went up that day, plus anything posted that wasn't in the plan.
function planVsActual(c, weekStart) {
  const days = [];
  for (let d = 0; d < 7; d++) {
    const date = addDays(weekStart, d);
    const slots = (c.template || []).filter(sl => Number(sl.day) === d);
    const posted = Store.data.items.filter(x => x.stage === 'posted' && x.postedDate === date && belongsTo(x, c.id));
    const left = { reel: posted.filter(x => x.type === 'reel').length, post: posted.filter(x => x.type === 'post').length };
    const rows = slots.map(sl => {
      const t = sl.type === 'post' ? 'post' : 'reel';
      const done = left[t] > 0;
      if (done) left[t]--;
      return { label: sl.label || 'Planned', type: t, done };
    });
    days.push({ date, rows, extra: left.reel + left.post });
  }
  return days;
}

function planGridHtml(c, weekStart, compact) {
  const today = todayStr();
  return planVsActual(c, weekStart).map((day, i) => {
    const future = day.date > today;
    const rows = day.rows.map(r => `<div class="pg-slot ${r.done ? 'done' : future ? 'future' : 'miss'}">
        <span class="pg-mark">${r.done ? '&#10003;' : future ? '' : '&#10007;'}</span>${escapeHtml(r.label)}${compact ? '' : ` <span class="hint">${r.type === 'post' ? 'post' : 'reel'}</span>`}</div>`).join('');
    const extra = day.extra ? `<div class="pg-extra">+${day.extra} extra posted</div>` : '';
    return `<div class="pg-day ${day.date === today ? 'today' : ''}">
      ${compact ? '' : `<div class="pg-head">${WEEK_DAYS[i]} <span class="hint">${parseDate(day.date).getDate()}</span></div>`}
      ${rows || (day.extra ? '' : '<div class="pg-empty">-</div>')}${extra}
    </div>`;
  }).join('');
}

function weekNav(stateKey, label) {
  const start = addDays(startOfWeek(todayStr()), 7 * state[stateKey]);
  return `<div class="cal-head">
      <button class="btn small" data-action="week-nav" data-key="${stateKey}" data-step="-1" aria-label="Previous week">&lt;</button>
      <div class="month" style="min-width:150px;font-size:14px">${label || ''}${shortDate(start).split(',')[1] || ''} - ${shortDate(addDays(start, 6)).split(',')[1] || ''}</div>
      <button class="btn small" data-action="week-nav" data-key="${stateKey}" data-step="1" aria-label="Next week">&gt;</button>
      ${state[stateKey] ? `<button class="btn small" data-action="week-nav" data-key="${stateKey}" data-step="0">This week</button>` : ''}
    </div>`;
}

function renderWeekPlan() {
  const weekStart = addDays(startOfWeek(todayStr()), 7 * state.calWeek);
  const today = todayStr();
  const accounts = Store.activeClients().filter(c => !state.calClient || c.id === state.calClient);
  const head = WEEK_DAYS.map((d, i) => {
    const date = addDays(weekStart, i);
    return `<div class="wp-h ${date === today ? 'today' : ''}">${d} <span class="hint">${parseDate(date).getDate()}</span></div>`;
  }).join('');
  const rows = accounts.map(c => {
    const plan = planVsActual(c, weekStart);
    const cells = plan.map(day => {
      const planned = Store.data.items.filter(x => x.stage !== 'posted' && x.plannedDate === day.date && belongsTo(x, c.id));
      const slots = day.rows.map(r => `<div class="pg-slot ${r.done ? 'done' : day.date > today ? 'future' : 'miss'}"><span class="pg-mark">${r.done ? '&#10003;' : day.date > today ? '' : '&#10007;'}</span>${escapeHtml(r.label)}</div>`).join('');
      const pieces = planned.map(x => `<div class="chip" style="--client:${c.color}" data-action="edit-item" data-id="${x.id}" title="${escapeHtml(x.title)}"><span class="t">${x.type === 'reel' ? 'R' : 'P'}</span><span class="label">${escapeHtml(x.title)}</span></div>`).join('');
      const extra = day.extra ? `<div class="pg-extra">+${day.extra} posted</div>` : '';
      return `<div class="wp-cell" data-action="new-item-on" data-date="${day.date}" data-client="${c.id}">${slots}${pieces}${extra}</div>`;
    }).join('');
    return `<div class="wp-name"><span class="dot" style="--client:${c.color}"></span><a href="#client/${c.id}" class="client-link">${escapeHtml(c.name)}</a></div>${cells}`;
  }).join('');
  return `
    <div class="page-head">
      <div>
        <h1>Week plan</h1>
        <p class="sub">Each account's weekly plan with what actually went up. Reference only. Click a cell to add a piece on that day.</p>
      </div>
      <div class="btn-row">
        <div class="seg"><button data-action="cal-mode" data-mode="month">Month</button><button class="active" data-action="cal-mode" data-mode="week">Week plan</button></div>
        <select data-change="calClient" style="width:auto">${clientOptions(state.calClient, true)}</select>
        ${weekNav('calWeek')}
      </div>
    </div>
    <div class="wp-grid">
      <div class="wp-h"></div>${head}
      ${rows || '<div class="empty" style="grid-column:1/-1">No active accounts.</div>'}
    </div>
    <div class="legend">
      <span><span class="pg-slot done" style="display:inline-flex"><span class="pg-mark">&#10003;</span>planned, went up</span></span>
      <span><span class="pg-slot miss" style="display:inline-flex"><span class="pg-mark">&#10007;</span>planned, didn't go up</span></span>
      <span>Coloured chips = pieces you've added for that day</span>
    </div>`;
}

function renderCalendar() {
  if (state.calMode === 'week') return renderWeekPlan();
  const [y, m] = state.calMonth.split('-').map(Number);
  const first = toDateStr(new Date(y, m - 1, 1));
  const gridStart = startOfWeek(first);
  const today = todayStr();

  const items = Store.data.items.filter(x => !state.calClient || belongsTo(x, state.calClient));
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
        <div class="seg"><button class="active" data-action="cal-mode" data-mode="month">Month</button><button data-action="cal-mode" data-mode="week">Week plan</button></div>
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
  const items = Store.data.items.filter(x => !state.pipeClient || belongsTo(x, state.pipeClient));
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
  if (state.histClient) posted = posted.filter(x => belongsTo(x, state.histClient));
  if (state.histType) posted = posted.filter(x => x.type === state.histType);
  if (state.histMonth) posted = posted.filter(x => (x.postedDate || '').startsWith(state.histMonth));
  posted.sort((a, b) => (b.postedDate || '').localeCompare(a.postedDate || ''));

  const reels = posted.filter(x => x.type === 'reel').length;
  const posts = posted.length - reels;

  const rows = posted.map(item => `
    <tr class="clickable" data-action="edit-item" data-id="${item.id}">
      <td>${prettyDate(item.postedDate).replace(/ \d{4}$/, '')}</td>
      <td class="hide-mobile"><span class="dot" style="--client:${clientColor(item.clientId)}"></span> ${escapeHtml(clientName(item.clientId))}</td>
      <td>${typeBadge(item.type)}</td>
      <td class="hist-title">${escapeHtml(item.title)}</td>
      <td class="hide-mobile">${escapeHtml(item.category || '')}</td>
      <td>${platformRows(item)}</td>
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
      <div class="table-wrap"><table>
        <thead><tr><th>Date</th><th class="hide-mobile">Client</th><th>Type</th><th>Title</th><th class="hide-mobile">Category</th><th>Platforms</th><th class="hide-mobile">Link</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>` : '<div class="empty">Nothing posted yet for this filter.</div>'}`;
}

function renderClients() {
  const cards = Store.data.clients.map(c => {
    const n = Calc.counts(c.id);
    return `
      <div class="card client-card" style="--client:${c.color}">
        <div class="head">
          <h3 style="margin:0"><a href="#client/${c.id}" class="client-link">${escapeHtml(c.name)}</a></h3>
          <span class="btn-row" style="gap:4px">${c.kind === 'brand' ? '<span class="badge brand">Own brand</span>' : ''}<span class="badge ${c.status}">${c.status === 'active' ? 'Active' : 'Paused'}</span></span>
        </div>
        ${(c.template || []).length ? `<p class="hint">Weekly plan: ${c.template.length} slots</p>` : ''}
        <p class="hint">${plural(c.reelsPerWeek, 'reel')} + ${plural(c.postsPerWeek, 'post')} per week. Shoot every ${c.shootEveryDays} days.</p>
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
        <h1>Clients and brands</h1>
        <p class="sub">Weekly targets, templates, categories and shoot rhythm for each account.</p>
      </div>
      <button class="btn primary" data-action="new-client">Add client or brand</button>
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
    kind: 'client',
    categories: [],
    hashtags: '',
    template: [],
    notes: ''
  };
  const slotRow = sl => `
    <div class="slot-row" data-slot="${sl.id || uid()}">
      <select name="slotDay">${WEEK_DAYS.map((d, i) => `<option value="${i}" ${Number(sl.day) === i ? 'selected' : ''}>${d}</option>`).join('')}</select>
      <select name="slotType"><option value="reel" ${sl.type !== 'post' ? 'selected' : ''}>Reel</option><option value="post" ${sl.type === 'post' ? 'selected' : ''}>Post</option></select>
      <input name="slotLabel" value="${escapeHtml(sl.label || '')}" placeholder="e.g. Internship reel">
      <select name="slotOwner">${teamOptions(sl.owner, 'Who?')}</select>
      <select name="slotCollab"><option value="">No collab</option>${Store.data.clients.filter(x => x.id !== c.id).map(x => `<option value="${x.id}" ${sl.collabWith === x.id ? 'selected' : ''}>Collab: ${escapeHtml(x.name)}</option>`).join('')}</select>
      <button type="button" class="btn small danger" data-slot-remove aria-label="Remove slot">&times;</button>
    </div>`;
  const html = `
    <form id="client-form">
      <div class="grid-3">
        <div class="field">
          <label>Name</label>
          <input name="name" value="${escapeHtml(c.name)}" required>
        </div>
        <div class="field">
          <label>Type</label>
          <select name="kind">
            <option value="client" ${c.kind !== 'brand' ? 'selected' : ''}>Client</option>
            <option value="brand" ${c.kind === 'brand' ? 'selected' : ''}>Own brand</option>
          </select>
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
        <textarea name="categories" rows="5">${escapeHtml((c.categories || []).join('\n'))}</textarea>
      </div>
      <div class="field">
        <label>Platforms this account posts on</label>
        <div class="collab-box">${PLATFORMS.map(p => `<label class="check collab-check"><input type="checkbox" name="platforms" value="${p.id}" ${(c.platforms || ['ig']).includes(p.id) ? 'checked' : ''}> ${p.label}</label>`).join('')}</div>
      </div>
      <div class="field">
        <label>Saved hashtags</label>
        <input name="hashtags" value="${escapeHtml(c.hashtags || '')}" placeholder="#nutrition #healthyfood #vizag">
      </div>
      <div class="field">
        <label>Weekly plan (reference only)</label>
        <p class="hint" style="margin:0 0 8px">What usually goes out on which day. It's only for reference: nothing is created from it and it never shows as overdue. You'll see plan vs actual on this account's page.</p>
        <div id="slot-list">${(c.template || []).map(slotRow).join('')}</div>
        <button type="button" class="btn small" id="slot-add">Add slot</button>
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

  openModal(isNew ? 'New account' : 'Edit account', html, modal => {
    const form = modal.querySelector('#client-form');
    const slotList = modal.querySelector('#slot-list');
    modal.querySelector('#slot-add').addEventListener('click', () => {
      slotList.insertAdjacentHTML('beforeend', slotRow({ id: uid(), day: 0, type: 'reel', label: '', owner: '', collabWith: '' }));
    });
    slotList.addEventListener('click', e => {
      if (e.target.closest('[data-slot-remove]')) e.target.closest('.slot-row').remove();
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = form.elements;
      const template = [...slotList.querySelectorAll('.slot-row')].map(row => ({
        id: row.dataset.slot,
        day: Number(row.querySelector('[name="slotDay"]').value),
        type: row.querySelector('[name="slotType"]').value,
        label: row.querySelector('[name="slotLabel"]').value.trim() || 'Planned content',
        owner: row.querySelector('[name="slotOwner"]').value,
        collabWith: row.querySelector('[name="slotCollab"]').value
      }));
      Store.saveClient(Object.assign({}, c, {
        kind: f.kind.value,
        platforms: [...form.querySelectorAll('input[name="platforms"]:checked')].map(x => x.value),
        hashtags: f.hashtags.value.trim(),
        template,
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
      toast(isNew ? 'Account added' : 'Saved');
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
        <p class="hint">${d.clients.length} accounts, ${d.items.length} content pieces, ${d.ideas.length} ideas and scripts, ${d.footage.length} clips, ${d.trends.length} trends.</p>
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
          <div class="field">
            <label>My speaking speed (words per second)</label>
            <input type="number" min="1" max="5" step="0.1" name="speakingSpeed" value="${d.settings.speakingSpeed}">
            <p class="hint" style="margin-top:4px">Used for the script length timer. To measure it: count the words in one of your reels and divide by its length in seconds. Most people are around 2.5.</p>
          </div>
          <div class="field">
            <label>Deadline scripts: post this many days before the deadline</label>
            <input type="number" min="0" max="14" name="postBuffer" value="${d.settings.postBuffer}">
          </div>
          <div class="field">
            <label>Team (one name per line)</label>
            <textarea name="team" rows="5">${escapeHtml((d.settings.team || []).join('\n'))}</textarea>
            <p class="hint" style="margin-top:4px">Names you can tag on content. Just labels for your own tracking. Removing a name clears it from open pieces and plans.</p>
          </div>
          <button class="btn primary" type="submit">Save settings</button>
        </form>
        <hr style="border:none;border-top:1px solid var(--border);margin:20px 0">
        <h3>Start over</h3>
        <p class="hint">Deletes everything and puts back the starting accounts.</p>
        <button class="btn danger" data-action="reset">Reset app</button>
      </div>
    </div>`;
}


// ---------- Single client page ----------

function renderClientDetail() {
  const c = Store.client(state.clientId);
  if (!c) return renderClients();
  const today = todayStr();
  const items = Store.data.items.filter(x => belongsTo(x, c.id));
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
        <p class="sub">Target ${plural(c.reelsPerWeek, 'reel')} + ${plural(c.postsPerWeek, 'post')} a week${firstDate ? ` · Posting since ${prettyDate(firstDate)}` : ''}</p>
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

    <div class="card" style="margin-bottom:24px">
      <div class="ready-head">
        <h2 style="margin:0">Weekly plan <span class="hint" style="font-weight:400;font-size:13px">reference only</span></h2>
        <div class="btn-row">${(c.template || []).length ? weekNav('planWeek') : ''}<button class="btn small" data-action="edit-client" data-id="${c.id}">Edit plan</button></div>
      </div>
      ${(c.template || []).length
        ? `<div class="pg-grid">${planGridHtml(c, addDays(startOfWeek(today), 7 * state.planWeek))}</div>
           <p class="hint" style="margin:8px 0 0">&#10003; = something of that type went up that day, &#10007; = it didn't. Doesn't affect the Dashboard.</p>`
        : '<p class="hint" style="margin:0">No weekly plan yet. Click "Edit plan" to note what usually goes out on which day.</p>'}
    </div>

    <div class="two-col" style="margin-bottom:24px">
      <div>
        <h2>Last 8 weeks</h2>
        <div class="table-wrap"><table>
          <thead><tr><th>Week starting</th><th>Reels</th><th>Posts</th></tr></thead>
          <tbody>${weeks.map(w => `<tr><td>${shortDate(w.start)}</td>${w.before ? '<td class="hint">-</td><td class="hint">-</td>' : cell(w.reels, c.reelsPerWeek) + cell(w.posts, c.postsPerWeek)}</tr>`).join('')}</tbody>
        </table></div>
        <p class="hint" style="margin-top:6px">Green = target met, amber = partly, red = nothing posted.</p>
      </div>
      <div>
        <h2>Month by month</h2>
        ${monthRows ? `<div class="table-wrap"><table><thead><tr><th>Month</th><th>Reels</th><th>Posts</th><th>Total</th></tr></thead><tbody>${monthRows}</tbody></table></div>` : '<div class="empty">Nothing posted yet.</div>'}
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
        ${crossPostSummary(c, posted)}
        <div class="list">${posted.length ? posted.filter(i => !state.pfMissing || !isPostedOn(i, c.id, state.pfMissing)).map(i => itemRow(i, i.link ? `<a href="${escapeHtml(i.link)}" target="_blank" rel="noopener" data-stop>Open on Instagram</a>` : '')).join('') : '<div class="empty">Nothing posted yet.</div>'}</div>
      </div>
    </div>`;
}

function crossPostSummary(c, posted) {
  const list = PLATFORMS.filter(p => (c.platforms || []).includes(p.id));
  if (!list.length || !posted.length) return '';
  const since = addDays(todayStr(), -30);
  const recent = posted.filter(i => i.postedDate >= since);
  const stats = list.map(p => {
    const n = recent.filter(i => isPostedOn(i, c.id, p.id)).length;
    const full = recent.length && n === recent.length;
    return `<span class="pf-stat ${full ? 'full' : ''}">${p.label} <strong>${n}/${recent.length}</strong></span>`;
  }).join('');
  const chips = [{ id: '', label: 'All' }, ...list.filter(p => p.id !== 'ig').map(p => ({ id: p.id, label: 'Not on ' + p.label + ' yet' }))]
    .map(p => `<button class="chip-btn ${state.pfMissing === p.id ? 'active' : ''}" data-action="pf-filter" data-pf="${p.id}">${p.label}</button>`).join('');
  return `<div class="card" style="margin-bottom:12px;padding:12px">
      <div class="hint" style="margin-bottom:6px">Last 30 days, posted on each platform</div>
      <div class="pf-stats">${stats}</div>
      ${list.length > 1 ? `<div class="chip-row" style="margin-top:10px">${chips}</div>` : ''}
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
  trends: renderTrends,
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
    if (state.clientId !== view.slice(7)) { state.planWeek = 0; state.pfMissing = ''; }
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

  bindQueueAndScripts();

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
      const sf = settingsForm.elements;
      Store.data.settings.shootLeadDays = Number(sf.shootLeadDays.value) || 0;
      Store.data.settings.speakingSpeed = Math.min(5, Math.max(1, Number(sf.speakingSpeed.value) || 2.5));
      const newTeam = sf.team.value.split('\n').map(x => x.trim()).filter(Boolean);
      const removed = (Store.data.settings.team || []).filter(n => !newTeam.includes(n));
      Store.removeTeamNames(removed);
      Store.data.settings.team = newTeam;
      const pb = Number(sf.postBuffer.value);
      Store.data.settings.postBuffer = isNaN(pb) ? 3 : Math.max(0, Math.min(14, pb));
      Store.save();
      toast('Settings saved');
      render();
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
      openItemForm({ plannedDate: el.dataset.date, clientId: el.dataset.client || state.calClient || undefined });
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
      const newId = uid();
      idea.used = true;
      idea.scriptStage = 'shot';
      idea.itemId = newId;
      idea.shotAt = new Date().toISOString();
      Store.saveIdea(idea);
      render();
      openItemForm({
        id: undefined,
        presetId: newId,
        title: idea.title,
        clientId: idea.clientId || undefined,
        type: idea.type || 'reel',
        category: idea.category,
        script: idea.script || '',
        collabWith: idea.collabWith || [],
        owner: idea.owner || '',
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
    case 'toggle-platform': {
      const item = Store.item(id);
      if (!item) break;
      const a = el.dataset.acct, pf = el.dataset.pf;
      item.crossPost = item.crossPost || {};
      item.crossPost[a] = Object.assign({}, item.crossPost[a]);
      item.crossPost[a][pf] = !item.crossPost[a][pf];
      Store.saveItem(item);
      render();
      break;
    }
    case 'pf-filter':
      state.pfMissing = el.dataset.pf || '';
      render();
      break;
    case 'week-nav': {
      const key = el.dataset.key;
      const step = Number(el.dataset.step);
      state[key] = step === 0 ? 0 : state[key] + step;
      render();
      break;
    }
    case 'cal-mode':
      state.calMode = el.dataset.mode;
      render();
      break;
    case 'queue-tab':
      state.queueTab = el.dataset.tab;
      render();
      break;
    case 'queue-next':
      moveItem(id, el.dataset.next);
      break;
    case 'script-filter':
      state.scriptClient = id || '';
      render();
      break;
    case 'script-more':
      state.scriptsOpen[el.dataset.col] = !state.scriptsOpen[el.dataset.col];
      render();
      break;
    case 'edit-script': {
      const idea = Store.data.ideas.find(x => x.id === id);
      if (idea) openScriptForm(Object.assign({}, idea));
      break;
    }
    case 'script-next': {
      const idea = Store.data.ideas.find(x => x.id === id);
      if (!idea) break;
      if (idea.scriptStage === 'raw') {
        idea.scriptStage = 'writing';
        Store.saveIdea(idea);
        render();
        openScriptForm(Object.assign({}, idea));
      } else if (idea.scriptStage === 'writing') {
        idea.scriptStage = 'ready';
        Store.saveIdea(idea);
        toast('Script ready to shoot');
        render();
      } else if (idea.scriptStage === 'ready') {
        if (shootDone(idea)) render();
      }
      break;
    }
    case 'trend-genre':
      state.trendGenre = el.dataset.genre || '';
      render();
      break;
    case 'trend-use': {
      const t = Store.data.trends.find(x => x.id === id);
      if (!t) break;
      t.used = true;
      Store.saveTrend(t);
      Store.saveIdea({
        id: uid(), title: t.audio || 'Trend idea', clientId: '', type: 'reel', category: 'Trend-Led',
        link: t.url || '', notes: t.notes || '', script: '', owner: '', collabWith: [], trending: true,
        used: false, scriptStage: 'raw', createdAt: new Date().toISOString()
      });
      toast('Added to Scripts as a raw idea');
      render();
      break;
    }
    case 'trend-delete':
      if (confirm('Delete this trend?')) { Store.deleteTrend(id); render(); }
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
  Store.cleanupTemplateItems();
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
