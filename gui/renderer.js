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
  con.style.display = 'block';
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
        if (evt.event === 'log') { con.textContent += `• ${evt.msg}\n`; con.scrollTop = con.scrollHeight; }
        else if (evt.event === 'error') throw new Error(evt.message);
        else if (evt.event === 'done') final = evt.result;
      }
    }
    con.textContent += '✔ fatto\n';
    return final;
  } catch (err) {
    con.textContent += `✖ ERRORE: ${err.message}\n`;
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

// ----------------------------------------------------------------- render ---
function renderSidebar() {
  const list = $('#siteList');
  list.innerHTML = '';
  for (const s of sites) {
    const el = document.createElement('div');
    el.className = 'siteItem' + (s.slug === selected ? ' sel' : '');
    const cls = s.status === 'running' ? (s.fpm ? 'on' : 'err') : '';
    el.innerHTML = `<span class="dot ${cls}"></span><span>${s.slug}</span>`;
    el.onclick = () => { selected = s.slug; tab = 'panoramica'; renderAll(); };
    list.appendChild(el);
  }
  if (sites.length === 0) list.innerHTML = '<div class="empty" style="padding:24px 10px">nessun sito</div>';
}

function site() { return sites.find((s) => s.slug === selected) ?? null; }

function renderTop() {
  const s = site();
  $('#siteTitle').textContent = s ? `${s.slug}` : 'wpdev';
  const a = $('#topActions');
  a.innerHTML = '';
  if (!s) return;
  const running = s.status === 'running';
  const mk = (label, cls, fn, dis) => {
    const b = document.createElement('button');
    b.textContent = label; b.className = cls; b.disabled = busy || dis;
    b.onclick = fn; a.appendChild(b);
  };
  mk(running ? '■ Stop' : '▶ Start', running ? '' : 'primary',
    () => apiOp('POST', `/api/sites/${s.slug}/${running ? 'stop' : 'start'}`));
  mk('↻ Restart', '', () => apiOp('POST', `/api/sites/${s.slug}/restart`), !running);
  mk('Apri', '', () => open(s.url), !running);
  mk('Admin', '', async () => {
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

async function renderContent() {
  const c = $('#content');
  const s = site();
  if (!s) { c.innerHTML = '<div class="empty">Seleziona un sito o creane uno nuovo.</div>'; return; }

  if (tab === 'panoramica') {
    const { site: full } = await api('GET', `/api/sites/${s.slug}`);
    c.innerHTML = `
      <div class="card"><h3>Sito</h3>
        <table class="kv">
          <tr><td>URL</td><td><a id="lnkUrl">${full.url}</a></td></tr>
          <tr><td>Stato</td><td>${s.status}${s.status === 'running' && !s.fpm ? ' ⚠ php-fpm giù' : ''}</td></tr>
          <tr><td>PHP</td><td>${full.phpVersion}${full.xdebug ? ' + xdebug' : ''}</td></tr>
          <tr><td>Webroot</td><td><code>${full.webroot}</code></td></tr>
          <tr><td>Admin WP</td><td><code>${full.adminUser}</code> / <code>${full.adminPass}</code></td></tr>
          <tr><td>Database</td><td><code>${full.db.name}</code> — utente <code>${full.db.user}</code> <a id="lnkDbPass">(copia password)</a></td></tr>
          <tr><td>Blueprint</td><td>${full.blueprint ?? 'n/d'}</td></tr>
        </table>
      </div>
      <div class="card"><h3>Azioni</h3>
        <div class="row">
          <button id="bShell">Shell (copia comando)</button>
          <button id="bCli">wp-cli (copia comando)</button>
          <button id="bDb">Adminer</button>
          <button id="bExport">Esporta (zip+sql)</button>
          <button id="bClone">Clona…</button>
          <button id="bXdebug">xdebug ${full.xdebug ? 'off' : 'on'}</button>
          <button id="bDelete" class="danger">Elimina sito</button>
        </div>
      </div>`;
    $('#lnkUrl').onclick = () => open(full.url);
    $('#lnkDbPass').onclick = () => copy(full.db.pass);
    $('#bShell').onclick = () => copy(`wpdev shell ${s.slug}`);
    $('#bCli').onclick = () => copy(`wpdev cli ${s.slug} -- `);
    $('#bDb').onclick = () => {
      const adminerBase = full.url.replace(`${full.domain}`, 'adminer.localhost');
      open(`${adminerBase}/?server=localhost&username=${full.db.user}&db=${full.db.name}`);
      copy(full.db.pass); // la password serve nel form Adminer
    };
    $('#bExport').onclick = async () => {
      const r = await apiOp('POST', `/api/sites/${s.slug}/export`);
      if (r) toast(`export in ${r.zip.replace(/.*\//, '~/wpdev-exports/')}`);
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
    c.innerHTML = `
      <div class="card"><h3>Live Link (cloudflared)</h3>
        ${sh?.url ? `
          <table class="kv">
            <tr><td>URL pubblico</td><td><a id="lnkShare">${sh.url}</a> <a id="cpShare">(copia)</a></td></tr>
            <tr><td>Accesso</td><td><code>${sh.authUser}</code> / <code>${sh.authPass}</code> <a id="cpAuth">(copia)</a></td></tr>
          </table>
          <div class="row"><button id="bUnshare" class="danger">Ferma Live Link</button></div>
        ` : `
          <p style="color:var(--muted);margin-bottom:12px">Espone il sito su un URL pubblico temporaneo (basic auth). L'URL cambia a ogni avvio.</p>
          <div class="row"><button id="bShare" class="primary" ${s.status !== 'running' ? 'disabled' : ''}>Avvia Live Link</button></div>
        `}
      </div>`;
    if (sh?.url) {
      $('#lnkShare').onclick = () => open(sh.url);
      $('#cpShare').onclick = () => copy(sh.url);
      $('#cpAuth').onclick = () => copy(`${sh.authUser}:${sh.authPass}`);
      $('#bUnshare').onclick = () => apiOp('DELETE', `/api/sites/${s.slug}/share`);
    } else {
      $('#bShare')?.addEventListener('click', () => apiOp('POST', `/api/sites/${s.slug}/share`, {}));
    }
  }

  if (tab === 'log') {
    const { logs } = await api('GET', `/api/sites/${s.slug}/logs?tail=80`);
    const blocks = Object.entries(logs).map(([f, lines]) =>
      `<h3 style="margin:10px 0 6px;color:var(--muted)">${f}</h3><pre class="log">${
        lines.map((l) => l.replace(/</g, '&lt;')).join('\n') || '(vuoto)'
      }</pre>`).join('');
    c.innerHTML = `<div class="row"><button id="bReload">↻ Aggiorna</button></div>${blocks || '<div class="empty">nessun log</div>'}`;
    $('#bReload').onclick = renderContent;
  }

  if (tab === 'mailpit') {
    c.innerHTML = `
      <div class="row"><button id="bMpOpen">Apri nel browser</button></div>
      <iframe id="mailpit" src="http://127.0.0.1:8025"></iframe>`;
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

// ----------------------------------------------------------- nuovo sito ---
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
  $('#fSlug').value = ''; $('#fTitle').value = '';
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
selected = new URLSearchParams(location.search).get('select');
refresh();
setInterval(() => { if (!busy) refresh(); }, 4000);
