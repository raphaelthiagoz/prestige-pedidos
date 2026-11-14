/* Prestige Pedidos — barra superior (criar, ocultar valores, avisos, avatar) e o motor de "ocultar valores". */
(function () {
  'use strict';
  const PP = window.PP, store = PP.store, $ = id => document.getElementById(id), esc = PP.esc;
  const SV = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 6.1A9.5 9.5 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4M6.4 7.6A16.5 16.5 0 002 12s3.6 7 10 7a9.7 9.7 0 004-.9M9.9 9.9a3 3 0 004.2 4.2"/>',
    bell: '<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15zM10 21h4"/>'
  };
  const svg = n => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SV[n]}</svg>`;

  /* ---------- ocultar valores ---------- */
  // Só mexe no que é mostrado na tela. Documentos, PDFs e campos de digitação não são tocados.
  const RX = /R\$\s?-?\d+(?:\.\d{3})*(?:,\d+)?|-?\d{1,3}(?:\.\d{3})*,\d{2}/g;
  const SKIP = 'script,style,textarea,input,select,option,.pv,[data-nomask],.rpg,.rpcapa,.orcpg,.xstage,.xmbox,#config';
  const ROOTS = '#vHoje,#vPedido,#vGta,#vAt,#vEmb,#vHist,#vFinanceiro,#vPainel,#vEmbarque,#vRelat,#vEstoque,#vExp,#vFrete,#vMapa,#vTarefas,#vClientes,#banners,#assist,#toasts,#hDet,#srch,#sideP';
  let on = false, mo = null;
  function wrapNode(root) {
    if (!root || (root.nodeType !== 1 && root.nodeType !== 3)) return;
    const base = root.nodeType === 3 ? root.parentNode : root;
    if (!base || !base.closest || base.closest(SKIP)) return;
    const has = v => { RX.lastIndex = 0; const r = RX.test(v); RX.lastIndex = 0; return r; };
    const L = [];
    if (root.nodeType === 3) { if (has(root.nodeValue)) L.push(root); }
    else { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (has(n.nodeValue) && !n.parentNode.closest(SKIP)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }); let n; while ((n = w.nextNode())) L.push(n); }
    L.forEach(t => {
      const s = t.nodeValue, f = document.createDocumentFragment(); let i = 0, m; RX.lastIndex = 0;
      while ((m = RX.exec(s))) { if (m.index > i) f.appendChild(document.createTextNode(s.slice(i, m.index))); const sp = document.createElement('span'); sp.className = 'pv'; sp.textContent = m[0]; f.appendChild(sp); i = m.index + m[0].length; }
      if (i < s.length) f.appendChild(document.createTextNode(s.slice(i)));
      RX.lastIndex = 0; t.parentNode.replaceChild(f, t);
    });
  }
  function wrapAll() { document.querySelectorAll(ROOTS).forEach(r => wrapNode(r)); }
  function handle(n) {
    if (!n.isConnected) return; const el = n.nodeType === 1 ? n : n.parentNode; if (!el || !el.closest) return;
    if (el.closest(ROOTS)) wrapNode(n); else if (n.nodeType === 1) n.querySelectorAll(ROOTS).forEach(wrapNode);
  }
  function startObs() {
    if (mo) return;
    let q = false, pend = new Set();
    const OPT = { childList: true, subtree: true, characterData: true };
    mo = new MutationObserver(ms => {
      ms.forEach(m => { m.addedNodes.forEach(n => pend.add(n)); if (m.type === 'characterData') pend.add(m.target); });
      if (q) return; q = true;
      Promise.resolve().then(() => { q = false; const L = [...pend]; pend = new Set(); if (!mo) return; mo.disconnect(); L.forEach(handle); if (mo) mo.observe(document.body, OPT); });
    });
    mo.observe(document.body, OPT);
  }
  function stopObs() { if (mo) { mo.disconnect(); mo = null; } }
  function sync() {
    const b = $('btnEye'); document.documentElement.classList.toggle('hide-vals', on);
    if (b) { b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Mostrar valores' : 'Ocultar valores'); b.title = on ? 'Mostrar valores' : 'Ocultar valores'; b.innerHTML = svg(on ? 'eyeoff' : 'eye'); }
    if (on) { wrapAll(); startObs(); } else stopObs();
  }
  function setHide(v, quiet) { on = !!v; store.set('hideVals', on); sync(); if (!quiet) PP.toast(on ? 'Valores ocultos. Clique no olho para mostrar.' : 'Valores visíveis.'); }
  PP.vals = { get on() { return on; }, set: setHide, toggle: () => setHide(!on), wrap: wrapAll };

  /* ---------- menus da barra ---------- */
  let pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } }
  function openPop(anchor, html, key) {
    if (pop && pop.dataset.k === key) { closePop(); return null; }
    closePop(); const p = document.createElement('div'); p.className = 'tpop'; p.dataset.k = key; p.setAttribute('role', 'menu'); p.innerHTML = html; document.body.appendChild(p);
    const r = anchor.getBoundingClientRect(), w = p.offsetWidth;
    p.style.left = Math.max(10, Math.min(innerWidth - w - 10, r.right - w)) + 'px'; p.style.top = (r.bottom + 8) + 'px'; pop = p; return p;
  }
  const initials = () => { const n = String(store.get('uNome', 'Raphael') || '').trim(); const w = n.split(/\s+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[1][0] : n.slice(0, 2)).toUpperCase() || '?'; };
  function plusMenu(a) {
    openPop(a, '<h5>Criar</h5><button type="button" data-tq="novo">Novo pedido nacional</button><button type="button" data-tq="exp">Nova exportação</button><button type="button" data-tq="frete">Anexar CTEs</button><button type="button" data-tq="embarque">Programação de voos</button>', 'plus');
  }
  function bellMenu(a) {
    let L = []; try { L = PP.assist ? PP.assist.items() : []; } catch (_) { L = []; }
    openPop(a, '<h5>Avisos</h5>' + (L.length ? L.slice(0, 4).map((x, i) => `<button type="button" class="tnt" data-tb="${i}"><b>${esc(x.title)}</b><small>${esc(x.sub || '')}</small></button>`).join('') + (L.length > 4 ? `<div class="tmore">+ ${L.length - 4} outras. Veja todas na tela Hoje.</div>` : '') : '<div class="tnt0"><b>Tudo em dia</b><small>Nenhum aviso agora.</small></div>'), 'bell');
  }
  function refreshBell() { const d = $('btnBell') && $('btnBell').querySelector('.dot'); if (!d) return; let n = 0; try { n = PP.assist ? PP.assist.items().length : 0; } catch (_) { n = 0; } d.hidden = !n; }
  function build() {
    const b = $('btnSearch'); if (!b || $('tools')) return;
    const t = document.createElement('div'); t.id = 'tools'; t.className = 'tools'; b.parentNode.insertBefore(t, b); t.appendChild(b);
    t.insertAdjacentHTML('beforeend', `<button type="button" class="ib pri" id="btnPlus" aria-label="Criar novo" aria-haspopup="menu" title="Criar novo">${svg('plus')}</button><span class="tsep" aria-hidden="true"></span><button type="button" class="ib" id="btnEye" aria-pressed="false" aria-label="Ocultar valores" title="Ocultar valores"></button><button type="button" class="ib" id="btnBell" aria-label="Avisos" aria-haspopup="menu" title="Avisos">${svg('bell')}<i class="dot" hidden></i></button><button type="button" class="ib avt" id="btnAvt" aria-label="Abrir configurações" title="Configurações"></button>`);
    $('btnAvt').textContent = initials();
    $('btnPlus').addEventListener('click', e => { e.stopPropagation(); plusMenu(e.currentTarget); });
    $('btnEye').addEventListener('click', e => { e.stopPropagation(); closePop(); setHide(!on); });
    $('btnBell').addEventListener('click', e => { e.stopPropagation(); bellMenu(e.currentTarget); });
    $('btnAvt').addEventListener('click', e => { e.stopPropagation(); closePop(); $('btnCfg').click(); });
  }
  document.addEventListener('click', e => {
    const q = e.target.closest('[data-tq]'); if (q) { const k = q.dataset.tq; closePop(); if (k === 'novo') { PP.go('pedido'); PP.newOrder && PP.newOrder(); } else PP.go(k); return; }
    const bl = e.target.closest('[data-tb]'); if (bl) { closePop(); if (PP.assist && PP.assist.open) PP.assist.open(+bl.dataset.tb); return; }
    if (pop && !e.target.closest('.tpop')) closePop();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
  window.addEventListener('scroll', closePop, { passive: true });
  document.addEventListener('input', e => { if (e.target && e.target.id === 'uNome' && $('btnAvt')) $('btnAvt').textContent = initials(); });
  build();
  on = !!store.get('hideVals', false); sync();
  refreshBell(); setInterval(refreshBell, 4000);
  document.addEventListener('click', () => setTimeout(refreshBell, 300), true);
})();
