/* v29.15 · tela Hoje: previsão do que vai ser recebido (gráfico) e pilha de cartões das próximas programações. */
(function () {
  'use strict';
  const PP = window.PP, S = PP.S, store = PP.store, F = PP.Features, esc = PP.esc, fmt = PP.fmt;
  const dBR = iso => (iso ? String(iso).split('-').reverse().join('/') : '');
  const dm = iso => String(iso).split('-').reverse().slice(0, 2).join('/');
  const prazo = () => S.cfg.prazoPag || 7;
  const addDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return F.todayISO(d); };
  const diffDias = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
  const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const ST = { dias: 30, cur: 0 };
  try { const v = +store.get('hjDias', 30); if ([15, 30, 60].includes(v)) ST.dias = v; } catch (_) { /* ok */ }

  /* ---------- previsão a receber ---------- */
  function pontos(N) {
    const hoje = F.todayISO(), step = Math.max(1, Math.round(N / 5)), L = [];
    (S.hist || []).filter(F.active).forEach(e => {
      const s = F.situacao(e, hoje, prazo()); if (!(s.saldo > 0)) return;
      L.push({ v: addDias(e.dataISO, prazo()), saldo: s.saldo });
    });
    const B = [{ k: 'atr', nome: 'Atrasado', rot: 'Atras.', n: 0, v: 0 }, { k: 'hoje', nome: 'Hoje', rot: 'Hoje', n: 0, v: 0 }];
    for (let i = 0; i < 5; i++) { const ini = addDias(hoje, 1 + i * step), fim = addDias(hoje, (i + 1) * step); B.push({ k: 'fut', nome: dm(ini) + (step > 1 ? ' a ' + dm(fim) : ''), rot: dm(fim), ini, fim, n: 0, v: 0 }); }
    let depois = 0, nDepois = 0; const lim = addDias(hoje, 5 * step);
    L.forEach(x => {
      if (x.v < hoje) { B[0].v += x.saldo; B[0].n++; } else if (x.v === hoje) { B[1].v += x.saldo; B[1].n++; }
      else if (x.v > lim) { depois += x.saldo; nDepois++; }
      else { const b = B.find(q => q.k === 'fut' && x.v >= q.ini && x.v <= q.fim); if (b) { b.v += x.saldo; b.n++; } }
    });
    let acc = 0; B.forEach(b => { b.v = F.r2(b.v); acc += b.v; b.acc = F.r2(acc); });
    return { B, total: F.r2(acc), depois: F.r2(depois), nDepois, dias: step * 5, step };
  }
  function receber() {
    const P = pontos(ST.dias), N = P.B.reduce((a, b) => a + b.n, 0);
    const seg = [15, 30, 60].map(d => `<button type="button" data-rd="${d}" aria-pressed="${d === ST.dias}">${d} dias</button>`).join('');
    const head = `<div class="lb"><span>A receber · previsão</span><span class="seg" role="group" aria-label="Período da previsão">${seg}</span></div>`;
    if (!N && !P.nDepois) return `<div class="card hchart" id="hjRec">${head}<div class="hrnone">Nada a receber nos pedidos nacionais em aberto.</div></div>`;
    const W = 600, H = 210, pl = 30, pr = 30, pt = 26, pb = 40, iw = W - pl - pr, ih = H - pt - pb, mx = Math.max(1, P.total);
    const X = i => pl + iw * i / (P.B.length - 1), Y = v => pt + ih - ih * v / mx;
    const pts = P.B.map((b, i) => [X(i), Y(b.acc)]);
    const lin = a => a.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const solido = lin(pts.slice(0, 2)), pontil = lin(pts.slice(1));
    let g = '';
    for (let k = 0; k < 3; k++) { const y = pt + ih * k / 2; g += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.07)"/>`; }
    const cor = b => b.k === 'atr' ? '#ef7b7b' : b.k === 'hoje' ? '#f0b94d' : '#3fd6c8';
    const dots = P.B.map((b, i) => {
      const tip = `${b.nome}: ${b.v > 0 ? 'R$ ' + fmt(b.v) + ' a receber' : 'nada a vencer'} · ${b.n} pedido${b.n === 1 ? '' : 's'} · acumulado R$ ${fmt(b.acc)}`;
      return `<g data-tip="${esc(tip)}"><rect x="${(X(i) - iw / 14).toFixed(1)}" y="${pt - 10}" width="${(iw / 7).toFixed(1)}" height="${ih + 20}" fill="transparent" style="animation:none"/><circle cx="${X(i).toFixed(1)}" cy="${Y(b.acc).toFixed(1)}" r="${b.v > 0 ? 6 : 4}" fill="${cor(b)}" stroke="#0e1a1d" stroke-width="2" style="--ci:${i}"/><text x="${X(i).toFixed(1)}" y="${H - 16}" text-anchor="middle" fill="${b.k === 'atr' ? '#ef7b7b' : '#9fb4bb'}" font-size="12">${esc(b.rot)}</text></g>`;
    }).join('');
    const ate = `R$ ${fmt(P.total)}`;
    const depois = P.nDepois ? `<span> · mais R$ ${fmt(P.depois)} vence depois de ${P.dias} dias</span>` : '';
    return `<div class="card hchart" id="hjRec">${head}
      <div class="hrbig"><b>${ate}</b><small>a vencer até ${dBR(addDias(F.todayISO(), P.dias))}${depois}</small></div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Previsão acumulada do que vai ser recebido nos próximos ${P.dias} dias">${g}
        <path d="${solido}" fill="none" stroke="#f2f6f7" stroke-width="2.4" stroke-linecap="round"/>
        <path d="${pontil}" fill="none" stroke="#9fb4bb" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="2 7" style="animation:none"/>
        ${dots}</svg>
      <div class="hrleg"><span><i style="background:#ef7b7b"></i>Atrasado</span><span><i style="background:#f0b94d"></i>Vence hoje</span><span><i style="background:#3fd6c8"></i>A vencer</span><span class="hrn">Linha cheia: já venceu · pontilhada: previsão</span></div></div>`;
  }

  /* ---------- pilha de próximas programações ---------- */
  function proximas() {
    const hoje = F.todayISO(), emb = (S.embarques || []).filter(e => e.saida > hoje && (e.linhas || []).length).sort((a, b) => a.saida.localeCompare(b.saida));
    return emb.slice(0, 6);
  }
  function cartao(e, i) {
    const L = e.linhas || [], cx = L.reduce((a, l) => a + (l.caixas || 0), 0), n = diffDias(F.todayISO(), e.saida), d = new Date(e.saida + 'T12:00:00');
    const nomes = L.slice(0, 3).map(l => esc(l.cliente || '—')).join(', ') + (L.length > 3 ? ' e mais ' + (L.length - 3) : '');
    return `<div class="stc" data-sc="${i}" data-pos="${i}"><div class="stl"><b>${WD[d.getDay()][0].toUpperCase() + WD[d.getDay()].slice(1)}, ${dBR(e.saida).slice(0, 5)}</b><span>${n === 1 ? 'amanhã' : 'em ' + n + ' dias'}</span></div>
      <div class="stm">${L.length} cliente${L.length === 1 ? '' : 's'} · ${cx} caixa${cx === 1 ? '' : 's'}</div><div class="stn">${nomes}</div>
      <button type="button" class="stg" data-pst="abrir" data-eid="${esc(e.id)}">Abrir esta programação</button></div>`;
  }
  function pilha() {
    const P = proximas(); if (!P.length) return '';
    if (ST.cur >= P.length) ST.cur = 0;
    const mult = P.length > 1;
    return `<div class="card" id="hjPilha"><div class="lb"><span>Próximas programações</span><span>${P.length}</span></div>
      <div class="stk" style="--n:${P.length}">${P.map(cartao).join('')}</div>
      ${mult ? `<div class="stnav"><button type="button" data-pst="prev" aria-label="Programação anterior">‹</button><span class="sdots">${P.map((_, i) => `<i data-pst="go" data-i="${i}"></i>`).join('')}</span><button type="button" data-pst="next" aria-label="Próxima programação">›</button></div>` : ''}</div>`;
  }
  function place() {
    const box = document.getElementById('hjPilha'); if (!box) return;
    const cs = [...box.querySelectorAll('.stc')], n = cs.length;
    cs.forEach((c, i) => { const p = (i - ST.cur + n) % n; c.dataset.pos = p; c.setAttribute('aria-hidden', p ? 'true' : 'false'); c.querySelectorAll('button').forEach(b => { b.tabIndex = p ? -1 : 0; }); });
    box.querySelectorAll('.sdots i').forEach((d, i) => d.classList.toggle('on', i === ST.cur));
  }
  function after() { place(); }

  document.addEventListener('click', e => {
    const root = document.getElementById('vHoje'); if (!root || !root.contains(e.target)) return;
    const rd = e.target.closest('[data-rd]');
    if (rd) { ST.dias = +rd.dataset.rd; try { store.set('hjDias', ST.dias); } catch (_) { /* ok */ } const c = document.getElementById('hjRec'); if (c) { const t = document.createElement('div'); t.innerHTML = receber(); c.replaceWith(t.firstElementChild); } return; }
    const sc = e.target.closest('[data-pst]');
    if (sc) {
      const a = sc.dataset.pst, n = document.querySelectorAll('#hjPilha .stc').length;
      if (a === 'abrir') { PP.extra.ST.emb.sel = sc.dataset.eid; PP.go('embarque'); return; }
      if (a === 'next') ST.cur = (ST.cur + 1) % n; else if (a === 'prev') ST.cur = (ST.cur - 1 + n) % n; else if (a === 'go') ST.cur = +sc.dataset.i;
      place(); return;
    }
    const back = e.target.closest('#hjPilha .stc'); // clicar num cartão de trás traz ele para a frente
    if (back && back.dataset.pos !== '0') { ST.cur = +back.dataset.sc; place(); }
  });
  new MutationObserver(() => after()).observe(document.getElementById('vHoje') || document.body, { childList: true });
  PP.hojeplus = { receber, pilha, pontos, proximas, after, ST };
})();
