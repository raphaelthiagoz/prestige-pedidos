/* v23 · movimento sutil: marcador do menu, troca de tela com desfoque, contagem de números, gráfico animado, tooltip, anel. */
(function () {
  'use strict';
  const PP = window.PP, $ = id => document.getElementById(id);
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let flag = ''; try { flag = localStorage.getItem('pp.motion') || ''; } catch (_) { /* ok */ }
  const MO = !reduced && flag !== '0' && (!navigator.webdriver || flag === '1');
  if (MO) document.documentElement.classList.add('mo-on');
  // o VISUAL de vidro (fundo de aquário + cartões translúcidos) vale em todas as telas mesmo com as animações desligadas no sistema
  if (flag !== '0' && (!navigator.webdriver || flag === '1')) document.documentElement.classList.add('gl-on');
  // modo leve (padrão): sem desfoque ao vivo atrás de cada cartão e sem fundo em movimento. "Efeitos completos" liga tudo de volta.
  const fxSync = () => { let on = false; try { on = localStorage.getItem('pp.fxFull') === 'true'; } catch (_) { /* ok */ } document.documentElement.classList.toggle('fx-full', on); };
  fxSync(); window.PPfxSync = fxSync;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- troca de tela ---------- */
  function vt(fn) {
    if (!MO || !document.startViewTransition) { fn(); return; }
    viewAt = Date.now(); const root = document.documentElement; root.classList.add('vt-run');
    try { const t = document.startViewTransition(fn); t.finished.finally(() => root.classList.remove('vt-run')); } catch (_) { root.classList.remove('vt-run'); fn(); }
  }

  /* ---------- menu: marcador deslizante + ondinha ---------- */
  let lastTop = null, lastH = 0, markBusy = false;
  function placeMark() {
    const nav = $('nav'); if (!nav || markBusy) return;
    const sel = nav.querySelector('button[aria-selected="true"]'); let m = $('navMark');
    if (!sel) { if (m) m.remove(); nav.classList.remove('has-mark'); return; }
    markBusy = true;
    if (!m) { m = document.createElement('span'); m.id = 'navMark'; m.setAttribute('aria-hidden', 'true'); nav.insertBefore(m, nav.firstChild); }
    nav.classList.add('has-mark');
    const t = sel.offsetTop, h = sel.offsetHeight;
    if (lastTop == null || !MO) { m.style.transition = 'none'; m.style.height = h + 'px'; m.style.transform = `translateY(${t}px)`; void m.offsetWidth; m.style.transition = ''; }
    else { m.style.transition = 'none'; m.style.height = lastH + 'px'; m.style.transform = `translateY(${lastTop}px)`; void m.offsetWidth; m.style.transition = ''; m.style.height = h + 'px'; m.style.transform = `translateY(${t}px)`; }
    lastTop = t; lastH = h; markBusy = false;
  }
  function ripple(ev) {
    if (!MO) return; const b = ev.target.closest('#nav button'); if (!b) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 1.6, s = document.createElement('span'); s.className = 'mo-rip';
    s.style.cssText = `width:${d}px;height:${d}px;left:${ev.clientX - r.left - d / 2}px;top:${ev.clientY - r.top - d / 2}px`;
    b.appendChild(s); s.addEventListener('animationend', () => s.remove());
  }

  /* ---------- tela Hoje ---------- */
  let prev = {}, tip = null;
  const parse = t => { const m = String(t).trim().match(/^(R\$\s)?(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{2}))?$/); if (!m) return null; return { pre: m[1] || '', v: parseFloat(m[2].replace(/\./g, '') + (m[3] ? '.' + m[3] : '')), dec: !!m[3] }; };
  const fmtN = (v, dec) => v.toLocaleString('pt-BR', { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 });
  function countUp(el, key) {
    const raw = el.textContent, p = parse(raw); if (!p) return;
    const from = prev[key] != null ? prev[key] : 0; prev[key] = p.v;
    if (!MO || from === p.v) return;
    const t0 = performance.now(), dur = 950 + Math.min(600, Math.abs(p.v - from) / 80);
    el.style.fontVariantNumeric = 'tabular-nums';
    (function step(now) {
      const k = Math.max(0, Math.min(1, (now - t0) / dur)), e = 1 - Math.pow(1 - k, 3);
      el.textContent = k >= 1 ? raw : p.pre + fmtN(from + (p.v - from) * e, p.dec);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function ring(root) {
    let L = 0;
    try { const lin = PP.fin && PP.fin._x.linhas(); if (!lin) return; const ab = lin.filter(x => x.saldo > 0), rec = ab.reduce((a, x) => a + x.saldo, 0), at = ab.filter(x => x.s.key === 'atrasado').reduce((a, x) => a + x.saldo, 0); if (rec <= 0) return; L = at / rec; } catch (_) { return; }
    const card = [...root.querySelectorAll('.hk .card')].find(c => /aguardando pagamento/i.test(c.textContent)); if (!card) return;
    const C = 2 * Math.PI * 18, pct = Math.round(L * 100);
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'mo-ring'); s.setAttribute('viewBox', '0 0 44 44'); s.setAttribute('role', 'img'); s.setAttribute('aria-label', pct + '% do que falta receber está atrasado');
    s.innerHTML = `<title>${pct}% do que falta receber está atrasado</title><circle class="rb" cx="22" cy="22" r="18"/><circle class="rf" cx="22" cy="22" r="18" stroke-dasharray="${C}" stroke-dashoffset="${MO ? C : C * (1 - L)}"/><text x="22" y="22">${pct}%</text>`;
    card.appendChild(s);
    if (MO) requestAnimationFrame(() => requestAnimationFrame(() => { const f = s.querySelector('.rf'); if (f) f.style.strokeDashoffset = C * (1 - L); }));
  }
  function chart(root) {
    const svg = root.querySelector('.hchart svg'); if (!svg) return;
    svg.querySelectorAll('g').forEach((g, i) => {
      const t = g.querySelector('title'); if (t) { g.setAttribute('data-tip', t.textContent); t.remove(); }
      g.querySelectorAll('rect').forEach(r => r.style.setProperty('--bi', i));
    });
    svg.querySelectorAll('circle').forEach((c, i) => c.style.setProperty('--ci', i));
    const p = svg.querySelector('path[stroke="#f2f6f7"]'); if (p && p.getTotalLength) { try { p.style.setProperty('--len', Math.ceil(p.getTotalLength()) + 2); } catch (_) { /* ok */ } }
  }
  function enhance() {
    const root = $('vHoje'); if (!root || root.hidden) return;
    root.querySelectorAll('.hk .card, .hg .card, .hq').forEach((c, i) => { if (MO) { c.classList.add('mo-in'); c.style.setProperty('--i', i); } });
    ring(root);
    root.querySelectorAll('.hk .card').forEach((c, i) => { const b = c.querySelector('.big'); if (b) countUp(b, i + '|' + ((c.querySelector('.lb') || {}).textContent || '')); });
    chart(root);
  }
  /* ---------- v24: todas as telas (cartões em cascata, linhas, números, barras) ---------- */
  let viewAt = 0;
  const fresh = () => Date.now() - viewAt < 1400;
  function enhanceAny(root) {
    if (!MO || !root || root.hidden || root.id === 'vHoje' || !fresh()) return;
    let i = 0;
    root.querySelectorAll('.card, .step, .kpis > div, .tabs, .warnbox').forEach(c => { if (c.closest('.mo-in') && !c.classList.contains('mo-in') && c.closest('.mo-in') !== c) return; if (i < 10) { c.classList.add('mo-in'); c.style.setProperty('--i', i++); } });
    root.querySelectorAll('tbody tr').forEach((tr, r) => { if (r < 18) { tr.classList.add('mo-row'); tr.style.setProperty('--r', r); } });
    root.querySelectorAll('.bar .bt i').forEach((b, r) => { b.classList.add('mo-grow'); b.style.setProperty('--r', Math.min(r, 14)); });
    root.querySelectorAll('.kpis b').forEach((b, k) => countUp(b, root.id + '|' + k));
  }

  /* tooltip do gráfico */
  function tipShow(ev) {
    const g = ev.target.closest && ev.target.closest('.hchart svg g[data-tip],.hrec svg g[data-tip]');
    if (!g) { if (tip) tip.classList.remove('on'); return; }
    if (!tip) { tip = document.createElement('div'); tip.className = 'mo-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    const raw = g.getAttribute('data-tip'), i = raw.indexOf(':'), head = raw.slice(0, i), parts = raw.slice(i + 1).split('·').map(s => s.trim()).filter(Boolean);
    tip.innerHTML = `<b>${esc(head)}</b>` + parts.map(s => `<span>${esc(s)}</span>`).join('');
    const w = tip.offsetWidth || 220; tip.style.left = Math.min(innerWidth - w - 12, ev.clientX + 14) + 'px'; tip.style.top = Math.max(8, ev.clientY - 16 - tip.offsetHeight) + 'px'; tip.classList.add('on');
  }
  document.addEventListener('mousemove', ev => {
    tipShow(ev);
    const c = ev.target.closest && ev.target.closest('body[data-view=hoje] #vHoje .card'); if (!c) return;
    const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (ev.clientX - r.left) + 'px'); c.style.setProperty('--my', (ev.clientY - r.top) + 'px');
  }, { passive: true });
  document.addEventListener('mouseleave', () => { if (tip) tip.classList.remove('on'); }, true);
  document.addEventListener('mousedown', ripple, true);

  /* observadores */
  function boot() {
    const nav = $('nav'), hj = $('vHoje');
    if (nav) { new MutationObserver(() => { if (!markBusy) placeMark(); }).observe(nav, { childList: true }); placeMark(); }
    if (hj) { let q = false; new MutationObserver(() => { if (q) return; q = true; Promise.resolve().then(() => { q = false; enhance(); }); }).observe(hj, { childList: true }); enhance(); }
    new MutationObserver(() => { viewAt = Date.now(); if (document.body.dataset.view !== 'hoje') prev = {}; }).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
    document.querySelectorAll('main > div[id^=v]').forEach(v => { if (v.id === 'vHoje') return; let q = false; new MutationObserver(() => { if (q) return; q = true; Promise.resolve().then(() => { q = false; enhanceAny(v); }); }).observe(v, { childList: true }); });
    addEventListener('resize', () => { lastTop = null; placeMark(); });
  }
  PP.motion = { vt, enabled: MO, enhance, chart };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);
})();
