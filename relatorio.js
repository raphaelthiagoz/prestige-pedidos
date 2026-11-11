/* Prestige Pedidos — Relatório de vendas em PDF (semana / mês) + Excel + compartilhar.
   Fica na aba Painel. Junta pedidos nacionais (R$) e exportações (US$ com conversão em R$).
   O PDF é montado a partir das mesmas páginas mostradas na prévia (html2canvas + jsPDF, carregados só quando precisa). */
(function () {
  'use strict';
  const PP = window.PP, F = PP.Features, S = PP.S, store = PP.store, esc = PP.esc, fmt = PP.fmt, fmtInt = PP.fmtInt;
  const r2 = F.r2, addDays = F.addDays, today = F.todayISO;
  const UP = s => String(s || '').trim().toUpperCase();
  const dBR = iso => (iso ? iso.split('-').reverse().join('/') : '');
  const dBR2 = iso => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '');
  const dow = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
  const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'], DOWL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const diff = (a, b) => F.daysBetween(a, b);
  const monday = iso => addDays(iso, -((dow(iso) + 6) % 7));
  const firstOfMonth = iso => iso.slice(0, 8) + '01';
  const lastOfMonth = iso => { const [y, m] = iso.split('-').map(Number); return today(new Date(y, m, 0)); };
  const prevMonthStart = iso => { const [y, m] = iso.split('-').map(Number); return today(new Date(y, m - 2, 1)); };
  const nextMonthStart = iso => { const [y, m] = iso.split('-').map(Number); return today(new Date(y, m, 1)); };
  const money = n => { const s = fmt(Math.abs(n)), i = s.lastIndexOf(','); return { int: (n < 0 ? '-' : '') + s.slice(0, i), dec: s.slice(i) }; };
  const nm = s => String(s || '').toLowerCase().replace(/(^|[\s(\-/])([a-zà-ú])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E|Em|Com)\b/g, x => x.toLowerCase()).replace(/^./, c => c.toUpperCase());
  const sci = s => { const t = String(s || '').toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
  const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);
  const msgEl = (root, t) => { const el = root && root.querySelector('[data-rpmsg]'); if (el) el.textContent = t || ''; };

  /* ====================== ESTADO ====================== */
  const saved = store.get('relcfg', {}) || {};
  const ST = { p: saved.p || 'semana', a: '', b: '', rate: +saved.rate || 0, rateDate: saved.rateDate || '', rateMsg: '', open: false, busy: false, cache: null,
    title: saved.title || '', by: typeof saved.by === 'string' ? saved.by : null, pg: Object.assign({ capa: 1, resumo: 1, evolucao: 1, especies: 1, clientes: 1, perdas: 1 }, saved.pg || {}), txt: null, obs: '', cust: false };
  const persist = () => store.set('relcfg', { p: ST.p, rate: ST.rate, rateDate: ST.rateDate, title: ST.title, by: ST.by, pg: ST.pg });
  const titulo = () => (ST.title || '').trim() || 'Relatório de vendas';
  const PGS = [['capa', 'Capa'], ['resumo', 'Resumo, destaques e observações'], ['evolucao', 'Evolução e top 10 espécies'], ['especies', 'Vendas por espécie'], ['clientes', 'Clientes e destinos'], ['perdas', 'Perdas e mortalidade']];

  function rangeOf(p) {
    const t = today(), mon = monday(t);
    if (p === 'semana') return { a: mon, b: addDays(mon, 6) < t ? addDays(mon, 6) : t };
    if (p === 'semana_ant') return { a: addDays(mon, -7), b: addDays(mon, -1) };
    if (p === 'mes') return { a: firstOfMonth(t), b: t };
    if (p === 'mes_ant') { const pm = prevMonthStart(t); return { a: pm, b: lastOfMonth(pm) }; }
    return { a: ST.a || addDays(t, -6), b: ST.b || t };
  }
  const PNAME = { semana: 'Esta semana', semana_ant: 'Semana passada', mes: 'Este mês', mes_ant: 'Mês passado', livre: 'Datas livres' };
  const TAG = { semana: 'SEMANAL', semana_ant: 'SEMANAL', mes: 'MENSAL', mes_ant: 'MENSAL', livre: 'PERÍODO' };

  function prevOf(a, b, p) {
    const days = diff(a, b) + 1;
    if (p === 'semana' || p === 'semana_ant') return { a: addDays(a, -7), b: addDays(a, -7 + days - 1), lbl: days < 7 ? 'mesmo período da semana anterior' : 'semana anterior' };
    if (p === 'mes' || p === 'mes_ant') { const pm = prevMonthStart(a), pe = addDays(pm, days - 1), le = lastOfMonth(pm); return { a: pm, b: pe > le ? le : pe, lbl: p === 'mes' ? 'mesmo período do mês anterior' : 'mês anterior' }; }
    return { a: addDays(a, -days), b: addDays(a, -1), lbl: 'período anterior' };
  }

  /* ====================== CÁLCULO ====================== */
  const nacList = () => (S.hist || []).filter(e => F.active(e));
  const expList = () => (PP.exp && PP.exp.hist ? PP.exp.hist() : []) || [];
  const destLbl = k => (PP.exp && PP.exp.destLabel ? PP.exp.destLabel(k) : '') || k || 'Outros';
  function expTot(e) {
    const t = e.tot || {};
    const boxes = t.boxes != null ? +t.boxes : (e.items || []).reduce((s, x) => s + (+x.boxes || 0), 0);
    const fish = t.fish != null ? +t.fish : (e.items || []).reduce((s, x) => s + (+x.boxes || 0) * (+x.qpb || 0), 0);
    const goods = t.goods != null ? +t.goods : (e.items || []).reduce((s, x) => s + (+x.boxes || 0) * (+x.qpb || 0) * (+x.price || 0), 0);
    const total = t.total != null ? +t.total : goods;
    return { boxes, fish, goods, total };
  }
  const rateOf = (e, rep) => { const r = e.conv && e.conv.on !== false && +e.conv.rate > 0 ? +e.conv.rate : 0; return r || rep || 0; };

  function summary(a, b, rate) {
    const N = nacList().filter(e => e.dataISO >= a && e.dataISO <= b), X = expList().filter(e => e.dateISO >= a && e.dateISO <= b);
    const nac = { pedidos: N.length, caixas: N.reduce((s, e) => s + (+e.totais.caixas || 0), 0), peixes: N.reduce((s, e) => s + (+e.totais.peixes || 0), 0), valor: r2(N.reduce((s, e) => s + F.devido(e), 0)) };
    let usd = 0, brl = 0, sem = 0, cx = 0, un = 0;
    X.forEach(e => { const t = expTot(e), r = rateOf(e, rate); cx += t.boxes; un += t.fish; usd += t.total; if (r) brl += t.total * r; else if (t.total > 0) sem++; });
    const exp = { pedidos: X.length, caixas: cx, peixes: un, usd: r2(usd), brl: r2(brl), sem, taxaMedia: usd > 0 && brl > 0 ? brl / usd : 0 };
    return { N, X, nac, exp, caixas: nac.caixas + exp.caixas, peixes: nac.peixes + exp.peixes, pedidos: nac.pedidos + exp.pedidos, valorBRL: r2(nac.valor + exp.brl) };
  }

  const pctChg = (cur, prev) => (prev > 0 ? Math.round((cur - prev) / prev * 100) : null);

  // buckets para gráfico de dias (diário até 31 dias; senão semanas)
  function dayBuckets(a, b, N, X, rate) {
    const days = diff(a, b) + 1, weekly = days > 31, out = [], idx = {};
    if (!weekly) for (let i = 0; i < days; i++) { const d = addDays(a, i); idx[d] = out.length; out.push({ k: d, lbl: DOW[dow(d)] + ' ' + d.slice(8), n: 0, x: 0, valor: 0, pn: 0, px: 0 }); }
    else { let d = monday(a); while (d <= b) { const o = { k: d, lbl: dBR2(d), n: 0, x: 0, valor: 0, pn: 0, px: 0 }; for (let i = 0; i < 7; i++) idx[addDays(d, i)] = out.length; out.push(o); d = addDays(d, 7); } }
    N.forEach(e => { const o = out[idx[e.dataISO]]; if (o) { o.n += +e.totais.caixas || 0; o.pn++; o.valor += F.devido(e); } });
    X.forEach(e => { const o = out[idx[e.dateISO]]; if (o) { const t = expTot(e), r = rateOf(e, rate); o.x += t.boxes; o.px++; o.valor += t.total * r; } });
    return { weekly, list: out };
  }
  // evolução: 8 semanas (período curto) ou 6 meses
  function evolution(a, b, rate) {
    const short = diff(a, b) + 1 <= 8, out = [];
    const N = nacList(), X = expList();
    if (short) { let m = monday(b); for (let i = 7; i >= 0; i--) { const s = addDays(m, -7 * i), e = addDays(s, 6); out.push({ s, e, lbl: dBR2(s) }); } }
    else { let m = firstOfMonth(b); const ms = []; for (let i = 0; i < 6; i++) { ms.unshift(m); m = prevMonthStart(m); } ms.forEach(s => { out.push({ s, e: lastOfMonth(s), lbl: MES[+s.slice(5, 7) - 1] + '/' + s.slice(2, 4) }); }); }
    out.forEach(o => {
      const sm = summary(o.s, o.e, rate); o.n = sm.nac.caixas; o.x = sm.exp.caixas; o.valor = sm.valorBRL; o.peixes = sm.peixes; o.pedidos = sm.pedidos; o.cur = (b >= o.s && b <= o.e);
    });
    return { short, list: out };
  }

  function detail(a, b, p, rate) {
    const cur = summary(a, b, rate), pv = prevOf(a, b, p), prev = summary(pv.a, pv.b, rate);
    const sp = {}, get = (k, nome, sc) => sp[k] || (sp[k] = { k, nome: nome || sc || k, sci: sc || '', nCx: 0, nUn: 0, nVal: 0, xCx: 0, xUn: 0, xUsd: 0 });
    cur.N.forEach(e => (e.lines || []).forEach(l => { const o = get(UP(l.sci || l.comum || l.nome), l.comum || l.nome, l.sci); o.nCx += +l.boxes || 0; o.nUn += +l.peixes || 0; o.nVal += (+l.peixes || 0) * (+l.preco || 0); }));
    cur.X.forEach(e => (e.items || []).forEach(x => { const bx = +x.boxes || 0, un = bx * (+x.qpb || 0); if (!bx && !un) return; const o = get(UP(x.sci || x.pt), x.pt, x.sci); if (o.nome === o.sci || !o.nome) o.nome = x.pt || o.nome; o.xCx += bx; o.xUn += un; o.xUsd += un * (+x.price || 0); }));
    const species = Object.values(sp).map(o => Object.assign(o, { un: o.nUn + o.xUn, cx: o.nCx + o.xCx })).sort((x, y) => y.un - x.un);
    const dias = dayBuckets(a, b, cur.N, cur.X, rate), evo = evolution(a, b, rate);
    // clientes
    const cn = {}, cx = {};
    cur.N.forEach(e => { const k = UP(e.cliente && e.cliente.nome) || '—'; const o = cn[k] || (cn[k] = { nome: (e.cliente && e.cliente.nome) || '—', pedidos: 0, valor: 0, caixas: 0 }); o.pedidos++; o.valor += F.devido(e); o.caixas += +e.totais.caixas || 0; });
    cur.X.forEach(e => { const k = UP(e.cons && e.cons.name) || '—', t = expTot(e), r = rateOf(e, rate); const o = cx[k] || (cx[k] = { nome: (e.cons && e.cons.name) || '—', pedidos: 0, usd: 0, brl: 0, caixas: 0, dest: destLbl(e.dest) }); o.pedidos++; o.usd += t.total; o.brl += t.total * r; o.caixas += t.boxes; });
    const cliN = Object.values(cn).sort((x, y) => y.valor - x.valor), cliX = Object.values(cx).sort((x, y) => y.usd - x.usd);
    // destinos
    const ds = {}; cur.X.forEach(e => { const k = e.dest || '?', t = expTot(e), r = rateOf(e, rate); const o = ds[k] || (ds[k] = { k, nome: destLbl(k), pedidos: 0, caixas: 0, peixes: 0, usd: 0, brl: 0 }); o.pedidos++; o.caixas += t.boxes; o.peixes += t.fish; o.usd += t.total; o.brl += t.total * r; });
    const destinos = Object.values(ds).sort((x, y) => y.usd - x.usd);
    // perdas (mortalidade registrada nos pedidos nacionais do período)
    const ms = {}; let mortos = 0, credito = 0, pedMort = 0;
    cur.N.forEach(e => { if (!e.mort || !e.mort.dead) return; let any = false; (e.lines || []).forEach((l, i) => { const n = Math.min(Math.max(0, parseInt(e.mort.dead[i], 10) || 0), +l.peixes || 0); if (!n) return; any = true; const k = UP(l.sci || l.comum || l.nome), o = ms[k] || (ms[k] = { k, nome: l.comum || l.nome, sci: l.sci, mortos: 0, credito: 0 }); o.mortos += n; o.credito += n * (+l.preco || 0); mortos += n; credito += n * (+l.preco || 0); }); if (any) pedMort++; });
    const perdas = Object.values(ms).map(o => { const s = sp[o.k]; return Object.assign(o, { vendidos: s ? s.nUn : 0, pct: s && s.nUn ? o.mortos / s.nUn * 100 : 0 }); }).sort((x, y) => y.mortos - x.mortos);
    // destaques
    const top = species[0] || null;
    let best = null; dias.list.forEach(d => { const t = d.n + d.x; if (t > 0 && (!best || t > best.t)) best = { t, d }; });
    let big = null;
    cur.N.forEach(e => { const v = F.devido(e); if (!big || v > big.brl) big = { brl: v, nome: e.cliente.nome, tipo: 'nac', ref: e.inv ? 'invoice ' + e.inv : '' }; });
    cur.X.forEach(e => { const t = expTot(e), r = rateOf(e, rate); if (!r) return; const v = t.total * r; if (!big || v > big.brl) big = { brl: v, usd: t.total, nome: (e.cons && e.cons.name) || '', tipo: 'exp', ref: 'embarque ' + String(e.n).padStart(3, '0') + '/' + (e.ano || '') }; });
    const R = { a, b, p, rate, cur, prev, pv, species, dias, evo, cliN, cliX, destinos, perdas, mortos, credito, pedMort, top, best, big };
    R.change = { caixas: pctChg(cur.caixas, prev.caixas), nac: pctChg(cur.nac.valor, prev.nac.valor), exp: pctChg(cur.exp.usd, prev.exp.usd), peixes: pctChg(cur.peixes, prev.peixes) };
    R.vazio = cur.pedidos === 0;
    R.texto = textoResumo(R);
    return R;
  }

  const arrow = c => (c == null ? '' : c === 0 ? '<span class="rpeq">= igual</span>' : c > 0 ? `<span class="rpup">▲ ${c}%</span>` : `<span class="rpdn">▼ ${Math.abs(c)}%</span>`);
  const arrowTxt = c => (c == null ? '' : c === 0 ? 'ficou igual' : c > 0 ? `subiram ${c}%` : `caíram ${Math.abs(c)}%`);

  function textoResumo(R, html) {
    const c = R.cur, B = x => (html ? `<b>${x}</b>` : x), per = R.a === R.b ? 'Em ' + dBR(R.a) : `Entre ${dBR(R.a)} e ${dBR(R.b)}`;
    if (!c.pedidos) return `${per}, não há vendas registradas.`;
    const parts = [];
    if (c.nac.pedidos) parts.push(`${plural(c.nac.pedidos, 'pedido nacional', 'pedidos nacionais')} (R$ ${fmt(c.nac.valor)})`);
    if (c.exp.pedidos) parts.push(`${plural(c.exp.pedidos, 'exportação', 'exportações')} (US$ ${fmt(c.exp.usd)}${c.exp.brl ? ', cerca de R$ ' + fmt(c.exp.brl) : ''})`);
    let t = `${per}, a Prestige Aquarium vendeu ${B(plural(c.caixas, 'caixa', 'caixas'))} com ${B(fmtInt(c.peixes) + ' peixes')} em ${plural(c.pedidos, 'pedido', 'pedidos')}: ${parts.join(' e ')}.`;
    const pv = R.prev;
    if (pv.caixas > 0 && R.change.caixas != null) t += ` Em relação ${/^semana/.test(R.pv.lbl) ? 'à' : 'ao'} ${R.pv.lbl}, as caixas vendidas ${arrowTxt(R.change.caixas)}.`;
    if (R.top) t += ` A espécie mais vendida foi ${B(nm(R.top.nome))}, com ${fmtInt(R.top.un)} peixes.`;
    if (R.best) t += R.dias.weekly ? ` A melhor semana foi a de ${dBR2(R.best.d.k)}, com ${plural(R.best.t, 'caixa', 'caixas')}.` : ` O melhor dia foi ${DOWL[dow(R.best.d.k)]} (${dBR2(R.best.d.k)}), com ${plural(R.best.t, 'caixa', 'caixas')}.`;
    if (R.mortos > 0) t += ` Foram registrados ${fmtInt(R.mortos)} peixes mortos nos pedidos nacionais, com R$ ${fmt(R.credito)} em créditos.`;
    return t;
  }

  /* ====================== PÁGINAS (HTML) ====================== */
  const LOGO = () => (window.LOGO_PNG_B64 ? `<img class="rplogo" alt="" src="data:image/png;base64,${window.LOGO_PNG_B64}">` : '');
  const empresa = () => (S.cfg && S.cfg.empresa && S.cfg.empresa.nome) || 'Prestige Aquarium LTDA.';
  const cidade = () => (S.cfg && S.cfg.empresa && S.cfg.empresa.cidade) || 'Manaus – Amazonas';
  const preparado = () => (ST.by == null ? (store.get('uNome', 'Raphael') || '') : ST.by).trim();
  const head = (R, t, sub) => `<div class="rptop"><div><h1>${esc(t)}</h1><div class="rpsub">${esc(sub || '')}</div></div><div class="rpbadge">${TAG[R.p]}</div></div>`;
  const foot = R => `<div class="rpfoot"><span>Gerado em ${dBR(today())} às ${new Date().toTimeString().slice(0, 5)} · ${esc(empresa())}</span><span data-rppg></span></div>`;
  const per = R => `${dBR(R.a)} a ${dBR(R.b)}`;
  const kpiNac = R => { const c = R.cur.nac, m = money(c.valor); return `<div class="rpcard rpnac"><h3>Pedidos nacionais</h3><div class="rpbig">R$ ${m.int}<small>${m.dec}</small></div><div class="rpmini"><b>${c.pedidos}</b> pedidos · <b>${fmtInt(c.caixas)}</b> caixas<br><b>${fmtInt(c.peixes)}</b> peixes · ${arrow(R.change.nac) || '—'} ${R.change.nac == null ? '' : 'vs ' + esc(R.pv.lbl)}</div></div>`; };
  const kpiExp = R => { const c = R.cur.exp, m = money(c.usd); return `<div class="rpcard rpexp"><h3>Exportações</h3><div class="rpbig">US$ ${m.int}<small>${m.dec}</small></div><div class="rpmini"><b>${c.pedidos}</b> embarques · <b>${fmtInt(c.caixas)}</b> caixas<br>${c.brl ? `≈ <b>R$ ${fmt(c.brl)}</b> <span class="rpgrey">(cotação média ${fmt(c.taxaMedia)})</span><br>` : '<span class="rpwarn">sem cotação do dólar</span><br>'}${fmtInt(c.peixes)} peixes · ${arrow(R.change.exp) || '—'}</div></div>`; };
  const kpiTot = R => { const c = R.cur; return `<div class="rpcard rptot"><h3>Total do período</h3><div class="rpbig">${fmtInt(c.caixas)} <small>caixas</small></div><div class="rpmini"><b>${fmtInt(c.peixes)}</b> peixes vendidos<br><b>${c.pedidos}</b> ${c.pedidos === 1 ? 'pedido' : 'pedidos'} no total<br>${arrow(R.change.caixas) || '—'} em caixas ${R.change.caixas == null ? '' : 'vs ' + esc(R.pv.lbl)}</div></div>`; };

  function stacked(list, H, opt) {
    const max = Math.max(1, ...list.map(d => d.n + d.x)), px = v => Math.round(v / max * H);
    const w = list.length > 12 ? 'rpthin' : '';
    return `<div class="rpchart ${w}" style="height:${H + 22}px">${list.map(d => `<div class="rpcol${d.cur ? ' rpcur' : ''}"><em>${d.n + d.x ? d.n + d.x : ''}</em>${d.x ? `<i class="rpx" style="height:${Math.max(2, px(d.x))}px"></i>` : ''}${d.n ? `<i class="rpn" style="height:${Math.max(2, px(d.n))}px"></i>` : ''}</div>`).join('')}</div>
      <div class="rplbl ${w}">${list.map(d => `<span>${esc(d.lbl)}${opt && opt.valor ? `<small>${d.valor >= 1000 ? 'R$ ' + (Math.round(d.valor / 100) / 10).toLocaleString('pt-BR') + ' mil' : (d.valor ? 'R$ ' + fmtInt(Math.round(d.valor)) : '')}</small>` : ''}</span>`).join('')}</div>`;
  }
  const legend = '<div class="rpleg"><span><b class="rpn"></b>Nacional</span><span><b class="rpx"></b>Exportação</span></div>';
  const rank = (list, val, label, fmtV, cls, max) => { const m = Math.max(1e-9, ...list.map(val)); return `<div class="rprk">${list.map(x => `<div><span title="${esc(label(x))}">${esc(label(x))}</span><em><i class="${cls || ''}" style="width:${Math.max(3, Math.round(val(x) / m * 100))}%"></i></em><b>${fmtV(x)}</b></div>`).join('')}</div>`; };

  function pgCapa(R) {
    const by = preparado();
    return `<div class="rpg rpcapa"><div class="rpcapaTop">${LOGO()}</div><div class="rpcapaMid"><div class="rpbadge big">${TAG[R.p]}</div><h1>${esc(titulo())}</h1><div class="rpper">${per(R)}</div><div class="rpline"></div><div class="rpemp">${esc(empresa())}</div><div class="rpcid">${esc(cidade())}</div></div>
      <div class="rpcapaBot">${by ? `<div>Preparado por <b>${esc(by)}</b></div>` : ''}<div>Gerado em ${dBR(today())}</div></div></div>`;
  }
  function pgResumo(R) {
    const c = R.cur;
    const bigTxt = R.big ? (R.big.tipo === 'exp' ? `US$ ${fmt(R.big.usd)}` : `R$ ${fmt(R.big.brl)}`) : '—';
    return `<div class="rpg">${head(R, 'Resumo do período', per(R) + ' · comparado com ' + dBR(R.pv.a) + ' a ' + dBR(R.pv.b))}
      ${ST.txt === null ? `<p class="rptexto">${textoResumo(R, true)}</p>` : (ST.txt.trim() ? `<p class="rptexto">${esc(ST.txt.trim()).replace(/\n/g, '<br>')}</p>` : '')}
      <div class="rprow r3">${kpiNac(R)}${kpiExp(R)}${kpiTot(R)}</div>
      <h2>Caixas vendidas ${R.dias.weekly ? 'por semana' : 'por dia'}</h2>${stacked(R.dias.list.map(d => ({ n: d.n, x: d.x, lbl: d.lbl })), 130)}${legend}
      <h2>Destaques</h2><div class="rprow r3">
        <div class="rpcard"><h3>Espécie nº 1</h3><div class="rpbig sm">${R.top ? esc(nm(R.top.nome)) : '—'}</div><div class="rpmini">${R.top ? `${fmtInt(R.top.un)} peixes · ${fmtInt(R.top.cx)} caixas<br>${c.peixes ? Math.round(R.top.un / c.peixes * 100) : 0}% de tudo que saiu` : ''}</div></div>
        <div class="rpcard"><h3>${R.dias.weekly ? 'Melhor semana' : 'Melhor dia'}</h3><div class="rpbig sm">${R.best ? (R.dias.weekly ? 'Semana de ' + dBR2(R.best.d.k) : DOWL[dow(R.best.d.k)].replace('-feira', '').replace(/^./, x => x.toUpperCase()) + ', ' + dBR2(R.best.d.k)) : '—'}</div><div class="rpmini">${R.best ? `${plural(R.best.t, 'caixa', 'caixas')}<br>${R.best.d.pn} ${R.best.d.pn === 1 ? 'pedido nacional' : 'pedidos nacionais'}${R.best.d.px ? ' e ' + plural(R.best.d.px, 'embarque', 'embarques') : ''}` : (R.dias.weekly ? '' : '')}</div></div>
        <div class="rpcard"><h3>Maior pedido</h3><div class="rpbig sm">${bigTxt}</div><div class="rpmini">${R.big ? esc(R.big.nome) + '<br>' + esc(R.big.ref) + (R.big.tipo === 'exp' ? `<br>≈ R$ ${fmt(R.big.brl)}` : '') : ''}</div></div></div>
      ${ST.obs.trim() ? `<h2>Observações</h2><div class="rpobs">${esc(ST.obs.trim()).replace(/\n/g, '<br>')}</div>` : ''}
      ${foot(R)}</div>`;
  }
  function pgEvolucao(R) {
    const ev = R.evo, top = R.species.slice(0, 10), maxU = Math.max(1, ...top.map(x => x.un));
    return `<div class="rpg">${head(R, 'Evolução e espécies campeãs', per(R))}
      <h2>${ev.short ? 'Caixas vendidas nas últimas 8 semanas' : 'Caixas vendidas nos últimos 6 meses'}</h2>${stacked(ev.list, 150, { valor: true })}${legend}
      <p class="rpnote">${ev.short ? 'Semanas de segunda a domingo' : 'Meses fechados; o último é o do período'}. Valor abaixo de cada coluna = faturamento (exportação convertida em R$).</p>
      <h2>Top 10 espécies (peixes vendidos)</h2>
      ${top.length ? `<div class="rprk big">${top.map((x, i) => `<div><span><i>${i + 1}</i> ${esc(nm(x.nome))}</span><em><i class="rpn" style="width:${x.nUn / maxU * 100}%"></i><i class="rpx" style="width:${x.xUn / maxU * 100}%"></i></em><b>${fmtInt(x.un)}</b></div>`).join('')}</div>${legend}` : '<p class="rpnote">Sem vendas no período.</p>'}
      ${foot(R)}</div>`;
  }
  function pgsEspecies(R) {
    const L = R.species, per1 = 17, perN = 18, chunks = []; let i = 0;
    if (!L.length) return [`<div class="rpg">${head(R, 'Vendas por espécie', per(R))}<p class="rpnote">Sem vendas no período.</p>${foot(R)}</div>`];
    const tot = L.reduce((t, x) => { t.nCx += x.nCx; t.nUn += x.nUn; t.xCx += x.xCx; t.xUn += x.xUn; return t; }, { nCx: 0, nUn: 0, xCx: 0, xUn: 0 });
    while (i < L.length) { const n = chunks.length ? perN : per1; chunks.push(L.slice(i, i + n)); i += n; }
    if (chunks[chunks.length - 1].length > (chunks.length > 1 ? perN : per1) - 3) chunks.push([]);
    return chunks.map((ch, k) => `<div class="rpg">${head(R, k ? 'Vendas por espécie (continuação)' : 'Vendas por espécie', per(R) + ' · ordenado por peixes vendidos')}
      <table class="rptb"><thead><tr><th>Espécie</th><th>Caixas<br>nac.</th><th>Peixes<br>nac.</th><th>Caixas<br>exp.</th><th>Peixes<br>exp.</th><th>Total<br>peixes</th></tr></thead><tbody>
      ${ch.map(x => `<tr><td>${esc(nm(x.nome))}${x.sci ? `<i>${esc(sci(x.sci))}</i>` : ''}</td><td>${x.nCx || '–'}</td><td>${x.nUn ? fmtInt(x.nUn) : '–'}</td><td>${x.xCx || '–'}</td><td>${x.xUn ? fmtInt(x.xUn) : '–'}</td><td><b>${fmtInt(x.un)}</b></td></tr>`).join('')}</tbody>
      ${k === chunks.length - 1 ? `<tfoot><tr><td>TOTAL (${L.length} espécies)</td><td>${fmtInt(tot.nCx)}</td><td>${fmtInt(tot.nUn)}</td><td>${fmtInt(tot.xCx)}</td><td>${fmtInt(tot.xUn)}</td><td>${fmtInt(tot.nUn + tot.xUn)}</td></tr></tfoot>` : ''}</table>
      ${k === chunks.length - 1 ? '<p class="rpnote">Em caixas com mais de uma espécie (caixa mista), a caixa é contada na espécie principal. Pedidos cancelados não entram.</p>' : ''}${foot(R)}</div>`);
  }
  function pgClientes(R) {
    const cn = R.cliN.slice(0, 8), cx = R.cliX.slice(0, 8), ds = R.destinos.slice(0, 8), tx = ds.reduce((s, d) => s + d.usd, 0) || 1;
    return `<div class="rpg">${head(R, 'Clientes e destinos', per(R))}
      <h2>Quem mais comprou</h2><div class="rptwo"><div><div class="rpcap">NACIONAL (R$)</div>${cn.length ? rank(cn, x => x.valor, x => nm(x.nome), x => fmtInt(Math.round(x.valor)), '') : '<p class="rpnote">Sem pedidos nacionais.</p>'}</div>
      <div><div class="rpcap">EXPORTAÇÃO (US$)</div>${cx.length ? rank(cx, x => x.usd, x => nm(x.nome), x => fmtInt(Math.round(x.usd)), 'rpx') : '<p class="rpnote">Sem exportações.</p>'}</div></div>
      <h2>Exportação por país / destino</h2>
      ${ds.length ? `<table class="rptb"><thead><tr><th>Destino</th><th>Embarques</th><th>Caixas</th><th>Peixes</th><th>US$</th><th>≈ R$</th><th>% do US$</th></tr></thead><tbody>
      ${ds.map(d => `<tr><td>${esc(d.nome)}</td><td>${d.pedidos}</td><td>${fmtInt(d.caixas)}</td><td>${fmtInt(d.peixes)}</td><td><b>${fmt(d.usd)}</b></td><td>${d.brl ? fmt(d.brl) : '–'}</td><td>${Math.round(d.usd / tx * 100)}%</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>TOTAL</td><td>${ds.reduce((s, d) => s + d.pedidos, 0)}</td><td>${fmtInt(ds.reduce((s, d) => s + d.caixas, 0))}</td><td>${fmtInt(ds.reduce((s, d) => s + d.peixes, 0))}</td><td>${fmt(ds.reduce((s, d) => s + d.usd, 0))}</td><td>${ds.some(d => d.brl) ? fmt(ds.reduce((s, d) => s + d.brl, 0)) : '–'}</td><td>100%</td></tr></tfoot></table>` : '<p class="rpnote">Nenhuma exportação no período.</p>'}
      <p class="rpnote">Conversão para R$: cotação salva em cada embarque ou, se não houver, a cotação do dia${R.rate ? ' (R$ ' + fmt(R.rate) + ')' : ''}.</p>${foot(R)}</div>`;
  }
  function pgPerdas(R) {
    const L = R.perdas.slice(0, 16), vend = R.cur.nac.peixes;
    return `<div class="rpg">${head(R, 'Perdas e mortalidade', per(R))}
      <div class="rprow r3"><div class="rpcard"><h3>Peixes mortos</h3><div class="rpbig">${fmtInt(R.mortos)}</div><div class="rpmini">${R.pedMort} ${R.pedMort === 1 ? 'pedido' : 'pedidos'} com perda registrada</div></div>
      <div class="rpcard"><h3>Perda sobre o vendido</h3><div class="rpbig">${vend ? (R.mortos / vend * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '0'}%</div><div class="rpmini">de ${fmtInt(vend)} peixes nacionais</div></div>
      <div class="rpcard"><h3>Crédito dado aos clientes</h3><div class="rpbig">R$ ${fmt(R.credito)}</div><div class="rpmini">abatido ou guardado</div></div></div>
      <h2>Mortalidade por espécie</h2>
      ${L.length ? `<table class="rptb"><thead><tr><th>Espécie</th><th>Vendidos</th><th>Mortos</th><th>Perda %</th><th>Crédito R$</th></tr></thead><tbody>${L.map(x => `<tr><td>${esc(nm(x.nome))}${x.sci ? `<i>${esc(sci(x.sci))}</i>` : ''}</td><td>${fmtInt(x.vendidos)}</td><td><b>${fmtInt(x.mortos)}</b></td><td>${x.pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</td><td>${fmt(x.credito)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>TOTAL (todos os pedidos nacionais)</td><td>${fmtInt(vend)}</td><td>${fmtInt(R.mortos)}</td><td>${vend ? (R.mortos / vend * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '0'}%</td><td>${fmt(R.credito)}</td></tr></tfoot></table>` : '<p class="rpnote big">Nenhuma perda foi registrada nos pedidos deste período. <br><span>(A mortalidade é lançada pelo Histórico, no pedido nacional, em "Mortalidade / crédito".)</span></p>'}
      <p class="rpnote">Considera só os pedidos nacionais do período. As exportações não têm registro de mortalidade no app.</p>${foot(R)}</div>`;
  }
  function pages(R) {
    const G = ST.pg; let ps = [];
    if (G.capa) ps.push(pgCapa(R)); if (G.resumo) ps.push(pgResumo(R)); if (G.evolucao) ps.push(pgEvolucao(R)); if (G.especies) ps.push(...pgsEspecies(R)); if (G.clientes) ps.push(pgClientes(R)); if (G.perdas) ps.push(pgPerdas(R));
    if (!ps.length) ps = [pgResumo(R)];
    const n = ps.length;
    return ps.map((h, i) => h.replace('<span data-rppg></span>', `<span>Página ${i + 1} de ${n}</span>`));
  }

  /* ====================== PDF / EXCEL / COMPARTILHAR ====================== */
  const loadJS = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Não consegui carregar ' + src + ' (sem internet?)')); document.head.appendChild(s); });
  async function libs() { if (!window.html2canvas) await loadJS('vendor/html2canvas.min.js'); if (!(window.jspdf && window.jspdf.jsPDF)) await loadJS('vendor/jspdf.umd.min.js'); }
  const fileBase = R => `RELATORIO_VENDAS_${R.a}_a_${R.b}`;
  async function makePDF(R) {
    await libs();
    const host = document.createElement('div'); host.className = 'rpHost'; host.innerHTML = pages(R).join(''); document.body.appendChild(host);
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const pdf = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
      const els = [...host.querySelectorAll('.rpg')];
      for (let i = 0; i < els.length; i++) {
        const cv = await window.html2canvas(els[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, width: 794, height: 1123, windowWidth: 794 });
        if (i) pdf.addPage();
        pdf.addImage(cv.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, 595.28, 841.89, undefined, 'FAST');
      }
      pdf.setProperties({ title: `${titulo()} ${dBR(R.a)} a ${dBR(R.b)}`, subject: titulo(), author: empresa(), creator: 'Sistema de Pedidos Prestige' });
      return pdf.output('blob');
    } finally { host.remove(); }
  }
  async function makeXLSX(R) {
    const wb = new ExcelJS.Workbook(), hd = (ws, cols) => { ws.columns = cols; const r = ws.getRow(1); r.font = { bold: true, color: { argb: 'FFFFFFFF' } }; r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F8F86' } }; ws.views = [{ state: 'frozen', ySplit: 1 }]; };
    const c = R.cur, w0 = wb.addWorksheet('Resumo');
    hd(w0, [{ header: 'Indicador', key: 'k', width: 38 }, { header: 'Nacional', key: 'n', width: 18 }, { header: 'Exportação', key: 'x', width: 18 }, { header: 'Total', key: 't', width: 18 }]);
    [['Período', per(R), '', ''], ['Pedidos / embarques', c.nac.pedidos, c.exp.pedidos, c.pedidos], ['Caixas', c.nac.caixas, c.exp.caixas, c.caixas], ['Peixes', c.nac.peixes, c.exp.peixes, c.peixes], ['Valor (R$ nacional / US$ exportação)', c.nac.valor, c.exp.usd, ''], ['Exportação convertida em R$', '', c.exp.brl, c.valorBRL],
      ['Comparado com ' + R.pv.lbl + ' (' + dBR(R.pv.a) + ' a ' + dBR(R.pv.b) + ')', '', '', ''], ['Caixas no período anterior', R.prev.nac.caixas, R.prev.exp.caixas, R.prev.caixas], ['Variação de caixas (%)', '', '', R.change.caixas == null ? '' : R.change.caixas]].forEach(r => w0.addRow({ k: r[0], n: r[1], x: r[2], t: r[3] }));
    const w1 = wb.addWorksheet('Por espécie'); hd(w1, [{ header: 'Espécie', key: 'e', width: 30 }, { header: 'Nome científico', key: 's', width: 32 }, { header: 'Caixas nac.', key: 'a', width: 12 }, { header: 'Peixes nac.', key: 'b', width: 12 }, { header: 'Caixas exp.', key: 'c', width: 12 }, { header: 'Peixes exp.', key: 'd', width: 12 }, { header: 'Total peixes', key: 't', width: 13 }]);
    R.species.forEach(x => w1.addRow({ e: nm(x.nome), s: sci(x.sci), a: x.nCx, b: x.nUn, c: x.xCx, d: x.xUn, t: x.un })); const n1 = R.species.length + 1;
    if (n1 > 1) w1.addRow({ e: 'TOTAL', a: { formula: `SUM(C2:C${n1})` }, b: { formula: `SUM(D2:D${n1})` }, c: { formula: `SUM(E2:E${n1})` }, d: { formula: `SUM(F2:F${n1})` }, t: { formula: `SUM(G2:G${n1})` } }).font = { bold: true };
    ['b', 'd', 't'].forEach(k => { w1.getColumn(k).numFmt = '#,##0'; });
    const w2 = wb.addWorksheet(R.dias.weekly ? 'Por semana' : 'Por dia'); hd(w2, [{ header: R.dias.weekly ? 'Semana (início)' : 'Dia', key: 'd', width: 16 }, { header: 'Caixas nacional', key: 'n', width: 16 }, { header: 'Caixas exportação', key: 'x', width: 18 }, { header: 'Pedidos nac.', key: 'p', width: 13 }, { header: 'Embarques', key: 'e', width: 12 }, { header: 'Faturamento R$ (exp. convertida)', key: 'v', width: 30 }]);
    R.dias.list.forEach(d => w2.addRow({ d: R.dias.weekly ? dBR(d.k) : dBR(d.k) + ' ' + DOW[dow(d.k)], n: d.n, x: d.x, p: d.pn, e: d.px, v: r2(d.valor) })); w2.getColumn('v').numFmt = '#,##0.00';
    const w3 = wb.addWorksheet('Clientes'); hd(w3, [{ header: 'Tipo', key: 't', width: 12 }, { header: 'Cliente', key: 'c', width: 34 }, { header: 'Pedidos', key: 'p', width: 10 }, { header: 'Caixas', key: 'x', width: 10 }, { header: 'Valor (R$ ou US$)', key: 'v', width: 18 }, { header: 'Moeda', key: 'm', width: 8 }, { header: '≈ R$', key: 'b', width: 16 }]);
    R.cliN.forEach(x => w3.addRow({ t: 'Nacional', c: nm(x.nome), p: x.pedidos, x: x.caixas, v: r2(x.valor), m: 'R$', b: r2(x.valor) })); R.cliX.forEach(x => w3.addRow({ t: 'Exportação', c: nm(x.nome), p: x.pedidos, x: x.caixas, v: r2(x.usd), m: 'US$', b: r2(x.brl) })); w3.getColumn('v').numFmt = '#,##0.00'; w3.getColumn('b').numFmt = '#,##0.00';
    const w4 = wb.addWorksheet('Exportação por destino'); hd(w4, [{ header: 'Destino', key: 'd', width: 26 }, { header: 'Embarques', key: 'p', width: 11 }, { header: 'Caixas', key: 'c', width: 10 }, { header: 'Peixes', key: 'f', width: 12 }, { header: 'US$', key: 'u', width: 14 }, { header: '≈ R$', key: 'b', width: 14 }]);
    R.destinos.forEach(d => w4.addRow({ d: d.nome, p: d.pedidos, c: d.caixas, f: d.peixes, u: r2(d.usd), b: r2(d.brl) })); ['u', 'b'].forEach(k => { w4.getColumn(k).numFmt = '#,##0.00'; });
    const w5 = wb.addWorksheet(R.evo.short ? 'Evolução 8 semanas' : 'Evolução 6 meses'); hd(w5, [{ header: R.evo.short ? 'Semana' : 'Mês', key: 'l', width: 16 }, { header: 'Caixas nacional', key: 'n', width: 16 }, { header: 'Caixas exportação', key: 'x', width: 18 }, { header: 'Peixes', key: 'p', width: 12 }, { header: 'Faturamento R$ (exp. convertida)', key: 'v', width: 30 }]);
    R.evo.list.forEach(o => w5.addRow({ l: R.evo.short ? dBR(o.s) + ' a ' + dBR(o.e) : o.lbl, n: o.n, x: o.x, p: o.peixes, v: r2(o.valor) })); w5.getColumn('v').numFmt = '#,##0.00';
    const w6 = wb.addWorksheet('Perdas'); hd(w6, [{ header: 'Espécie', key: 'e', width: 30 }, { header: 'Vendidos (nacional)', key: 'v', width: 18 }, { header: 'Mortos', key: 'm', width: 10 }, { header: 'Perda %', key: 'p', width: 10 }, { header: 'Crédito R$', key: 'c', width: 14 }]);
    R.perdas.forEach(x => w6.addRow({ e: nm(x.nome), v: x.vendidos, m: x.mortos, p: Math.round(x.pct * 100) / 100, c: r2(x.credito) })); w6.getColumn('c').numFmt = '#,##0.00';
    return new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* ====================== COTAÇÃO (PTAX) ====================== */
  async function buscaPtax(root) {
    ST.rateMsg = 'Buscando a cotação no Banco Central…'; renderBar(root);
    try {
      let d = new Date(); d = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
      for (let i = 0; i < 7; i++) {
        const q = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
        const r = await fetch(`https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${q}'&$format=json`), j = await r.json();
        if (j.value && j.value.length) { const v = j.value[j.value.length - 1]; ST.rate = +v.cotacaoCompra; ST.rateDate = today(d); ST.rateMsg = 'PTAX compra de ' + dBR(ST.rateDate) + ' (Banco Central). Pode corrigir o valor.'; persist(); ST.cache = null; ST.txt = null; render(root); return; }
        d.setDate(d.getDate() - 1);
      }
      ST.rateMsg = 'O Banco Central não devolveu cotação. Digite o valor.';
    } catch (_) { ST.rateMsg = 'Não consegui consultar o Banco Central agora (sem internet?). Digite a cotação.'; }
    renderBar(root);
  }

  /* ====================== TELA (dentro do Painel) ====================== */
  let ROOT = null;
  const get = () => { const r = rangeOf(ST.p); if (ST.p !== 'livre') { ST.a = r.a; ST.b = r.b; } return detail(r.a, r.b, ST.p, ST.rate); };
  function barHTML(R) {
    const chip = k => `<button type="button" data-rp="p:${k}" aria-pressed="${ST.p === k}">${PNAME[k]}</button>`;
    const c = R.cur;
    return `<div class="row between"><h2>Relatório de vendas (PDF)</h2></div>
      <p class="note">Semana de segunda a domingo. Junta pedidos nacionais e exportações, com caixas, peixes por espécie, valores e comparativo com o período anterior.</p>
      <div class="rpchips">${chip('semana')}${chip('semana_ant')}${chip('mes')}${chip('mes_ant')}${chip('livre')}</div>
      <div class="row rpdates"><div class="field"><label for="rpA">De</label><input id="rpA" type="date" value="${R.a}"></div><div class="field"><label for="rpB">Até</label><input id="rpB" type="date" value="${R.b}"></div>
      <div class="field"><label for="rpRate">Cotação do dólar (R$)</label><input id="rpRate" inputmode="decimal" value="${ST.rate ? String(ST.rate).replace('.', ',') : ''}" placeholder="ex.: 5,40"></div>
      <button type="button" data-rp="ptax">Buscar cotação do dia</button></div>
      <p class="note" data-rpmsg-rate>${esc(ST.rateMsg || (ST.rate ? 'Cotação usada nos embarques que não têm uma salva.' : 'Sem cotação: a exportação aparece só em US$.'))}${c.exp.sem ? ` <b>${c.exp.sem} embarque(s) sem cotação.</b>` : ''}</p>
      <details class="rpcust" ${ST.cust ? 'open' : ''}><summary>Personalizar o relatório (editar textos e escolher páginas)</summary>
        <div class="rpcbody">
          <div class="row"><div class="field" style="flex:1 1 260px"><label for="rpTitle">Título do relatório</label><input id="rpTitle" maxlength="60" value="${esc(ST.title)}" placeholder="Relatório de vendas"></div>
          <div class="field" style="flex:1 1 200px"><label for="rpBy">Preparado por (na capa)</label><input id="rpBy" maxlength="60" value="${esc(ST.by == null ? (store.get('uNome', 'Raphael') || '') : ST.by)}"></div></div>
          <div class="field"><label for="rpTxt">Resumo em texto (primeira página de dados)</label><textarea id="rpTxt" rows="5" maxlength="700">${esc(ST.txt === null ? textoResumo(R, false) : ST.txt)}</textarea></div>
          <div class="row"><button type="button" data-rp="txtauto">Voltar ao texto automático</button><span class="note">Se você trocar o período ou a cotação, o texto volta a ser o automático.</span></div>
          <div class="field"><label for="rpObs">Observações (aparecem numa caixa no fim do resumo; deixe vazio para não mostrar)</label><textarea id="rpObs" rows="3" maxlength="450" placeholder="Ex.: semana com feriado na quinta; embarque do Japão atrasou.">${esc(ST.obs)}</textarea></div>
          <div class="rppgs"><b>Páginas do PDF</b>${PGS.map(([k, t]) => `<label><input type="checkbox" data-rpg="${k}" ${ST.pg[k] ? 'checked' : ''}> ${t}</label>`).join('')}</div>
        </div></details>
      <p class="rpresumo">${R.vazio ? 'Nenhuma venda neste período.' : `<b>${dBR(R.a)} a ${dBR(R.b)}</b> · ${plural(c.nac.pedidos, 'pedido nacional', 'pedidos nacionais')} · ${plural(c.exp.pedidos, 'exportação', 'exportações')} · ${fmtInt(c.caixas)} caixas · ${fmtInt(c.peixes)} peixes`}</p>
      <div class="row"><button type="button" class="primary" data-rp="pdf" ${R.vazio ? 'disabled' : ''}>Baixar PDF</button><button type="button" data-rp="share" ${R.vazio ? 'disabled' : ''}>Compartilhar (WhatsApp)</button><button type="button" data-rp="xlsx" ${R.vazio ? 'disabled' : ''}>Baixar Excel</button><button type="button" data-rp="view">${ST.open ? 'Esconder prévia' : 'Ver prévia'}</button></div>
      <p class="note" data-rpmsg role="status"></p>`;
  }
  function renderBar(root) { const el = root.querySelector('[data-rpmsg-rate]'); if (el) el.firstChild && (el.firstChild.textContent = ST.rateMsg); }
  function render(root) {
    if (!root) return; ROOT = root;
    const R = get(); ST.cache = null;
    root.innerHTML = `<div class="rpbar">${barHTML(R)}</div><div class="rpprev" ${ST.open ? '' : 'hidden'}></div>`;
    if (ST.open) fillPreview(root, R);
  }
  function fillPreview(root, R) {
    const box = root.querySelector('.rpprev'); if (!box) return;
    const w = Math.max(280, Math.min(794, box.clientWidth || root.clientWidth || 794)), s = w / 794;
    box.innerHTML = pages(R).map(h => `<div class="rpshell" style="width:${Math.round(794 * s)}px;height:${Math.round(1123 * s)}px"><div class="rpscale" style="transform:scale(${s})">${h}</div></div>`).join('');
  }
  async function act(root, k) {
    const R = get(), name = fileBase(R);
    if (k === 'ptax') return buscaPtax(root);
    if (k === 'view') { ST.open = !ST.open; return render(root); }
    if (k === 'txtauto') { ST.txt = null; return render(root); }
    if (k.startsWith('p:')) { const p = k.slice(2); if (p === 'livre') { const r = rangeOf(ST.p); ST.a = r.a; ST.b = r.b; } ST.p = p; ST.txt = null; persist(); return render(root); }
    if (R.vazio) return;
    const busy = on => root.querySelectorAll('[data-rp]').forEach(b => { b.disabled = on; });
    try {
      if (k === 'pdf' || k === 'share') {
        busy(true); msgEl(root, 'Montando o PDF… (leva alguns segundos)');
        const blob = await makePDF(R); ST.last = { blob, name: name + '.pdf', text: ST.txt === null ? textoResumo(R, false) : ST.txt.trim() || titulo() };
        if (k === 'pdf') { PP.saveBlob(ST.last.name, blob); msgEl(root, 'PDF baixado: ' + ST.last.name); }
        else await shareLast(root);
      } else if (k === 'xlsx') { const blob = await makeXLSX(R); PP.saveBlob(name + '.xlsx', blob); msgEl(root, 'Excel baixado: ' + name + '.xlsx'); }
      else if (k === 'sharenow') await shareLast(root);
    } catch (e) { msgEl(root, 'Não deu certo: ' + (e && e.message ? e.message : e)); }
    finally { busy(false); const v = root.querySelector('[data-rp="pdf"]'); if (v && R.vazio) v.disabled = true; }
  }
  async function shareLast(root) {
    const L = ST.last; if (!L) return;
    const file = new File([L.blob], L.name, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Relatório de vendas', text: L.text }); msgEl(root, 'Compartilhado.'); return; }
      catch (e) { if (e && e.name === 'AbortError') { msgEl(root, 'Envio cancelado.'); return; } msgEl(root, 'O celular pediu um toque novo para abrir o WhatsApp. Toque em "Enviar agora".'); const m = root.querySelector('[data-rpmsg]'); if (m && !root.querySelector('[data-rp="sharenow"]')) m.insertAdjacentHTML('afterend', '<button type="button" class="primary" data-rp="sharenow">Enviar agora</button>'); return; }
    }
    PP.saveBlob(L.name, L.blob);
    window.open('https://wa.me/?text=' + encodeURIComponent(L.text), '_blank');
    msgEl(root, 'Este aparelho não envia arquivo direto. Baixei o PDF e abri o WhatsApp com o resumo; é só anexar o PDF.');
  }
  document.addEventListener('click', ev => { const b = ev.target.closest('[data-rp]'); if (!b || !ROOT || !ROOT.contains(b)) return; act(ROOT, b.dataset.rp); });
  const refreshPreview = () => { if (ST.open && ROOT) { const box = ROOT.querySelector('.rpprev'); if (box) fillPreview(ROOT, get()); } };
  document.addEventListener('toggle', ev => { const t = ev.target; if (ROOT && t && t.classList && t.classList.contains('rpcust') && ROOT.contains(t)) ST.cust = t.open; }, true);
  document.addEventListener('input', ev => {
    const t = ev.target; if (!ROOT || !ROOT.contains(t)) return;
    if (t.id === 'rpTitle') { ST.title = t.value; persist(); } else if (t.id === 'rpBy') { ST.by = t.value; persist(); } else if (t.id === 'rpTxt') ST.txt = t.value; else if (t.id === 'rpObs') ST.obs = t.value;
  });
  document.addEventListener('change', ev => {
    const t = ev.target; if (!ROOT || !ROOT.contains(t)) return;
    if (['rpTitle', 'rpBy', 'rpTxt', 'rpObs'].includes(t.id)) { refreshPreview(); return; }
    if (t.dataset && t.dataset.rpg) { ST.pg[t.dataset.rpg] = t.checked ? 1 : 0; if (!Object.values(ST.pg).some(Boolean)) { ST.pg.resumo = 1; t.checked = false; ROOT.querySelector('[data-rpg="resumo"]').checked = true; } persist(); refreshPreview(); return; }
    if (t.id === 'rpA' || t.id === 'rpB') { if (t.id === 'rpA') ST.a = t.value || ST.a; else ST.b = t.value || ST.b; if (ST.a > ST.b) { const x = ST.a; ST.a = ST.b; ST.b = x; } ST.p = 'livre'; ST.txt = null; persist(); render(ROOT); }
    else if (t.id === 'rpRate') { const v = parseFloat(String(t.value).replace(',', '.')); ST.rate = v > 0 ? v : 0; ST.rateDate = today(); ST.rateMsg = ST.rate ? 'Cotação ajustada por você.' : ''; ST.txt = null; persist(); render(ROOT); }
  });
  function mount(root) {
    render(root);
    if (!ST.rate || ST.rateDate !== today()) { if (!ST.autoTried || ST.autoTried !== today()) { ST.autoTried = today(); buscaPtax(root); } }
  }

  PP.relatorio = { mount, render, detail, summary, pages, rangeOf, prevOf, state: ST, makePDF, makeXLSX, textoResumo, expTot, rateOf };
})();
