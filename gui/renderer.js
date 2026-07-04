// wpdev GUI — renderer: parla SOLO con l'API di wpdevd (nessuna logica propria).
const API = 'http://127.0.0.1:9700';
const $ = (sel) => document.querySelector(sel);

let sites = [];
let selected = null; // slug
let tab = 'panoramica';
let busy = false;

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

// Operazione lunga NDJSON: mostra i log nella console in basso.
async function apiOp(method, path, body) {
  const con = $('#console');
  con.classList.add('show');
  con.textContent = '';
  busy = true; renderTop();
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
        if (evt.event === 'log') { con.textContent += `› ${evt.msg}\n`; con.scrollTop = con.scrollHeight; }
        else if (evt.event === 'error') throw new Error(evt.message);
        else if (evt.event === 'done') final = evt.result;
      }
    }
    con.textContent += '✓ fatto\n';
    con.scrollTop = con.scrollHeight;
    return final;
  } catch (err) {
    con.textContent += `✗ errore: ${err.message}\n`;
    con.scrollTop = con.scrollHeight;
    throw err;
  } finally {
    busy = false;
    await refresh();
  }
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function copy(text) { window.wpdev.copy(text); toast('copiato negli appunti'); }
function open(url) { window.wpdev.openUrl(url); }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// stato runtime → classe LED e parola
function ledClass(s) { return s.status === 'running' ? (s.fpm ? 'on' : 'err') : 'off'; }
function stateWord(s) { return s.status === 'running' ? (s.fpm ? 'running' : 'fpm giù') : 'stopped'; }
function hostPort(s) { return (s.url || '').replace(/^https?:\/\//, ''); }

// ----------------------------------------------------------------- render ---
function renderSidebar() {
  const list = $('#siteList');
  list.innerHTML = '';
  if (sites.length === 0) {
    list.innerHTML = '<div class="empty" style="padding:28px 12px">nessun sito</div>';
    return;
  }
  for (const s of sites) {
    const el = document.createElement('div');
    el.className = 'site-row' + (s.slug === selected ? ' sel' : '');
    el.innerHTML =
      `<span class="led ${ledClass(s)}"></span>` +
      `<span class="slug">${esc(s.slug)}</span>` +
      (s.shareUrl ? '<span class="row-tag">live</span>' : '');
    el.onclick = () => { selected = s.slug; tab = 'panoramica'; renderAll(); };
    list.appendChild(el);
  }
}

function site() { return sites.find((s) => s.slug === selected) ?? null; }

function renderTop() {
  // readout flotta (sempre)
  const total = sites.length;
  const up = sites.filter((s) => s.status === 'running' && s.fpm).length;
  const err = sites.filter((s) => s.status === 'running' && !s.fpm).length;
  const down = total - up - err;
  const readout = $('#fleetReadout');
  if (total === 0) {
    readout.innerHTML = '<span class="fx-label">flotta</span><span class="down">vuota</span>';
  } else {
    readout.innerHTML =
      '<span class="fx-label">flotta</span>' +
      `<span class="up">${up} su</span>` +
      `<span class="dot">·</span>` +
      `<span class="down${err ? ' bad' : ''}">${down + err} giù</span>` +
      (err ? `<span class="dot">·</span><span class="down bad">${err} errore</span>` : '');
  }

  // testata dettaglio (solo se un sito è selezionato)
  const head = $('#detailHead');
  const s = site();
  if (!s) { head.className = ''; head.innerHTML = ''; return; }
  head.className = 'show';
  const running = s.status === 'running';
  const pillCls = ledClass(s) === 'on' ? 'on' : ledClass(s) === 'err' ? 'err' : '';
  head.innerHTML =
    '<div class="dh-top">' +
    `<span class="dh-slug">${esc(s.slug)}</span>` +
    `<span class="pill ${pillCls}"><span class="led ${ledClass(s)}"></span>${stateWord(s)}</span>` +
    '<span class="dh-actions" id="dhActions"></span>' +
    '</div>';
  const a = $('#dhActions');
  const mk = (label, cls, fn, dis) => {
    const b = document.createElement('button');
    b.textContent = label; if (cls) b.className = cls; b.disabled = busy || dis;
    b.onclick = fn; a.appendChild(b);
  };
  mk(running ? '■ stop' : '▶ start', running ? 'ghost' : 'primary',
    () => apiOp('POST', `/api/sites/${s.slug}/${running ? 'stop' : 'start'}`));
  mk('↻ restart', 'ghost', () => apiOp('POST', `/api/sites/${s.slug}/restart`), !running);
  mk('▸ apri', 'ghost', () => open(s.url), !running);
  mk('admin', 'ghost', async () => {
    try { const d = await api('GET', `/api/sites/${s.slug}/admin`); open(d.url); }
    catch (err) { toast(err.message); }
  }, !running);
}

const TABS = ['panoramica', 'live link', 'log', 'mailpit'];

function renderTabs() {
  const t = $('#tabs');
  t.innerHTML = '';
  if (!site()) return;
  for (const name of TABS) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab === name ? ' sel' : '');
    el.textContent = name;
    el.onclick = () => { tab = name; renderContent(); renderTabs(); };
    t.appendChild(el);
  }
}

