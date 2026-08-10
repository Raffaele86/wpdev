// wpdev GUI — renderer: parla SOLO con l'API di wpdevd (nessuna logica propria).
// Unica eccezione, decisa esplicitamente: le classi assegnate a mano ai siti e
// vivono in localStorage, perché sono una preferenza di visualizzazione e
// l'engine non ha (né deve avere) un campo per esse.
const API = 'http://127.0.0.1:9700';
const $ = (sel) => document.querySelector(sel);

const CLASSES = [
  { id: 'prospect', label: 'prospect' },
  { id: 'proprio',  label: 'proprio' },
  { id: 'test',     label: 'test' },
];
const UNCLASSED = 'non classificato';
const LS_LABELS = 'wpdev.labels';

const state = {
  sites: [],
  detail: null,        // dettaglio del sito selezionato
  selected: null,      // slug
  tab: 'panoramica',
  query: '',
  busy: false,
  loaded: false,       // prima lettura completata
  daemonDown: false,
  revealed: new Set(), // segreti scoperti, per sito+campo
  labels: loadLabels(),
};

// firme di render: il polling ogni 4s non deve toccare il DOM se nulla è cambiato,
// altrimenti focus, scroll e testo digitato muoiono ogni 4 secondi.
const sig = { index: null, head: null, tabs: null, content: null, rail: null };

// I rail portano dati veri, non ornamento: identificativo del sito aperto e
// segnale d'anomalia. Stanno fuori dalle firme degli altri blocchi.
function renderRail() {
  const anomaly = state.daemonDown || (state.loaded && state.sites.some((x) => !isUp(x)));
  const code = state.daemonDown ? 'daemon giù' : (state.detail?.id || ':9700');
  const key = `${anomaly}|${code}`;
  if (key === sig.rail) return;
  sig.rail = key;
  document.querySelector('#railCode').textContent = code;
  const r = document.querySelector('#railSig');
  r.querySelector('use').setAttribute('href', anomaly ? '#i-warn' : '#i-reticle');
  r.style.color = anomaly ? 'var(--risk)' : '';
}

function loadLabels() {
  try { return JSON.parse(localStorage.getItem(LS_LABELS)) || {}; }
  catch { return {}; }
}
function saveLabels() {
  try { localStorage.setItem(LS_LABELS, JSON.stringify(state.labels)); } catch { /* quota: pazienza */ }
}

// ---------------------------------------------------------------- helpers ---
async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `API ${res.status}`);
  return data;
}

