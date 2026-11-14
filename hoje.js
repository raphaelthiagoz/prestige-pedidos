/* Tela "Hoje", busca global (Ctrl+K) e avisos (toasts). */
(function () {
  'use strict';
  const PP = window.PP, S = PP.S, store = PP.store, F = PP.Features, esc = PP.esc, $ = PP.$, fmt = PP.fmt;
  const dBR = iso => (iso ? String(iso).split('-').reverse().join('/') : '');
  const p3 = n => String(n).padStart(3, '0');
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const prazo = () => S.cfg.prazoPag || 7;
  const fretes = () => store.get('fretes', { cfg: { taxa: 90 }, rec: {} }) || { cfg: { taxa: 90 }, rec: {} };

  /* ---------- avisos ---------- */
  PP.toast = function (msg, kind, ms) {
    const box = $('toasts'); if (!box) return;
    const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg; box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms || 3200);
  };

  /* ---------- dados ---------- */
  const nome = () => (store.get('uNome', 'Raphael') || '').trim();
  const saud = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
  const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'], MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dataExt = () => { const d = new Date(); return `${DIAS[d.getDay()][0].toUpperCase() + DIAS[d.getDay()].slice(1)}, ${d.getDate()} de ${MESES[d.getMonth()]}`; };

  function freteLinhas() {
    const D = fretes(), FC = PP.frete && PP.frete.FC, out = [];
    (S.embarques || []).forEach(e => (e.linhas || []).forEach(l => { const r = D.rec[e.id + '|' + l.id] || {}, t = FC ? FC.totalOf(r, D.cfg) : 0; out.push({ e, l, r, t }); }));
    return out;
  }
  function stats() {
    const hoje = F.todayISO(), emb = (S.embarques || []).slice().sort((a, b) => a.saida.localeCompare(b.saida));
    const hojeE = emb.filter(e => e.saida === hoje), prox = emb.find(e => e.saida > hoje) || null;
    const linHoje = hojeE.flatMap(e => e.linhas || []), cxHoje = linHoje.reduce((a, l) => a + (l.caixas || 0), 0), embarcados = linHoje.filter(l => l.status === 'embarcado' || l.status === 'chegou').length;
    const fl = freteLinhas(), aberto = fl.filter(x => x.t > 0 && !x.r.pago), abertoTot = F.r2(aberto.reduce((a, x) => a + x.t, 0));
    let aguardando = 0, atrasados = 0, atrasoDias = 0;
    (S.hist || []).filter(F.active).forEach(e => { const s = F.situacao(e, hoje, prazo()); if (s.saldo > 0) { aguardando += s.saldo; if (s.key === 'atrasado') { atrasados++; atrasoDias = Math.max(atrasoDias, s.dias - prazo()); } } });
    const xs = PP.exp ? PP.exp.hist().slice() : [];
    const dep = e => String((e.ex && e.ex.dep) || e.dateISO || '').slice(0, 10);
    const fut = xs.filter(e => dep(e) >= hoje).sort((a, b) => dep(a).localeCompare(dep(b)))[0] || xs.slice().sort((a, b) => b.n - a.n)[0] || null;
    return { hoje, hojeE, prox, linHoje, cxHoje, embarcados, aberto, abertoTot, aguardando: F.r2(aguardando), atrasados, atrasoDias, fut, dep };
  }
  /* ---------- vendas programadas: o que está na Programação (nacionais) e as exportações salvas ---------- */
  const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const expDate = e => String((e.ex && e.ex.dep) || e.dateISO || '').slice(0, 10);
  function semData() { return (PP.exp ? PP.exp.hist() : []).filter(e => !expDate(e)); } // exportações sem data marcada ainda
  function buckets(kind, lim) { // 'sem' = 8 semanas a partir da atual · 'dia' = só os dias que têm venda (a partir de hoje)
    const hoje = F.todayISO(), B = [];
    if (kind === 'dia') {
      const ds = new Set();
      (S.embarques || []).forEach(emb => { const k = String(emb.saida || '').slice(0, 10); if (k >= hoje && (emb.linhas || []).length) ds.add(k); });
      (PP.exp ? PP.exp.hist() : []).forEach(e => { const k = expDate(e); if (k && k >= hoje) ds.add(k); });
      [...ds].sort().slice(0, lim || 30).forEach(d => B.push({ ini: d, fim: d, now: d === hoje, lb: d.slice(8) + '/' + d.slice(5, 7), lb2: WD[new Date(d + 'T12:00:00').getDay()] }));
    } else { const dt = new Date(hoje + 'T12:00:00'), wd = (dt.getDay() + 6) % 7, ini = F.addDays(hoje, -wd); for (let i = 0; i < 8; i++) { const d = F.addDays(ini, i * 7); B.push({ ini: d, fim: F.addDays(d, 6), now: i === 0, lb: i === 0 ? 'esta sem.' : d.slice(8) + '/' + d.slice(5, 7), lb2: '' }); } }
    B.forEach(x => { x.nn = 0; x.nc = 0; x.en = 0; x.ec = 0; x.cli = []; x.exps = []; });
    const put = (date, fn) => { const k = String(date || '').slice(0, 10); const w = B.find(x => k >= x.ini && k <= x.fim); if (w) fn(w); };
    (S.embarques || []).forEach(emb => (emb.linhas || []).forEach(l => put(emb.saida, w => { w.nn++; w.nc += l.caixas || 0; w.cli.push((l.cliente || '—') + (l.caixas ? ' (' + l.caixas + ' cx)' : '')); })));
    (PP.exp ? PP.exp.hist() : []).forEach(e => put(expDate(e), w => { const bx = (e.tot && e.tot.boxes) || 0; w.en++; w.ec += bx; w.exps.push(p3(e.n) + '/' + e.ano + ' · ' + ((e.cons && e.cons.name) || '—') + ' (' + bx + ' cx)'); }));
    return B;
  }
  function smooth(pts) {
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2; d += ` C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`; }
    return d;
  }
  const fmtInt0 = n => Number(n || 0).toLocaleString('pt-BR');
  const vend = x => x.nn + x.en, cxs = x => x.nc + x.ec;
  const pl = (n, u, p) => n + ' ' + (n === 1 ? u : (p || u + 's'));
  function chartSVG(B, o) {
    o = o || {}; const n = B.length, w = 600, h = o.h || 226, pad = 10, step = (w - pad * 2) / n, bw = Math.min(o.bw || 40, step * 0.7), base = h - 34, top = 40;
    const max = Math.max(1, ...B.map(cxs)), vmax = Math.max(1, ...B.map(vend));
    const y = v => base - (v / max) * (base - top - 10), yv = v => base - (v / vmax) * (base - top), cx = i => pad + i * step + step / 2;
    const every = o.every || 1;
    const bars = B.map((x, i) => {
      const yn = y(x.nc), ye = y(x.nc + x.ec), t = cxs(x), lab = i % every === 0;
      return `<g><title>${x.lb}${x.lb2 ? ' (' + x.lb2 + ')' : ''}: ${pl(x.nn, 'venda nacional', 'vendas nacionais')} · ${x.nc} cx nacionais · ${pl(x.en, 'exportação', 'exportações')} · ${x.ec} cx de exportação</title>
        ${x.nc ? `<rect x="${cx(i) - bw / 2}" y="${yn}" width="${bw}" height="${base - yn}" rx="${bw > 12 ? 5 : 2}" fill="#3fd6c8" fill-opacity=".85"/>` : ''}
        ${x.ec ? `<rect x="${cx(i) - bw / 2}" y="${ye}" width="${bw}" height="${yn - ye}" rx="${bw > 12 ? 5 : 2}" fill="#e8c15a" fill-opacity=".85"/>` : ''}
        ${lab ? `<text x="${cx(i)}" y="${h - 17}" text-anchor="middle" font-size="${o.fs || 10}" fill="${x.now ? '#3fd6c8' : '#8a9aa3'}">${x.lb}</text>` : ''}
        ${lab && !o.noCx ? `<text x="${cx(i)}" y="${h - 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${t ? '#dbe6ea' : '#55636a'}">${t ? t + ' cx' : '—'}</text>` : ''}</g>`;
    }).join('');
    const pts = B.map((x, i) => [cx(i), yv(vend(x))]);
    const curve = B.some(x => vend(x) > 0) ? `<path d="${o.line ? 'M' + pts.map(p => p.join(' ')).join(' L') : smooth(pts)}" fill="none" stroke="#f2f6f7" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` + B.map((x, i) => vend(x) > 0 ? `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="3.6" fill="#f2f6f7" stroke="#0b1114" stroke-width="1.5"/>${o.noPill ? '' : `<rect x="${pts[i][0] - 33}" y="${pts[i][1] - 25}" width="66" height="16" rx="8" fill="#182024" stroke="#f2f6f7" stroke-opacity=".45"/><text x="${pts[i][0]}" y="${pts[i][1] - 13.5}" text-anchor="middle" font-size="10" font-weight="600" fill="#f2f6f7">${pl(vend(x), 'venda')}</text>`}` : '').join('') : '';
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Caixas e quantidade de vendas programadas"><g stroke="rgba(255,255,255,.07)">${[0.33, 0.66].map(k => `<path d="M0 ${top + (base - top) * k}H${w}"/>`).join('')}<path d="M0 ${base}H${w}" stroke="rgba(255,255,255,.15)"/></g>${bars}${curve}</svg>`;
  }
  const sumB = (B, f) => B.reduce((a, x) => a + f(x), 0);
  function legend(B) {
    return `<div class="hleg"><span><b style="color:#3fd6c8">●</b> Caixas nacionais · ${fmtInt0(sumB(B, x => x.nc))}</span><span><b style="color:#e8c15a">●</b> Caixas exportação · ${fmtInt0(sumB(B, x => x.ec))}</span><span><b style="color:#f2f6f7">●</b> Vendas (curva) · ${fmtInt0(sumB(B, vend))}</span></div>`;
  }
  function semDataNote() {
    const L = semData(); if (!L.length) return '';
    return `<p class="note" style="margin:8px 0 0"><b>${L.length} exportação(ões) sem data marcada ainda</b> (não aparecem no gráfico): ${L.map(e => esc(p3(e.n) + '/' + e.ano + ' · ' + ((e.cons && e.cons.name) || '—'))).join(' · ')}</p>`;
  }
  function chart() {
    const B = buckets('dia', 12);
    if (!B.some(x => vend(x) > 0 || cxs(x) > 0)) return '<p class="empty">Ainda não há vendas com data a partir de hoje. Coloque pedidos na Programação de voos e salve as exportações com data: elas aparecem aqui.</p>' + semDataNote();
    return chartSVG(B) + legend(B) + semDataNote();
  }
  /* detalhe clicável */
  let DET = { open: false, k: 'dia' };
  function detTable(B) {
    const L = B.filter(x => vend(x) > 0 || cxs(x) > 0);
    if (!L.length) return '<p class="empty">Nada programado neste período.</p>';
    return `<div class="tablewrap"><table class="hdt"><thead><tr><th>${DET.k === 'dia' ? 'Dia' : 'Semana de'}</th><th class="n">Vendas nacionais</th><th class="n">Caixas nacionais</th><th class="n">Exportações</th><th class="n">Caixas exportação</th><th class="n">Total de caixas</th></tr></thead><tbody>`
      + L.map(x => `<tr><td><b>${x.lb === 'esta sem.' ? dBR(x.ini).slice(0, 5) + ' (esta semana)' : x.lb}</b>${x.lb2 ? ' <span class="note">' + x.lb2 + '</span>' : ''}<div class="note">${[...x.cli, ...x.exps].map(esc).join(' · ')}</div></td><td class="n">${x.nn}</td><td class="n">${fmtInt0(x.nc)}</td><td class="n">${x.en}</td><td class="n">${fmtInt0(x.ec)}</td><td class="n"><b>${fmtInt0(cxs(x))}</b></td></tr>`).join('')
      + `</tbody><tfoot><tr><td><b>Total</b></td><td class="n"><b>${sumB(B, x => x.nn)}</b></td><td class="n"><b>${fmtInt0(sumB(B, x => x.nc))}</b></td><td class="n"><b>${sumB(B, x => x.en)}</b></td><td class="n"><b>${fmtInt0(sumB(B, x => x.ec))}</b></td><td class="n"><b>${fmtInt0(sumB(B, cxs))}</b></td></tr></tfoot></table></div>`;
  }
  function detHTML() {
    const B = buckets(DET.k), tn = sumB(B, x => x.nn), cn = sumB(B, x => x.nc), te = sumB(B, x => x.en), ce = sumB(B, x => x.ec);
    return `<div class="hdbox"><div class="hdh"><b>Vendas programadas</b><button type="button" data-hdx="close" aria-label="Fechar">✕</button></div>
      <div class="hdtabs"><button type="button" data-hdx="dia" class="${DET.k === 'dia' ? 'on' : ''}">Por dia · só dias com venda</button><button type="button" data-hdx="sem" class="${DET.k === 'sem' ? 'on' : ''}">Por semana · próximas 8</button></div>
      <div class="hdk"><div><span>Vendas nacionais</span><b>${tn}</b></div><div><span>Caixas nacionais</span><b style="color:#3fd6c8">${fmtInt0(cn)}</b></div><div><span>Exportações</span><b>${te}</b></div><div><span>Caixas exportação</span><b style="color:#e8c15a">${fmtInt0(ce)}</b></div></div>
      <div class="hdc">${chartSVG(B, DET.k === 'dia' ? { bw: 14, every: 3, fs: 9, noCx: true, noPill: true, line: true } : {})}${legend(B)}</div>
      <p class="note" style="margin:6px 0 10px"><b>Como ler:</b> cada barra é o total de caixas (verde-água = nacionais, amarelo = exportações). A curva branca é a quantidade de vendas (um cliente em cada pedido nacional + cada exportação). Passe o mouse (ou toque) numa barra para ver os números daquele ${DET.k === 'dia' ? 'dia' : 'período'}.</p>
      ${detTable(B)}${semDataNote()}</div>`;
  }
  function detRender() { let el = $('hDet'); if (!el) { el = document.createElement('div'); el.id = 'hDet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Vendas programadas'); document.body.appendChild(el); } el.hidden = !DET.open; if (DET.open) el.innerHTML = detHTML(); }
  document.addEventListener('click', e => {
    const x = e.target.closest('[data-hdx]'); if (x) { const k = x.dataset.hdx; if (k === 'close') DET.open = false; else DET.k = k; detRender(); return; }
    if (DET.open && e.target.id === 'hDet') { DET.open = false; detRender(); return; }
    const o = e.target.closest('[data-hdet]'); if (o && $('vHoje').contains(o)) { e.preventDefault(); DET.open = true; detRender(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && DET.open) { DET.open = false; detRender(); } });

  /* ---------- tela ---------- */
  function title() { $('vtitle').textContent = saud() + (nome() ? ', ' + nome() : ''); }
  const ini2 = s => String(s || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  const chipSt = st => st === 'chegou' ? '<span class="chip ok">chegou</span>' : st === 'embarcado' ? '<span class="chip ok">embarcado</span>' : st === 'problema' ? '<span class="chip bad">problema</span>' : '<span class="chip warn">programado</span>';
  const hd = {}; // modo foco: o que você abriu no Hoje (sem escolha: recolhido; em teste automático, aberto)
  const hdOpen = k => (hd[k] !== undefined ? hd[k] : (() => { try { const v = PP.store.get('hjAll', null); return v === null ? !!navigator.webdriver : !!v; } catch (_) { return false; } })());
  document.addEventListener('toggle', e => { const k = e.target && e.target.dataset && e.target.dataset.hd; if (k) hd[k] = e.target.open; }, true);
  const asRow = a => `<div class="hrow hw"><div class="hav ${a.kind || ''}">${a.icon || '!'}</div><div class="tx"><b>${esc(a.title)}</b><small>${esc(a.sub || '')}</small></div><div class="acts">${a.actions.map(x => `<button type="button" class="${x.primary ? 'primary' : ''}" data-as="${esc(a.key)}|${x.id}">${esc(x.label)}</button>`).join('')}</div></div>`;
  function resumoDia(st) { // frase-resumo do dia, com os números reais
    const p = [], n = st.linHoje.length;
    if (n) p.push(`<b>${n} programaç${n > 1 ? 'ões' : 'ão'} hoje</b>, ${st.cxHoje} caixa${st.cxHoje === 1 ? '' : 's'}`); else p.push('Nenhuma programação hoje');
    let t = p[0] + '.';
    if (st.aguardando > 0) t += ` Você tem <b>R$ ${fmt(st.aguardando)}</b> a receber` + (st.atrasados ? ` e <b>${st.atrasados} pedido${st.atrasados > 1 ? 's' : ''} atrasado${st.atrasados > 1 ? 's' : ''}</b>.` : ', nada atrasado.');
    else t += ' Nada a receber no momento.';
    return t;
  }
  function render() {
    title(); const st = stats(), as = PP.assist ? PP.assist.items() : [];
    $('catinfo').textContent = dataExt() + (as.length ? ` · ${as.length} pendência${as.length > 1 ? 's' : ''}` : ' · tudo em dia');
    const embDia = st.hojeE.length ? st.hojeE : (st.prox ? [st.prox] : []), embTit = st.hojeE.length ? 'Programações de hoje' : 'Próxima programação';
    const linhas = embDia.flatMap(e => (e.linhas || []).map(l => ({ e, l, r: (fretes().rec[e.id + '|' + l.id]) || {} })));
    const next = st.fut ? `${p3(st.fut.n)}/${st.fut.ano}` : '—';
    $('vHoje').innerHTML = `
      <div class="hero"><p class="hsum" id="hSum">${resumoDia(st)}</p><div class="hq"><button type="button" class="primary" data-hgo="novo">+ Novo pedido nacional</button><button type="button" data-hgo="exp">+ Exportação</button><button type="button" data-hgo="frete">Anexar CTEs</button><button type="button" data-hgo="embarque">Programação de voos</button></div></div>
      <div class="hk">
        <div class="card">${st.hojeE.length || !st.prox ? `<div class="lb">Programações hoje</div><div class="big">${st.linHoje.length}</div><div class="nt">${st.linHoje.length ? `${st.cxHoje} caixas · ${st.embarcados} já embarcaram` : 'Nenhuma programação'}</div>` : `<div class="lb">Próxima programação</div><div class="big">${dBR(st.prox.saida).slice(0, 5)}</div><div class="nt">${st.prox.linhas.length} cliente(s) · ${st.prox.linhas.reduce((a, l) => a + (l.caixas || 0), 0)} caixa(s) · hoje não há programação</div>`}</div>
        <div class="card"><div class="lb">Fretes em aberto</div><div class="big ${st.abertoTot > 0 ? 'neg' : ''}">R$ ${fmt(st.abertoTot)}</div><div class="nt">${st.aberto.length ? `${st.aberto.length} cliente(s) devendo` : 'Nenhum frete em aberto'}</div></div>
        <div class="card"><div class="lb">Aguardando pagamento</div><div class="big">R$ ${fmt(st.aguardando)}</div><div class="nt">${st.atrasados ? `<span class="neg">${st.atrasados} pedido(s) atrasado(s)</span>` : 'Nenhum atrasado'} · <a href="#" data-hgo="financeiro" style="color:var(--accent);text-decoration:none;white-space:nowrap">ver quem deve →</a></div></div>
        <div class="card"><div class="lb">${st.fut && !st.dep(st.fut) ? 'Exportação sem data' : st.fut && st.dep(st.fut) >= st.hoje ? 'Próxima exportação' : 'Última exportação'}</div><div class="big">${next}</div><div class="nt">${st.fut ? `${esc((PP.exp.destLabel(st.fut.dest)) || '')} · ${st.dep(st.fut) ? 'saída ' + dBR(st.dep(st.fut)) : 'sem data marcada'}` : 'Nenhuma exportação salva'}</div></div>
      </div>
      <div class="hg">
        <div class="hcol">
        <details class="card hchart foco" data-hd="chart" ${hdOpen('chart') ? 'open' : ''}><summary><span class="lb" style="margin:0">Vendas programadas <span style="text-transform:none;letter-spacing:0">· gráfico por dia</span></span><span class="alt">Ver gráfico</span></summary><div class="lb"><span>Caixas e quantidade de vendas, só nos dias com venda</span><a href="#" data-hdet="1" style="color:var(--accent);text-decoration:none">Ver detalhes →</a></div>${chart()}</details>
      ${PP.hojeplus ? PP.hojeplus.receber() : ''}
      <div class="card"><div class="lb"><span>${embTit}${embDia[0] ? ' · ' + dBR(embDia[0].saida) : ''}</span><a href="#" data-hgo="embarque" style="color:var(--accent);text-decoration:none">Ver programação →</a></div>
        ${linhas.length ? linhas.map(({ e, l, r }) => `<div class="hrow"><div class="hav">${esc(ini2(l.cliente))}</div><div class="tx"><b>${esc(l.cliente || '—')}</b><small>${esc([l.aero, l.cidade].filter(Boolean).join(' · '))}${l.caixas ? ' · ' + l.caixas + ' caixa(s)' : ''}</small></div>${chipSt(l.status)}<span class="nt" style="min-width:130px;text-align:right;color:var(--muted)">${r.hora ? 'chega ' + esc(r.hora) : (l.awb ? 'AWB ' + esc(l.awb) : '—')}</span></div>`).join('') : '<p class="empty">Nenhuma programação. Crie uma na Programação de voos.</p>'}
      </div>
        ${PP.hojeplus ? PP.hojeplus.pilha() : ''}
        </div>
        <div class="card"><div class="lb"><span>Precisa de atenção</span><span>${as.length || ''}</span></div>${as.length ? as.slice(0, 3).map(asRow).join('') + (as.length > 3 ? `<details class="hmais" data-hd="mais" ${hdOpen('mais') ? 'open' : ''}><summary>Mais ${as.length - 3} pendência(s)</summary>${as.slice(3).map(asRow).join('')}</details>` : '') : '<p class="empty">Tudo em dia. Nada pendente agora.</p>'}</div>
      </div>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-hgo]'); if (!b || !$('vHoje').contains(b)) return; e.preventDefault();
    const k = b.dataset.hgo; if (k === 'novo') { PP.go('pedido'); PP.newOrder && PP.newOrder(); } else PP.go(k);
  });
  PP.hoje = { render, title, stats, resumoDia };

  /* ---------- busca global ---------- */
  let res = [], sel = 0;
  function index() {
    const o = [], clis = S.clientes || [];
    clis.forEach((c, i) => o.push({ g: 'Clientes', ic: PP.icon('hoje'), t: c.nome, s: [c.aero, c.cidade].filter(Boolean).join(' · ') || 'Cliente cadastrado', q: norm(c.nome), go: () => { if (PP.clientes) PP.clientes.open(i); else { PP.go('pedido'); const s = $('cliente'); s.value = String(i); s.dispatchEvent(new Event('change', { bubbles: true })); } } }));
    (S.hist || []).filter(F.active).forEach(e => o.push({ g: 'Pedidos nacionais', ic: PP.icon('pedido'), t: e.cliente.nome, s: `Invoice ${e.inv || '—'}${e.nf ? ' · NF ' + e.nf : ''} · ${dBR(e.dataISO)}`, q: norm([e.cliente.nome, e.inv, e.nf, 'nf ' + e.nf].join(' ')), go: () => { const X = PP.extra.ST; X.hist.q = ''; X.hist.st = ''; X.hist.open = e.id; PP.go('hist'); const el = $('hdet'); if (el) el.scrollIntoView({ block: 'start' }); } }));
    (S.embarques || []).forEach(e => (e.linhas || []).forEach(l => { if (!l.cliente) return; o.push({ g: 'Programações', ic: PP.icon('embarque'), t: l.cliente, s: `Programação ${dBR(e.saida)}${l.awb ? ' · AWB ' + l.awb : ''}${l.caixas ? ' · ' + l.caixas + ' cx' : ''}`, q: norm([l.cliente, l.awb].join(' ')), go: () => { PP.extra.ST.emb.sel = e.id; PP.go('embarque'); } }); }));
    const D = fretes();
    (S.embarques || []).forEach(e => (e.linhas || []).forEach(l => { const r = D.rec[e.id + '|' + l.id]; if (r && (r.cte || r.awb)) o.push({ g: 'Fretes', ic: PP.icon('frete'), t: l.cliente + ' · CT-e ' + (r.cte || '—'), s: `${r.awb ? 'AWB ' + r.awb + ' · ' : ''}${r.nf ? 'NF ' + r.nf + ' · ' : ''}${r.pago ? 'pago' : 'em aberto'}`, q: norm([l.cliente, r.cte, r.awb, r.nf].join(' ')), go: () => { PP.go('frete'); const s = $('frEmb'); if (s) { s.value = e.id; s.dispatchEvent(new Event('change', { bubbles: true })); } } }); }));
    (PP.exp ? PP.exp.hist() : []).forEach(e => o.push({ g: 'Exportações', ic: PP.icon('exp'), t: `${p3(e.n)}/${e.ano} · ${(e.cons && e.cons.name) || ''}`, s: `${PP.exp.destLabel(e.dest) || ''} · ${dBR(e.dateISO)}`, q: norm([p3(e.n) + '/' + e.ano, e.n, e.cons && e.cons.name, PP.exp.destLabel(e.dest)].join(' ')), go: () => PP.exp.openEntry(e.id) }));
    if (PP.kanban) PP.kanban.searchItems(norm).forEach(x => o.push(x));
    if (PP.mapa) PP.mapa.searchItems(norm).forEach(x => o.push(x));
    commands().forEach(x => o.push(x));
    return o;
  }
  /* comandos do Ctrl K: ir para telas e ações rápidas (aparecem com a caixa vazia e também quando você digita) */
  const VIEWS = [['hoje', 'Hoje'], ['pedido', 'Pedido nacional'], ['exp', 'Exportação'], ['mapa', 'Notas de entrada'], ['embarque', 'Programação de voos'], ['frete', 'Frete'], ['hist', 'Histórico'], ['financeiro', 'Financeiro'], ['clientes', 'Clientes'], ['painel', 'Painel'], ['relat', 'Romaneio e relatórios'], ['estoque', 'Estoque e reposição'], ['tarefas', 'Tarefas']];
  function commands() {
    const ic = k => { try { return PP.icon(k); } catch (_) { return ''; } }, o = [];
    const add = (t, s, extra, go) => o.push({ g: 'Comandos', ic: ic('hoje'), t, s, q: norm(t + ' ' + s + ' ' + extra), go });
    VIEWS.forEach(([k, t]) => { const c = { g: 'Comandos', ic: ic(k) || ic('hoje'), t: 'Ir para ' + t, s: 'Abrir a tela', q: norm('ir para abrir tela ' + t), go: () => PP.go(k) }; o.push(c); });
    add('Novo pedido nacional', 'Abre um pedido em branco', 'criar novo', () => { PP.go('pedido'); PP.newOrder && PP.newOrder(); });
    add('Nova exportação', 'Abre a tela de exportação', 'criar novo', () => PP.go('exp'));
    add('Ocultar ou mostrar valores', 'Esconde os valores em R$ da tela', 'olho privacidade esconder cliente', () => PP.vals && PP.vals.toggle());
    add('Fazer backup agora', 'Salva o arquivo de backup', 'salvar copia', () => PP.autobk && PP.autobk.backupAgora && PP.autobk.backupAgora());
    add('Abrir configurações', 'Dados, nuvem, menu e assistente', 'config ajustes', () => { const b = $('btnCfg'); if (b) b.click(); });
    add('Manual e tour', 'Ajuda e tour guiado', 'ajuda como usar', () => PP.guia && PP.guia.openManual && PP.guia.openManual());
    return o;
  }
  function find(qs) {
    const toks = norm(qs).split(/\s+/).filter(Boolean); if (!toks.length) return commands();
    const cm = x => x.g === 'Comandos' && toks.every(t => norm(x.t).includes(t)) ? 2 : 0; // comando cujo título bate com o que foi digitado vem primeiro
    return index().filter(x => toks.every(t => x.q.includes(t))).sort((a, b) => (cm(b) + (b.q.startsWith(toks[0]) ? 1 : 0)) - (cm(a) + (a.q.startsWith(toks[0]) ? 1 : 0))).slice(0, 40);
  }
  function drawRes() {
    const box = $('srchRes'); if (!res.length) { box.innerHTML = `<div class="nores">${$('srchIn').value.trim() ? 'Nada encontrado.' : 'Digite um nome, NF, invoice, AWB ou CT-e.'}</div>`; return; }
    let g = '', h = ''; res.forEach((x, i) => { if (x.g !== g) { g = x.g; h += `<div class="sg">${g}</div>`; } h += `<button type="button" data-si="${i}" class="${i === sel ? 'on' : ''}"><span class="si">${x.ic}</span><span><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span></button>`; });
    box.innerHTML = h;
  }
  function openSearch() { $('srch').hidden = false; $('srchIn').value = ''; res = commands(); sel = 0; drawRes(); setTimeout(() => $('srchIn').focus(), 20); }
  function closeSearch() { $('srch').hidden = true; }
  function pick(i) { const x = res[i]; if (!x) return; closeSearch(); x.go(); }
  $('btnSearch').onclick = openSearch;
  $('srchIn').addEventListener('input', e => { res = find(e.target.value); sel = 0; drawRes(); });
  $('srchRes').addEventListener('click', e => { const b = e.target.closest('[data-si]'); if (b) pick(+b.dataset.si); });
  $('srch').addEventListener('mousedown', e => { if (e.target === $('srch')) closeSearch(); });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('srch').hidden ? openSearch() : closeSearch(); return; }
    if ($('srch').hidden) return;
    if (e.key === 'Escape') { closeSearch(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!res.length) return; sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + res.length) % res.length; drawRes(); const on = $('srchRes').querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
  });
  PP.search = { open: openSearch, find, commands };
})();