// vetrina flotta (schermata iniziale, nessun sito selezionato)
function renderFleetBoard(c) {
  const total = sites.length;
  const up = sites.filter((s) => s.status === 'running' && s.fpm).length;
  if (total === 0) {
    c.innerHTML =
      '<div class="fleet-hero"><div class="eyebrow">console</div>' +
      '<h1>Nessun sito, <b>ancora</b>.</h1>' +
      '<p>Crea il primo sito WordPress locale con “＋ nuovo sito”.</p></div>';
    return;
  }
  const cards = sites.map((s) => {
    const running = s.status === 'running' && s.fpm;
    const quick = running
      ? `<button class="sm ghost" data-act="open" data-slug="${esc(s.slug)}">▸ apri</button>`
      : `<button class="sm primary" data-act="start" data-slug="${esc(s.slug)}">▶ avvia</button>`;
    return (
      `<div class="fleet-card" data-slug="${esc(s.slug)}">` +
      '<div class="fc-head">' +
      `<span class="led ${ledClass(s)}"></span>` +
      `<span class="slug">${esc(s.slug)}</span>` +
      `<span class="state ${ledClass(s)}">${stateWord(s)}</span>` +
      '</div>' +
      `<div class="fc-meta">${esc(hostPort(s))} · PHP ${esc(s.php)}` +
      (s.shareUrl ? ' · <span class="live-tag">live link attivo</span>' : '') +
      '</div>' +
      `<div class="fc-actions">${quick}` +
      `<button class="sm ghost" data-act="admin" data-slug="${esc(s.slug)}"${running ? '' : ' disabled'}>admin</button>` +
      '</div>' +
      '</div>'
    );
  }).join('');
  c.innerHTML =
    '<div class="fleet-hero"><div class="eyebrow">console</div>' +
    `<h1>La tua flotta locale — <b>${up}</b> di ${total} attivi.</h1>` +
    '<p>Seleziona un sito dalla flotta a sinistra, o agisci al volo qui sotto.</p></div>' +
    `<div class="fleet-board">${cards}</div>`;

  c.querySelectorAll('.fleet-card').forEach((card) => {
    card.onclick = () => { selected = card.dataset.slug; tab = 'panoramica'; renderAll(); };
  });
  c.querySelectorAll('.fc-actions button').forEach((b) => {
    b.onclick = async (e) => {
      e.stopPropagation();
      const slug = b.dataset.slug, act = b.dataset.act;
      if (act === 'open') { const s = sites.find((x) => x.slug === slug); if (s) open(s.url); }
      else if (act === 'start') { await apiOp('POST', `/api/sites/${slug}/start`); }
      else if (act === 'admin') {
        try { const d = await api('GET', `/api/sites/${slug}/admin`); open(d.url); }
        catch (err) { toast(err.message); }
      }
    };
  });
}