// Operazione lunga NDJSON: i log scorrono nella console in basso.
async function apiOp(method, path, body) {
  const con = $('#console'), out = $('#conBody');
  con.classList.add('show');
  out.textContent = '';
  state.busy = true; invalidate(); renderAll();
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `API ${res.status}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', final = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line) continue;
        const evt = JSON.parse(line);
        if (evt.event === 'log') { appendCon(`› ${evt.msg}\n`); }
        else if (evt.event === 'error') throw new Error(evt.message);
        else if (evt.event === 'done') final = evt.result;
      }
    }
    appendCon('■ fatto\n', 'ok');
    return final;
  } catch (err) {
    appendCon(`■ errore: ${err.message}\n`, 'bad');
    throw err;
  } finally {
    state.busy = false;
    await refresh();
  }
}

function appendCon(text, cls) {
  const out = $('#conBody');
  if (cls) {
    const s = document.createElement('span');
    s.className = cls; s.textContent = text; out.appendChild(s);
  } else {
    out.appendChild(document.createTextNode(text));
  }
  out.scrollTop = out.scrollHeight;
}

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function copy(text) { window.wpdev.copy(text); toast('copiato'); }
function openExt(url) { window.wpdev.openUrl(url); }
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function invalidate() { sig.index = sig.head = sig.tabs = sig.content = sig.rail = null; }

// stato runtime → parola e classe del punto
function isUp(s) { return s.status === 'running' && !!s.fpm; }
function stateWord(s) { return s.status === 'running' ? (s.fpm ? 'operativo' : 'fpm giù') : 'fermo'; }
function dotClass(s) { return s.status === 'running' ? (s.fpm ? 'on' : 'err') : 'off'; }
function nameOf(s) { return s.name || s.slug; }
function classOf(slug) { return state.labels[slug] || ''; }
// "Barber Bronx" e "barber-bronx" sono la stessa parola: ripeterla è rumore
const bare = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
function sameWord(a, b) { return bare(a) === bare(b); }

// evidenzia il tratto cercato senza mai iniettare HTML non filtrato
function hi(text, q) {
  const t = String(text ?? '');
  if (!q) return esc(t);
  const i = t.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(t);
  return esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length));
}

function matches(s, q) {
  if (!q) return true;
  const n = q.toLowerCase();
  return String(s.slug).toLowerCase().includes(n) || String(s.name ?? '').toLowerCase().includes(n);
}

function site() { return state.sites.find((s) => s.slug === state.selected) ?? null; }

// lista piatta dei siti visibili, nell'ordine in cui compaiono (serve alle frecce)
function visibleSlugs() {
  return groupsOf().flatMap((g) => g.items.map((s) => s.slug));
}

function groupsOf() {
  const q = state.query.trim();
  const list = state.sites.filter((s) => matches(s, q));
  const byName = (a, b) => nameOf(a).localeCompare(nameOf(b), 'it');
  if (q) return [{ key: 'risultati', items: list.sort(byName) }];
  const out = [];
  for (const c of CLASSES) {
    const items = list.filter((s) => classOf(s.slug) === c.id).sort(byName);
    if (items.length) out.push({ key: c.label, items });
  }
  const rest = list.filter((s) => !CLASSES.some((c) => c.id === classOf(s.slug))).sort(byName);
  if (rest.length) out.push({ key: UNCLASSED, items: rest });
  return out;
}

// ------------------------------------------------------------ dialoghi ---
// Dialoghi in-mondo: confirm()/prompt() nativi bloccano e spezzano il linguaggio.
function askDialog({ title, body, label, placeholder, value = '', confirmText, danger }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    const hasInput = label !== undefined;
    // la banda a strisce marca il rischio: solo il dialog distruttivo la porta,
    // altrimenti "elimina" e "crea" si somigliano proprio dove non devono
    if (danger) dlg.className = 'danger';
    dlg.innerHTML =
      (danger ? '<div class="dlg-hz"></div>' : '') + '<div class="dlg-in">' +
      `<div class="dlg-title">${esc(title)}</div>` +
      (body ? `<p class="prose" style="margin-top:10px">${body}</p>` : '') +
      (hasInput
        ? `<label class="lbl" for="dlgIn">${esc(label)}</label>` +
          `<input id="dlgIn" placeholder="${esc(placeholder ?? '')}" autocomplete="off" spellcheck="false">`
        : '') +
      '<div class="dlg-actions">' +
      '<button data-x="c" class="quiet">annulla</button>' +
      `<button data-x="o" class="${danger ? 'risk' : 'primary'}">${esc(confirmText ?? 'ok')}</button>` +
      '</div></div>';
    document.body.appendChild(dlg);
    const input = dlg.querySelector('#dlgIn');
    if (input) input.value = value;
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.querySelector('[data-x="c"]').onclick = () => done(null);
    dlg.querySelector('[data-x="o"]').onclick = () => done(hasInput ? (input.value.trim() || null) : true);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') dlg.querySelector('[data-x="o"]').click(); });
    dlg.showModal();
    // su un'azione irreversibile il fuoco va su «annulla»: un Invio distratto
    // non deve poter cancellare un sito
    (input ?? dlg.querySelector(danger ? '[data-x="c"]' : '[data-x="o"]')).focus();
  });
}

// ------------------------------------------------------------- render ---
function renderIndex() {
  const groups = groupsOf();
  const q = state.query.trim();
  const s = JSON.stringify([
    state.selected, q, state.daemonDown, state.loaded,
    groups.map((g) => [g.key, g.items.map((x) => [x.slug, x.name, x.status, x.fpm, x.shareUrl, classOf(x.slug)])]),
  ]);
  if (s === sig.index) return;
  sig.index = s;

  const list = $('#indexList');
  const total = state.sites.length;
  $('#fleetVer').textContent = state.daemonDown ? '––' : String(total);
  $('#indexCount').textContent = !state.loaded ? ''
    : q ? `${groups.reduce((n, g) => n + g.items.length, 0)} / ${total}` : String(total);

  if (!state.loaded) {
    list.innerHTML = '<div style="padding:14px 12px"><div class="skel a"></div><div class="skel b"></div>' +
      '<div class="skel c"></div><div class="skel b"></div><div class="skel a"></div></div>';
    return;
  }
  if (state.daemonDown) {
    list.innerHTML = '<div style="padding:16px 12px" class="lbl q">nessuna lettura</div>';
    return;
  }
  if (!groups.length) {
    list.innerHTML = q
      ? '<div style="padding:16px 12px"><div class="lbl q">nessuna corrispondenza</div>' +
        `<p style="margin-top:8px;font:400 11.5px/1.5 var(--font-text);color:var(--dim)">` +
        `Nessuno dei ${state.sites.length} siti contiene «${esc(q)}» nel nome o nello slug. ` +
        'Svuota la ricerca con Esc, o creane uno nuovo.</p></div>'
      : '<div style="padding:16px 12px" class="lbl q">flotta vuota</div>';
    list.removeAttribute('aria-activedescendant');
    return;
  }

  // il cursore: il sito selezionato, oppure — mentre si cerca — il primo
  // risultato, così si vede subito su cosa cadrà INVIO
  const cursor = state.selected || (q ? (groups[0]?.items[0]?.slug ?? null) : null);

  list.innerHTML = groups.map((g) =>
    '<div class="grp">' +
    `<div class="grp-head"><span class="lbl">${esc(g.key)}</span><span class="bar"></span>` +
    `<span class="n">${g.items.length}</span></div>` +
    g.items.map((x) =>
      `<div class="row${x.slug === state.selected ? ' sel brk' : (x.slug === cursor ? ' cur brk' : '')}" ` +
      `data-slug="${esc(x.slug)}" id="row-${esc(x.slug)}" role="option" ` +
      `aria-selected="${x.slug === state.selected}">` +
      `<span class="dot ${dotClass(x)}" title="${esc(stateWord(x))}"></span>` +
      '<span class="rowtext">' +
      `<span class="nm">${hi(nameOf(x), q)}</span>` +
      // lo slug si mostra solo quando aggiunge qualcosa al nome, o quando la
      // ricerca potrebbe aver agganciato proprio lui
      (sameWord(nameOf(x), x.slug) && !q ? '' : `<span class="sg">${hi(x.slug, q)}</span>`) +
      '</span>' +
      (x.shareUrl ? '<span class="live">live</span>' : '<span></span>') +
      '</div>').join('') +
    '</div>').join('');

  // la lista è un listbox: il fuoco sta sul contenitore e l'elemento corrente
  // si dichiara. L'elemento attivo va annunciato anche dal campo di ricerca,
  // che è dove sta il fuoco nel flusso principale.
  const q2 = $('#q');
  if (cursor) {
    list.setAttribute('aria-activedescendant', `row-${cursor}`);
    q2.setAttribute('aria-activedescendant', `row-${cursor}`);
  } else {
    list.removeAttribute('aria-activedescendant');
    q2.removeAttribute('aria-activedescendant');
  }

  list.querySelectorAll('.row').forEach((el) => {
    el.onclick = () => select(el.dataset.slug);
  });
}

function renderHead() {
  const s = site();
  const head = $('#assetHead');
  const key = JSON.stringify([s && [s.slug, s.name, s.status, s.fpm, s.shareUrl, s.php],
    state.detail && [state.detail.blueprint, state.detail.xdebug, state.detail.createdAt],
    classOf(state.selected), state.busy]);
  if (key === sig.head) return;
  sig.head = key;

  if (!s) { head.innerHTML = ''; return; }
  const d = state.detail;
  const up = isUp(s);
  const created = d?.createdAt ? new Date(d.createdAt).toLocaleDateString('it-IT') : '—';

  head.innerHTML =
    '<div class="ah frame">' +
    '<div>' +
    `<h1 class="ah-name">${esc(nameOf(s))}</h1>` +
    '<div class="ah-sub">' +
    `<code>${esc(s.slug)}</code>` +
    '<span class="cls">' +
    '<span class="lbl q">classe</span>' +
    '<select id="clsSel" aria-label="Classe del sito">' +
    `<option value="">— nessuna —</option>` +
    CLASSES.map((c) => `<option value="${c.id}"${classOf(s.slug) === c.id ? ' selected' : ''}>${c.label}</option>`).join('') +
    '</select></span>' +
    '</div>' +
    '<div class="ah-actions" id="ahActions"></div>' +
    '</div>' +
    // Niente PHP qui: è 8.3 su tutti e sedici, cioè esattamente il tipo di
    // costante che rendeva illeggibile la griglia precedente. Sta in panoramica,
    // dove vive il dettaglio tecnico.
    '<div class="ah-spec">' +
    `<span class="lbl q">stato</span><span class="v${up ? '' : ' warn'}">${esc(stateWord(s))}</span>` +
    `<span class="lbl q">blueprint</span><span class="v">${esc(d?.blueprint || '—')}</span>` +
    `<span class="lbl q">creato</span><span class="v">${esc(created)}</span>` +
    '</div>' +
    '</div>';

  $('#clsSel').onchange = (e) => {
    const v = e.target.value;
    if (v) state.labels[s.slug] = v; else delete state.labels[s.slug];
    saveLabels(); invalidate(); renderAll();
  };

  const a = $('#ahActions');
  const mk = (label, icon, cls, fn, disabled) => {
    const b = document.createElement('button');
    if (cls) b.className = cls;
    b.disabled = state.busy || disabled;
    b.innerHTML = `<svg class="ico" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><use href="#${icon}"/></svg>${esc(label)}`;
    b.onclick = fn;
    a.appendChild(b);
  };
  mk('apri', 'i-external', 'primary', () => openExt(s.url), !up);
  mk('admin', 'i-arrow', '', async () => {
    try { const r = await api('GET', `/api/sites/${s.slug}/admin`); openExt(r.url); }
    catch (err) { toast(err.message); }
  }, !up);
  mk(s.status === 'running' ? 'stop' : 'start', s.status === 'running' ? 'i-stop' : 'i-play', 'quiet',
    () => apiOp('POST', `/api/sites/${s.slug}/${s.status === 'running' ? 'stop' : 'start'}`));
  mk('riavvia', 'i-restart', 'quiet', () => apiOp('POST', `/api/sites/${s.slug}/restart`), s.status !== 'running');
}

const TABS = ['panoramica', 'live link', 'log', 'mailpit'];

function renderTabs() {
  const s = site();
  const key = JSON.stringify([!!s, state.tab]);
  if (key === sig.tabs) return;
  sig.tabs = key;
  const t = $('#tabs');
  t.innerHTML = '';
  if (!s) return;
  for (const name of TABS) {
    const b = document.createElement('button');
    b.className = 'tab' + (state.tab === name ? ' sel' : '');
    b.textContent = name;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(state.tab === name));
    b.onclick = () => {
      state.tab = name; state.revealed.clear();
      sig.content = null; sig.tabs = null; renderTabs(); renderContent();
    };
    t.appendChild(b);
  }
}

function secretRow(label, slug, field, shownHtml, copyText) {
  const shown = state.revealed.has(`${slug}:${field}`);
  return (
    `<span class="lbl k">${esc(label)}</span>` +
    `<span class="v">${shown ? shownHtml : '<span class="red" aria-label="valore nascosto"></span>'}</span>` +
    '<span class="act">' +
    `<button class="icon-btn" data-reveal="${esc(field)}" title="${shown ? 'nascondi' : 'mostra'}" aria-label="${shown ? 'nascondi' : 'mostra'}">` +
    `<svg width="14" height="14" viewBox="0 0 24 24"><use href="#${shown ? 'i-eye-off' : 'i-eye'}"/></svg></button>` +
    `<button class="icon-btn" data-copy="${esc(copyText)}" title="copia" aria-label="copia"><svg width="14" height="14" viewBox="0 0 24 24"><use href="#i-copy"/></svg></button>` +
    '</span>'
  );
}
function plainRow(label, valueHtml, copyText) {
  return (
    `<span class="lbl k">${esc(label)}</span>` +
    `<span class="v">${valueHtml}</span>` +
    '<span class="act">' +
    (copyText !== undefined
      ? `<button class="icon-btn" data-copy="${esc(copyText)}" title="copia" aria-label="copia"><svg width="14" height="14" viewBox="0 0 24 24"><use href="#i-copy"/></svg></button>`
      : '') +
    '</span>'
  );
}
function sectionLabel(text) {
  return `<div class="section"><span class="lbl">${esc(text)}</span><span class="bar"></span></div>`;
}

function wireCopy(c) {
  c.querySelectorAll('[data-copy]').forEach((b) => { b.onclick = () => copy(b.dataset.copy); });
  c.querySelectorAll('[data-reveal]').forEach((b) => {
    b.onclick = () => {
      const k = `${state.selected}:${b.dataset.reveal}`;
      if (state.revealed.has(k)) state.revealed.delete(k); else state.revealed.add(k);
      sig.content = null; renderContent();
    };
  });
}

async function renderContent() {
  const c = $('#content');
  const s = site();
  c.classList.toggle('void', !s);

  // --- nessuna selezione: schermata che insegna, non sedici card uguali ---
  if (!s) {
    const key = JSON.stringify(['none', state.daemonDown, state.loaded, state.sites.length,
      state.sites.filter(isUp).length, state.query]);
    if (key === sig.content) return;
    sig.content = key;

    if (!state.loaded) {
      c.innerHTML = '<div style="max-width:62ch"><div class="skel a"></div><div class="skel b"></div><div class="skel c"></div></div>';
      return;
    }
    if (state.daemonDown) {
      c.innerHTML =
        '<div class="fail"><div class="hzt"></div>' +
        '<h2>wpdevd non risponde</h2>' +
        '<p class="prose">La GUI non ha logica propria: senza il daemon su <code>127.0.0.1:9700</code> non c\'è nulla da mostrare.</p>' +
        '<p class="prose" style="margin-bottom:0">Riavvialo con <code>wpdev daemon start</code>, oppure controlla ' +
        '<code>systemctl --user status wpdevd</code>.</p></div>';
      return;
    }
    const total = state.sites.length;
    if (total === 0) {
      c.innerHTML =
        '<div class="empty"><h2>Flotta vuota</h2>' +
        '<p>Nessun sito nel registry. Crea il primo con <b>nuovo sito</b>: wpdev prepara webroot, database, ' +
        'vhost e WordPress già installato su <code>&lt;slug&gt;.localhost</code>.</p></div>';
      return;
    }
    // Solo le eccezioni meritano spazio: con la flotta tutta operativa non c'è
    // niente da riportare, e ripeterlo sedici volte è ciò che rendeva illeggibile
    // la schermata precedente.
    const down = state.sites.filter((x) => !isUp(x));
    const live = state.sites.filter((x) => x.shareUrl);
    const excRow = (label, warn, items) =>
      '<div class="exc-row">' +
      `<span class="lbl${warn ? ' warn' : ''}">${esc(label)}</span>` +
      `<span class="who">${items.map((x) => esc(nameOf(x))).join(', ')}</span>` +
      '</div>';
    // quando la ricerca ha già stretto a un solo sito, il pannello dice quale
    // è e cosa succede premendo invio, invece di spiegare come si scorre
    const qNow = state.query.trim();
    const vis = visibleSlugs();
    const only = qNow && vis.length === 1 ? state.sites.find((x) => x.slug === vis[0]) : null;
    c.innerHTML =
      '<div class="empty">' +
      (only
        ? `<h2>${esc(nameOf(only))}</h2>` +
          `<p>Unico risultato per «${esc(qNow)}». <span class="kbd-hint"><i>INVIO</i></span> lo apre nel browser, ` +
          'oppure fai clic sulla riga a sinistra per lavorarci.</p>'
        : '<h2>Scegli un sito</h2>' +
          '<p>Cerca per nome o slug con <span class="kbd-hint"><i>CTRL</i><i>K</i></span>, poi <span class="kbd-hint"><i>↑</i><i>↓</i></span> ' +
          'per scorrere e <span class="kbd-hint"><i>INVIO</i></span> per aprirlo. Assegna una <b>classe</b> a un sito ' +
          'per vederlo raggruppato qui a sinistra.</p>') +
      '</div>' +
      (down.length || live.length
        ? '<div class="exc">' +
          (down.length ? excRow(down.length === 1 ? 'non operativo' : 'non operativi', true, down) : '') +
          (live.length ? excRow('live link attivo', false, live) : '') +
          '</div>'
        : '');
    return;
  }

  // --- panoramica ---
  if (state.tab === 'panoramica') {
    const d = state.detail;
    const key = JSON.stringify(['pan', s.slug, d && [d.url, d.phpVersion, d.xdebug, d.webroot, d.adminUser,
      d.adminPass, d.db, d.blueprint, d.share], [...state.revealed], state.busy]);
    if (key === sig.content) return;
    sig.content = key;
    if (!d) {
      c.innerHTML = '<div style="max-width:62ch"><div class="skel a"></div><div class="skel b"></div><div class="skel c"></div></div>';
      return;
    }
    c.innerHTML =
      '<div class="spec">' +
      plainRow('endpoint', `<a id="lnkUrl">${esc(d.url)}</a>`, d.url) +
      // il live link è ciò che finisce sotto gli occhi di un cliente: quando è
      // acceso lo si vede da qui, non solo dalla sua scheda
      (d.share?.url ? plainRow('url pubblico', `<a id="lnkPub">${esc(d.share.url)}</a>`, d.share.url) : '') +
      plainRow('webroot', esc(d.webroot), d.webroot) +
      plainRow('php', `${esc(d.phpVersion)}${d.xdebug ? ' <span class="q">· xdebug attivo</span>' : ''}`) +
      secretRow('admin wp', s.slug, 'adminPass',
        `<span class="q">${esc(d.adminUser)} /</span> ${esc(d.adminPass)}`, d.adminPass) +
      secretRow('database', s.slug, 'dbPass',
        `${esc(d.db.name)} <span class="q">· ${esc(d.db.user)} /</span> ${esc(d.db.pass)}`, d.db.pass) +
      '</div>' +
      sectionLabel('strumenti') +
      '<div class="grid-actions">' +
      '<button id="bShell" class="quiet"><svg class="ico" width="13" height="13" viewBox="0 0 24 24"><use href="#i-terminal"/></svg>shell</button>' +
      '<button id="bCli" class="quiet"><svg class="ico" width="13" height="13" viewBox="0 0 24 24"><use href="#i-terminal"/></svg>wp-cli</button>' +
      '<button id="bDb" class="quiet"><svg class="ico" width="13" height="13" viewBox="0 0 24 24"><use href="#i-db"/></svg>adminer</button>' +
      '<button id="bExport" class="quiet"><svg class="ico" width="13" height="13" viewBox="0 0 24 24"><use href="#i-box"/></svg>esporta</button>' +
      '<button id="bClone" class="quiet"><svg class="ico" width="13" height="13" viewBox="0 0 24 24"><use href="#i-copy"/></svg>clona</button>' +
      `<button id="bXdebug" class="quiet"><svg class="ico" width="13" height="13" viewBox="0 0 24 24"><use href="#i-bug"/></svg>xdebug ${d.xdebug ? 'off' : 'on'}</button>` +
      '</div>' +
      sectionLabel('irreversibile') +
      '<div class="grid-actions">' +
      '<button id="bDelete" class="risk"><svg class="ico" width="13" height="13" viewBox="0 0 24 24"><use href="#i-trash"/></svg>elimina sito</button>' +
      '</div>';

    wireCopy(c);
    $('#lnkUrl').onclick = () => openExt(d.url);
    const pub = $('#lnkPub'); if (pub) pub.onclick = () => openExt(d.share.url);
    $('#bShell').onclick = () => copy(`wpdev shell ${s.slug}`);
    $('#bCli').onclick = () => copy(`wpdev cli ${s.slug} -- `);
    $('#bDb').onclick = () => {
      const adminerBase = d.url.replace(`${d.domain}`, 'adminer.localhost');
      openExt(`${adminerBase}/?server=localhost&username=${d.db.user}&db=${d.db.name}`);
      // la password serve nel form Adminer, ma copiarla in silenzio è un segreto
      // che si muove senza che l'operatore lo sappia: va detto
      window.wpdev.copy(d.db.pass);
      toast('adminer aperto · password db negli appunti');
    };
    $('#bExport').onclick = async () => {
      const r = await apiOp('POST', `/api/sites/${s.slug}/export`);
      if (r) toast('export creato');
    };
    $('#bClone').onclick = async () => {
      const dst = await askDialog({
        title: 'Clona sito', label: 'nuovo slug', placeholder: 'es. barber-bronx-2',
        body: `Copia webroot e database di <b>${esc(s.slug)}</b> con search-replace sul nuovo dominio.`,
        confirmText: 'clona',
      });
      if (dst) await apiOp('POST', `/api/sites/${s.slug}/clone`, { dst });
    };
    $('#bXdebug').onclick = () => apiOp('POST', `/api/sites/${s.slug}/xdebug`, { on: !d.xdebug });
    $('#bDelete').onclick = async () => {
      const ok = await askDialog({
        title: 'Elimina sito',
        body: `Elimina <b>${esc(s.slug)}</b> senza residui: webroot, database, vhost, voce hosts e registry. Non è reversibile.`,
        confirmText: 'elimina', danger: true,
      });
      if (ok) { await apiOp('DELETE', `/api/sites/${s.slug}`); state.selected = null; invalidate(); renderAll(); }
    };
    return;
  }

  // --- live link ---
  if (state.tab === 'live link') {
    const d = state.detail;
    const sh = d?.share;
    const key = JSON.stringify(['live', s.slug, sh, isUp(s), [...state.revealed], state.busy]);
    if (key === sig.content) return;
    sig.content = key;
    if (!d) { c.innerHTML = '<div class="skel a"></div><div class="skel b"></div>'; return; }

    if (sh?.url) {
      c.innerHTML =
        '<p class="prose">URL pubblico attivo. Cambia a ogni riavvio del sito e non sopravvive al riavvio del daemon.</p>' +
        '<div class="spec">' +
        plainRow('url pubblico', `<a id="lnkShare">${esc(sh.url)}</a>`, sh.url) +
        secretRow('accesso', s.slug, 'sharePass',
          `<span class="q">${esc(sh.authUser)} /</span> ${esc(sh.authPass)}`, `${sh.authUser}:${sh.authPass}`) +
        '</div>' +
        sectionLabel('irreversibile') +
        '<div class="grid-actions"><button id="bUnshare" class="risk">' +
        '<svg class="ico" width="13" height="13" viewBox="0 0 24 24"><use href="#i-stop"/></svg>ferma live link</button></div>';
      wireCopy(c);
      $('#lnkShare').onclick = () => openExt(sh.url);
      $('#bUnshare').onclick = () => apiOp('DELETE', `/api/sites/${s.slug}/share`);
    } else {
      c.innerHTML =
        '<p class="prose">Espone il sito su un URL pubblico temporaneo via cloudflared, protetto da basic auth. ' +
        'L\'URL cambia a ogni avvio e vive finché il sito resta acceso.</p>' +
        '<div class="grid-actions"><button id="bShare" class="primary"' + (isUp(s) ? '' : ' disabled') + '>' +
        '<svg class="ico" width="13" height="13" viewBox="0 0 24 24"><use href="#i-share"/></svg>avvia live link</button></div>' +
        (isUp(s) ? '' : '<p class="prose" style="margin-top:12px">Il sito deve essere operativo.</p>');
      const b = $('#bShare');
      if (b) b.onclick = () => apiOp('POST', `/api/sites/${s.slug}/share`, {});
    }
    return;
  }

  // --- log ---
  if (state.tab === 'log') {
    const key = JSON.stringify(['log', s.slug, state.logStamp ?? 0]);
    if (key === sig.content) return;
    sig.content = key;
    c.innerHTML = '<div class="skel a"></div><div class="skel b"></div>';
    try {
      const { logs } = await api('GET', `/api/sites/${s.slug}/logs?tail=80`);
      const blocks = Object.entries(logs).map(([f, lines]) =>
        `<div class="log-name"><span class="lbl">${esc(f)}</span><span class="bar"></span></div>` +
        `<pre class="log">${esc(lines.join('\n')) || '(vuoto)'}</pre>`).join('');
      c.innerHTML =
        '<div class="grid-actions" style="margin-bottom:4px"><button id="bReload" class="quiet">' +
        '<svg class="ico" width="13" height="13" viewBox="0 0 24 24"><use href="#i-restart"/></svg>aggiorna</button></div>' +
        (blocks || '<p class="prose" style="margin-top:16px">Nessun log per questo sito.</p>');
      $('#bReload').onclick = () => { state.logStamp = Date.now(); sig.content = null; renderContent(); };
    } catch (err) {
      c.innerHTML = `<div class="fail"><div class="hzt"></div><p class="prose" style="margin:0">Log non leggibili: ${esc(err.message)}</p></div>`;
    }
    return;
  }

  // --- mailpit ---
  if (state.tab === 'mailpit') {
    const key = JSON.stringify(['mp']);
    if (key === sig.content) return;
    sig.content = key;
    c.innerHTML =
      '<div class="grid-actions" style="margin-bottom:12px"><button id="bMpOpen" class="quiet">' +
      '<svg class="ico" width="13" height="13" viewBox="0 0 24 24"><use href="#i-external"/></svg>apri nel browser</button></div>' +
      '<iframe id="mailpit" src="http://127.0.0.1:8025" title="Mailpit"></iframe>';
    $('#bMpOpen').onclick = () => openExt('http://127.0.0.1:8025');
  }
}

function renderAll() { renderIndex(); renderRail(); renderHead(); renderTabs(); renderContent(); }

function select(slug) {
  if (state.selected === slug) return;
  state.selected = slug;
  state.tab = 'panoramica';
  state.detail = null;
  // un segreto scoperto non segue l'operatore da un sito all'altro: chi guarda
  // lo schermo non deve ritrovarselo svelato al ritorno
  state.revealed.clear();
  invalidate();
  renderAll();
  loadDetail();
}

async function loadDetail() {
  const slug = state.selected;
  if (!slug) { state.detail = null; return; }
  try {
    const { site: full } = await api('GET', `/api/sites/${slug}`);
    if (state.selected !== slug) return; // selezione cambiata nel frattempo
    state.detail = full;
  } catch {
    state.detail = null;
  }
  sig.head = null; sig.content = null;
  renderHead(); renderContent(); renderRail();
}

async function refresh() {
  try {
    const d = await api('GET', '/api/sites');
    state.sites = d.sites;
    state.daemonDown = false;
    if (state.selected && !state.sites.some((s) => s.slug === state.selected)) {
      state.selected = null; state.detail = null; invalidate();
    }
  } catch {
    state.sites = [];
    state.daemonDown = true;
  }
  state.loaded = true;
  renderAll();
  if (state.selected) await loadDetail();
}

// ----------------------------------------------------- azioni globali ---
$('#mailpitBtn').onclick = () => openExt('http://127.0.0.1:8025');
$('#winMin').onclick = () => window.wpdev.win('min');
$('#winMax').onclick = () => window.wpdev.win('max');
$('#winClose').onclick = () => window.wpdev.win('close');
$('#conClose').onclick = () => $('#console').classList.remove('show');

$('#q').addEventListener('input', (e) => {
  state.query = e.target.value;
  sig.index = null; sig.content = null;
  renderIndex(); renderContent();
});

// tastiera: trovare un sito non deve richiedere il mouse
document.addEventListener('keydown', (e) => {
  const q = $('#q');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); q.focus(); q.select(); return; }
  if (e.key === '/' && document.activeElement !== q && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '')) {
    e.preventDefault(); q.focus(); return;
  }
  if (document.querySelector('dialog[open]')) return;

  if (e.key === 'Escape' && document.activeElement === q) {
    if (state.query) { q.value = ''; state.query = ''; sig.index = null; sig.content = null; renderIndex(); renderContent(); }
    else q.blur();
    return;
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const slugs = visibleSlugs();
    if (!slugs.length) return;
    e.preventDefault();
    const i = slugs.indexOf(state.selected);
    const next = e.key === 'ArrowDown'
      ? (i < 0 ? 0 : Math.min(i + 1, slugs.length - 1))
      : (i < 0 ? slugs.length - 1 : Math.max(i - 1, 0));
    if (slugs[next] !== state.selected) select(slugs[next]);
    document.querySelector(`.row[data-slug="${CSS.escape(slugs[next])}"]`)?.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (e.key === 'Enter') {
    const list = $('#indexList');
    const inFinder = document.activeElement === q;
    const inList = list === document.activeElement || list.contains(document.activeElement);
    if (!inFinder && !inList) return;
    e.preventDefault();
    const slugs = visibleSlugs();
    if (!state.selected && slugs.length) { select(slugs[0]); return; }
    const s = site();
    if (s && isUp(s)) openExt(s.url);
  }
});

$('#newBtn').onclick = async () => {
  const dlg = $('#newDialog');
  try {
    const { blueprints } = await api('GET', '/api/blueprints');
    const sel = $('#fBlueprint');
    sel.innerHTML = '<option value="">nessuno — WordPress pulito</option>';
    for (const b of blueprints) {
      const o = document.createElement('option');
      o.value = b.name; o.textContent = `${b.name} — ${b.description}`;
      sel.appendChild(o);
    }
  } catch { /* daemon giù: il create fallirà con messaggio chiaro */ }
  $('#fSlug').value = ''; $('#fTitle').value = ''; $('#slugPreview').textContent = '<slug>';
  dlg.showModal();
  $('#fSlug').focus();
};
$('#fSlug').addEventListener('input', () => {
  $('#slugPreview').textContent = $('#fSlug').value || '<slug>';
});
$('#fCancel').onclick = () => $('#newDialog').close();
$('#fCreate').onclick = async () => {
  const slug = $('#fSlug').value.trim();
  if (!slug) { toast('slug obbligatorio'); return; }
  $('#newDialog').close();
  const r = await apiOp('POST', '/api/sites', {
    slug,
    title: $('#fTitle').value.trim() || undefined,
    blueprint: $('#fBlueprint').value || undefined,
    locale: $('#fLocale').value,
  });
  if (r) { state.selected = r.slug; state.detail = null; invalidate(); renderAll(); loadDetail(); }
};

// ------------------------------------------------------------------ boot ---
const boot = new URLSearchParams(location.search);
state.selected = boot.get('select');
// hook di test (come WPDEV_SELECT): ?q=<testo> parte con la ricerca già scritta,
// e serve a verificare che il polling non se la porti via
if (boot.get('q')) { state.query = boot.get('q'); $('#q').value = state.query; }
renderAll();
refresh();
setInterval(() => { if (!state.busy) refresh(); }, 4000);
// hook di test (come WPDEV_SELECT): ?open=new|delete apre un dialog per lo screenshot
if (boot.get('open') === 'new') setTimeout(() => $('#newBtn').click(), 600);
if (boot.get('open') === 'delete') setTimeout(() => document.querySelector('#bDelete')?.click(), 2500);