// riga della "scheda unità" con eventuale bottone copia
function specRow(label, valueHtml, copyText) {
  return (
    '<div class="spec-row">' +
    `<div class="k">${label}</div>` +
    `<div class="v">${valueHtml}</div>` +
    (copyText !== undefined
      ? `<button class="icon-btn" title="copia" data-copy="${esc(copyText)}">⧉</button>`
      : '<div></div>') +
    '</div>'
  );
}

async function renderContent() {
  const c = $('#content');
  const s = site();
  if (!s) { renderFleetBoard(c); return; }

  if (tab === 'panoramica') {
    const { site: full } = await api('GET', `/api/sites/${s.slug}`);
    c.innerHTML =
      '<div class="spec">' +
      specRow('Endpoint', `<a id="lnkUrl">${esc(full.url)}</a>`, full.url) +
      specRow('Stato', esc(stateWord(s))) +
      specRow('PHP', `${esc(full.phpVersion)}${full.xdebug ? ' <span class="dim">· xdebug on</span>' : ''}`) +
      specRow('Webroot', esc(full.webroot), full.webroot) +
      specRow('Admin WP', `<span class="dim">${esc(full.adminUser)} /</span> ${esc(full.adminPass)}`, full.adminPass) +
      specRow('Database', `${esc(full.db.name)} <span class="dim">· utente ${esc(full.db.user)}</span>`, full.db.pass) +
      specRow('Blueprint', full.blueprint ? esc(full.blueprint) : '<span class="dim">n/d</span>') +
      '</div>' +
      '<div class="section-label">Azioni</div>' +
      '<div class="actions">' +
      '<button id="bShell" class="ghost">shell</button>' +
      '<button id="bCli" class="ghost">wp-cli</button>' +
      '<button id="bDb" class="ghost">adminer</button>' +
      '<button id="bExport" class="ghost">esporta</button>' +
      '<button id="bClone" class="ghost">clona…</button>' +
      `<button id="bXdebug" class="ghost">xdebug ${full.xdebug ? 'off' : 'on'}</button>` +
      '<button id="bDelete" class="danger">elimina sito</button>' +
      '</div>';
    c.querySelectorAll('.icon-btn[data-copy]').forEach((b) => { b.onclick = () => copy(b.dataset.copy); });
    $('#lnkUrl').onclick = () => open(full.url);
    $('#bShell').onclick = () => copy(`wpdev shell ${s.slug}`);
    $('#bCli').onclick = () => copy(`wpdev cli ${s.slug} -- `);
    $('#bDb').onclick = () => {
      const adminerBase = full.url.replace(`${full.domain}`, 'adminer.localhost');
      open(`${adminerBase}/?server=localhost&username=${full.db.user}&db=${full.db.name}`);
      copy(full.db.pass); // la password serve nel form Adminer
    };
    $('#bExport').onclick = async () => {
      const r = await apiOp('POST', `/api/sites/${s.slug}/export`);
      if (r) toast('export creato in ~/wpdev-exports');
    };
    $('#bClone').onclick = async () => {
      const dst = prompt(`Clona "${s.slug}" in (nuovo slug):`);
      if (dst) await apiOp('POST', `/api/sites/${s.slug}/clone`, { dst });
    };
    $('#bXdebug').onclick = () => apiOp('POST', `/api/sites/${s.slug}/xdebug`, { on: !full.xdebug });
    $('#bDelete').onclick = async () => {
      if (confirm(`Eliminare DEFINITIVAMENTE "${s.slug}" (webroot + database)?`)) {
        await apiOp('DELETE', `/api/sites/${s.slug}`);
        selected = null;
      }
    };
  }

  if (tab === 'live link') {
    const { site: full } = await api('GET', `/api/sites/${s.slug}`);
    const sh = full.share;
    if (sh?.url) {
      c.innerHTML =
        '<div class="spec">' +
        specRow('URL pubblico', `<a id="lnkShare">${esc(sh.url)}</a>`, sh.url) +
        specRow('Accesso', `<span class="dim">${esc(sh.authUser)} /</span> ${esc(sh.authPass)}`, `${sh.authUser}:${sh.authPass}`) +
        '</div>' +
        '<div class="actions" style="margin-top:20px"><button id="bUnshare" class="danger">ferma live link</button></div>';
      c.querySelectorAll('.icon-btn[data-copy]').forEach((b) => { b.onclick = () => copy(b.dataset.copy); });
      $('#lnkShare').onclick = () => open(sh.url);
      $('#bUnshare').onclick = () => apiOp('DELETE', `/api/sites/${s.slug}/share`);
    } else {
      c.innerHTML =
        '<p class="prose">Espone il sito su un URL pubblico temporaneo via cloudflared, protetto da ' +
        'basic auth. L’URL cambia a ogni avvio e vive finché il sito resta acceso.</p>' +
        `<div class="actions"><button id="bShare" class="primary" ${s.status !== 'running' ? 'disabled' : ''}>avvia live link</button></div>`;
      $('#bShare')?.addEventListener('click', () => apiOp('POST', `/api/sites/${s.slug}/share`, {}));
    }
  }

  if (tab === 'log') {
    const { logs } = await api('GET', `/api/sites/${s.slug}/logs?tail=80`);
    const blocks = Object.entries(logs).map(([f, lines]) =>
      `<div class="log-name">${esc(f)}</div><pre class="log">${
        esc(lines.join('\n')) || '(vuoto)'
      }</pre>`).join('');
    c.innerHTML = `<div class="actions" style="margin-bottom:16px"><button id="bReload" class="ghost">↻ aggiorna</button></div>${blocks || '<div class="empty">nessun log</div>'}`;
    $('#bReload').onclick = renderContent;
  }

  if (tab === 'mailpit') {
    c.innerHTML =
      '<div class="actions" style="margin-bottom:14px"><button id="bMpOpen" class="ghost">apri nel browser</button></div>' +
      '<iframe id="mailpit" src="http://127.0.0.1:8025"></iframe>';
    $('#bMpOpen').onclick = () => open('http://127.0.0.1:8025');
  }
}

function renderAll() { renderSidebar(); renderTop(); renderTabs(); renderContent(); }

async function refresh() {
  try {
    const d = await api('GET', '/api/sites');
    sites = d.sites;
    if (selected && !sites.some((s) => s.slug === selected)) selected = null;
  } catch {
    sites = [];
  }
  renderSidebar(); renderTop();
  if (tab === 'panoramica' || !site()) renderContent();
  renderTabs();
}

// ----------------------------------------------------------- azioni globali ---
$('#mailpitBtn').onclick = () => open('http://127.0.0.1:8025');

$('#newBtn').onclick = async () => {
  const dlg = $('#newDialog');
  try {
    const { blueprints } = await api('GET', '/api/blueprints');
    const sel = $('#fBlueprint');
    sel.innerHTML = '<option value="">— nessuno (WP pulito) —</option>';
    for (const b of blueprints) {
      const o = document.createElement('option');
      o.value = b.name; o.textContent = `${b.name} — ${b.description}`;
      sel.appendChild(o);
    }
  } catch { /* daemon giù: il create fallirà con messaggio chiaro */ }
  $('#fSlug').value = ''; $('#fTitle').value = ''; $('#slugPreview').textContent = '<slug>';
  dlg.showModal();
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
  if (r) { selected = r.slug; renderAll(); }
};

// ------------------------------------------------------------------ boot ---
const boot = new URLSearchParams(location.search);
selected = boot.get('select');
refresh();
setInterval(() => { if (!busy) refresh(); }, 4000);
// hook di test (come WPDEV_SELECT): ?open=new apre il dialog per lo screenshot
if (boot.get('open') === 'new') setTimeout(() => $('#newBtn').click(), 600);
