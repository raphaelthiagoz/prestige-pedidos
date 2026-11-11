/* Aba "Financeiro": quem está devendo, quanto, há quantos dias; registrar pagamento; copiar cobrança. Pedidos nacionais (S.hist). */
(function () {
  'use strict';
  const PP = window.PP, S = PP.S, F = PP.Features, esc = PP.esc, $ = PP.$, fmt = PP.fmt;
  const prazo = () => S.cfg.prazoPag || 7;
  const dBR = iso => (iso ? String(iso).split('-').reverse().join('/') : '');
  const dCurta = iso => (iso ? String(iso).split('-').reverse().slice(0, 2).join('/') : '');
  const r2 = v => Math.round(v * 100) / 100;
  const up = s => String(s || '').toUpperCase().trim();
  const ST = { mod: 'nac', fx: 'receber', filtro: 'receber', mes: '', aberto: {}, pagando: null, msg: '' };
  const mesDe = iso => String(iso || '').slice(0, 7);
  const mesNome = ym => { if (!ym) return ''; const [y, m] = ym.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); };
  const addDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return F.todayISO(d); };
  const chip = (k, t) => `<span class="chip ${k}">${esc(t)}</span>`;

  function linhas() {
    const hoje = F.todayISO();
    return (S.hist || []).filter(F.active).map(e => {
      const s = F.situacao(e, hoje, prazo()), dev = F.devido(e), pago = r2((e.pay && e.pay.pago) || 0);
      return { e, s, dev, pago, saldo: s.saldo, vence: addDias(e.dataISO, prazo()), dias: s.dias, nome: e.cliente.nome || '(sem nome)', emit: e.dataISO, dataPago: (e.pay && e.pay.dataPago) || '' };
    });
  }
  function meses(L) {
    const set = new Set([mesDe(F.todayISO())]); L.forEach(x => { if (x.e.dataISO) set.add(mesDe(x.e.dataISO)); if (x.e.pay && x.e.pay.dataPago) set.add(mesDe(x.e.pay.dataPago)); });
    return Array.from(set).sort().reverse();
  }
  function totais(L, mes) {
    const aberto = L.filter(x => x.saldo > 0), atras = aberto.filter(x => x.s.key === 'atrasado');
    const rec = L.reduce((a, x) => a + (x.pago > 0 && mesDe((x.e.pay && x.e.pay.dataPago) || x.e.dataISO) === mes ? x.pago : 0), 0);
    const nRec = L.filter(x => x.pago > 0 && mesDe((x.e.pay && x.e.pay.dataPago) || x.e.dataISO) === mes).length;
    const fat = L.filter(x => mesDe(x.e.dataISO) === mes).reduce((a, x) => a + x.dev, 0);
    return {
      receber: r2(aberto.reduce((a, x) => a + x.saldo, 0)), nReceber: aberto.length, nCli: new Set(aberto.map(x => up(x.nome))).size,
      atrasado: r2(atras.reduce((a, x) => a + x.saldo, 0)), nAtras: atras.length, recebido: r2(rec), nRec, fat: r2(fat)
    };
  }
  function filtrar(L) {
    if (ST.filtro === 'receber') return L.filter(x => x.saldo > 0);
    if (ST.filtro === 'atrasados') return L.filter(x => x.s.key === 'atrasado' && x.saldo > 0);
    if (ST.filtro === 'recebidos') return L.filter(x => x.pago > 0 && mesDe((x.e.pay && x.e.pay.dataPago) || x.e.dataISO) === ST.mes);
    return L.filter(x => mesDe(x.e.dataISO) === ST.mes);
  }
  function grupos(L) {
    const m = {};
    L.forEach(x => { const k = up(x.nome); (m[k] = m[k] || { nome: x.nome, itens: [] }).itens.push(x); });
    const out = Object.values(m);
    out.forEach(g => { g.itens.sort((a, b) => String(a.e.dataISO).localeCompare(String(b.e.dataISO))); g.dev = r2(g.itens.reduce((a, x) => a + x.dev, 0)); g.saldo = r2(g.itens.reduce((a, x) => a + x.saldo, 0)); g.maxDias = Math.max(0, ...g.itens.filter(x => x.saldo > 0).map(x => x.dias - prazo())); g.atras = g.itens.some(x => x.s.key === 'atrasado'); });
    return out.sort((a, b) => (b.atras - a.atras) || (b.maxDias - a.maxDias) || (b.saldo - a.saldo) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  const sitChip = x => {
    if (x.saldo <= 0) return chip('ok', x.s.key === 'cancelado' ? 'cancelado' : 'pago');
    if (x.s.key === 'atrasado') return chip('bad', (x.dias - prazo()) + ' dia(s) de atraso');
    const f = Math.max(0, prazo() - x.dias); return chip(f <= 3 ? 'warn' : 'ok', f === 0 ? 'vence hoje' : (f <= 3 ? 'vence em ' + f + ' dia(s)' : 'em dia'));
  };
  const grpChip = g => {
    if (g.saldo <= 0) return chip('ok', 'quitado');
    if (g.atras) return chip('bad', g.maxDias + ' dia(s) de atraso');
    const f = Math.min(...g.itens.filter(x => x.saldo > 0).map(x => Math.max(0, prazo() - x.dias)));
    return chip(f <= 3 ? 'warn' : 'ok', f === 0 ? 'vence hoje' : (f <= 3 ? 'vence em ' + f + ' dia(s)' : 'em dia'));
  };

    /* ===================== gráfico: faturado × recebido × atrasado (últimos 6 meses) ===================== */
  const MC = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const kfmt = v => v >= 1000 ? (Math.round(v / 100) / 10).toLocaleString('pt-BR') + 'k' : String(Math.round(v));
  function chartHTML(L, moeda) {
    const hoje = mesDe(F.todayISO()); let [y, m] = hoje.split('-').map(Number); const ms = [];
    for (let i = 0; i < 6; i++) { ms.unshift(y + '-' + String(m).padStart(2, '0')); m--; if (m < 1) { m = 12; y--; } }
    const D = ms.map(k => ({
      k, fat: r2(L.filter(x => mesDe(x.emit) === k).reduce((a, x) => a + x.dev, 0)),
      rec: r2(L.filter(x => x.pago > 0 && mesDe(x.dataPago || x.emit) === k).reduce((a, x) => a + x.pago, 0)),
      atr: r2(L.filter(x => x.saldo > 0 && (x.key || (x.s && x.s.key)) === 'atrasado' && mesDe(x.emit) === k).reduce((a, x) => a + x.saldo, 0))
    }));
    const mx = Math.max(1, ...D.flatMap(d => [d.fat, d.rec, d.atr]));
    if (D.every(d => !d.fat && !d.rec && !d.atr)) return '';
    const W = 980, H = 230, pl = 44, pb = 26, pt = 10, gw = (W - pl - 10) / D.length, bw = Math.min(26, gw * .2), ch = H - pb - pt;
    let g = '';
    [0, .5, 1].forEach(f => { const yy = pt + ch * (1 - f); g += `<line x1="${pl}" x2="${W - 6}" y1="${yy}" y2="${yy}" stroke="rgba(255,255,255,.08)"/><text x="${pl - 6}" y="${yy + 3}" text-anchor="end" font-size="10" fill="currentColor">${kfmt(mx * f)}</text>`; });
    D.forEach((d, i) => {
      const cx = pl + gw * i + gw / 2, bars = [['fat', '#3fd6c8', d.fat], ['rec', '#4cc58a', d.rec], ['atr', '#ef6b6b', d.atr]];
      const [yy, mm] = d.k.split('-'); const rot = MC[+mm - 1] + '/' + yy.slice(2);
      g += `<g data-tip="${rot}: Faturado ${moeda} ${fmt(d.fat)} · Recebido ${moeda} ${fmt(d.rec)} · Atrasado ${moeda} ${fmt(d.atr)}"><title>${rot}: Faturado ${moeda} ${fmt(d.fat)} · Recebido ${moeda} ${fmt(d.rec)} · Atrasado ${moeda} ${fmt(d.atr)}</title>`;
      bars.forEach(([, col, v], j) => { const hh = Math.max(v > 0 ? 2 : 0, ch * v / mx); g += `<rect x="${cx + (j - 1.5) * (bw + 3) + 1.5}" y="${pt + ch - hh}" width="${bw}" height="${hh}" rx="4" fill="${col}"/>`; });
      g += `<rect x="${cx - gw / 2}" y="${pt}" width="${gw}" height="${ch + pb}" fill="transparent" style="animation:none"/></g><text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="11" fill="currentColor">${rot}</text>`;
    });
    return `<div class="hchart" style="margin:12px 0 4px;width:100%;align-self:stretch"><div class="lb muted" style="font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">Faturado × recebido × atrasado · últimos 6 meses (${moeda})</div><svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;max-height:260px;color:var(--muted)" role="img" aria-label="Gráfico de faturamento, recebimentos e atrasos por mês">${g}</svg><div class="row" style="gap:16px;font-size:.78rem;color:var(--muted)"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#3fd6c8;margin-right:5px"></i>faturado</span><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#4cc58a;margin-right:5px"></i>recebido</span><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#ef6b6b;margin-right:5px"></i>atrasado (ainda em aberto)</span></div></div>`;
  }
  const modSw = () => `<div class="row" style="gap:8px;margin:10px 0 4px"><button type="button" class="${ST.mod === 'nac' ? 'primary' : ''}" data-fin="mod" data-k="nac">Nacional · R$</button><button type="button" class="${ST.mod === 'exp' ? 'primary' : ''}" data-fin="mod" data-k="exp">Exportação · US$</button></div>`;
  const fx = el => { try { if (PP.motion && PP.motion.chart) PP.motion.chart(el); } catch (_) { /* ok */ } };

  /* ===================== exportações (US$): cobrança só depois da chegada ===================== */
  const prazoCob = () => +S.cfg.prazoExpCobrar || 10, prazoAtr = () => +S.cfg.prazoExpAtraso || 15;
  const p3 = n => String(n).padStart(3, '0');
  const dDiff = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
  const PRI = { atrasado: 5, cobrar: 4, aguard: 3, transito: 2, semdata: 1, pago: 0 };
  function expLinhas() {
    const hoje = F.todayISO(), kgc = +((S.cfg.valores || {}).kgCaixa) || 0;
    return (PP.exp ? PP.exp.hist() : []).map(e => {
      const x = e.ex || {}, t = e.tot || {};
      let fr = +x.frete || 0; if (!(fr > 0) && +x.tarifa > 0) fr = r2(+x.tarifa * (t.boxes || 0) * kgc);
      const dev = r2(Math.max(0, (t.total || 0) - (+x.disc || 0) - (+x.doa || 0) + fr));
      const pay = e.pay || {}, pago = r2(pay.pago || 0), saldo = (pay.status === 'pago' || dev - pago <= 0.005) ? 0 : r2(dev - pago);
      const dep = String(x.dep || '').slice(0, 10); let che = String(x.vooIntChe || '').slice(0, 10), est = false;
      if (!che && dep) { che = addDias(dep, 3); est = true; }
      const ini = che ? addDias(che, prazoCob()) : '', lim = che ? addDias(che, prazoAtr()) : '';
      let key; if (saldo <= 0) key = 'pago'; else if (!che) key = 'semdata'; else if (hoje < che) key = 'transito'; else if (hoje < ini) key = 'aguard'; else if (hoje <= lim) key = 'cobrar'; else key = 'atrasado';
      return { e, key, nome: (e.cons && e.cons.name) || '(sem nome)', inv: p3(e.n) + '/' + e.ano, dev, pago, saldo, dep, che, est, ini, lim, hoje, atraso: key === 'atrasado' ? dDiff(lim, hoje) : 0, emit: e.dateISO || dep, dataPago: pay.dataPago || '' };
    }).filter(x => x.dev > 0);
  }
  function expTot(L, mes) {
    const ab = L.filter(x => x.saldo > 0), cob = ab.filter(x => x.key === 'cobrar' || x.key === 'atrasado'), atr = ab.filter(x => x.key === 'atrasado'), rc = L.filter(x => x.pago > 0 && mesDe(x.dataPago || x.emit) === mes);
    const sum = a => r2(a.reduce((s2, x) => s2 + x.saldo, 0));
    return { receber: sum(ab), nReceber: ab.length, nCli: new Set(ab.map(x => up(x.nome))).size, cobrar: sum(cob), nCobrar: cob.length, atrasado: sum(atr), nAtras: atr.length, recebido: r2(rc.reduce((s2, x) => s2 + x.pago, 0)), nRec: rc.length, fat: r2(L.filter(x => mesDe(x.emit) === mes).reduce((s2, x) => s2 + x.dev, 0)) };
  }
  function expFiltrar(L) {
    if (ST.fx === 'receber') return L.filter(x => x.saldo > 0);
    if (ST.fx === 'cobrar') return L.filter(x => x.saldo > 0 && (x.key === 'cobrar' || x.key === 'atrasado'));
    if (ST.fx === 'recebidos') return L.filter(x => x.pago > 0 && mesDe(x.dataPago || x.emit) === ST.mes);
    return L.filter(x => mesDe(x.emit) === ST.mes);
  }
  function expGrupos(L) {
    const m = {}; L.forEach(x => { const k = up(x.nome); (m[k] = m[k] || { nome: x.nome, itens: [] }).itens.push(x); });
    const out = Object.values(m);
    out.forEach(g => { g.itens.sort((a, b) => String(a.emit).localeCompare(String(b.emit))); g.dev = r2(g.itens.reduce((a, x) => a + x.dev, 0)); g.saldo = r2(g.itens.reduce((a, x) => a + x.saldo, 0)); g.pri = Math.max(...g.itens.filter(x => x.saldo > 0).map(x => PRI[x.key]), 0); g.worst = g.itens.filter(x => x.saldo > 0).sort((a, b) => PRI[b.key] - PRI[a.key])[0] || null; });
    return out.sort((a, b) => (b.pri - a.pri) || (b.saldo - a.saldo) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  const xChip = x => {
    switch (x.key) {
      case 'pago': return chip('ok', 'pago');
      case 'atrasado': return chip('bad', x.atraso + ' dia(s) de atraso');
      case 'cobrar': return chip('warn', 'hora de cobrar');
      case 'aguard': return chip('ok', 'cobrar em ' + dDiff(x.hoje, x.ini) + ' dia(s)');
      case 'transito': return chip('ok', 'em trânsito · chega ' + dCurta(x.che));
      default: return chip('warn', 'sem data de embarque');
    }
  };
  function msgExp(g) {
    const emp = (S.cfg.empresa && S.cfg.empresa.nome) || 'Prestige Aquarium', ab = g.itens.filter(x => x.saldo > 0);
    if (ab.length === 1) { const x = ab[0]; return `Hello! I hope you are doing well. This is ${emp}. A friendly reminder about invoice ${x.inv}${x.dep ? ' (shipped on ' + dBR(x.dep) + ')' : ''}: the amount due is US$ ${fmt(x.saldo)}. Could you please let us know when the payment will be made and send us the transfer receipt? Thank you very much!`; }
    return `Hello! I hope you are doing well. This is ${emp}. A friendly reminder about the open invoices:\n` + ab.map(x => `• Invoice ${x.inv}${x.dep ? ' (shipped ' + dBR(x.dep) + ')' : ''}: US$ ${fmt(x.saldo)}`).join('\n') + `\nTotal due: US$ ${fmt(g.saldo)}. Could you please send us the transfer receipt once the payment is made? Thank you very much!`;
  }
  function registrarExp(id, valor, data) {
    const e = (PP.exp ? PP.exp.hist() : []).find(x => x.id === id); if (!e) return;
    const v = r2(+valor || 0); if (v <= 0) { ST.msg = 'Informe o valor recebido.'; render(); return; }
    const x = expLinhas().find(l => l.e.id === id);
    e.pay = e.pay || { status: 'aguardando', pago: 0, dataPago: '', obs: '' };
    e.pay.pago = r2((e.pay.pago || 0) + v); e.pay.dataPago = data || F.todayISO();
    if (x && e.pay.pago >= x.dev - 0.005) e.pay.status = 'pago';
    e.upd = Date.now(); try { PP.store.set('exphist', PP.exp.hist()); } catch (_) { /* ok */ }
    ST.pagando = null; ST.msg = `Pagamento de US$ ${fmt(v)} registrado (${(e.cons && e.cons.name) || ''}, invoice ${p3(e.n)}/${e.ano}).`;
    render(); if (PP.assist) PP.assist.refresh(); if (PP.side) PP.side.render();
  }
  function renderExp(el) {
    const L = expLinhas(), M = meses(L.map(x => ({ e: { dataISO: x.emit, pay: { dataPago: x.dataPago } } }))); if (!ST.mes || !M.includes(ST.mes)) ST.mes = M[0];
    const T = expTot(L, ST.mes), G = expGrupos(expFiltrar(L));
    const tab = (k, t) => `<button type="button" class="${ST.fx === k ? 'primary' : ''}" data-fin="fx" data-k="${k}">${t}</button>`;
    let rows = '';
    G.forEach(g => {
      const open = !!ST.aberto['x|' + up(g.nome)], w = g.worst;
      rows += `<tr class="fgrp" data-fin="tog" data-k="${esc('x|' + up(g.nome))}" style="cursor:pointer;background:rgba(255,255,255,.03)"><td><b>${open ? '▾' : '▸'} ${esc(g.nome)}</b></td><td class="muted">${g.itens.length} pedido(s)</td><td></td><td></td><td></td><td class="n">US$ ${fmt(g.dev)}</td><td class="n"><b>US$ ${fmt(g.saldo)}</b></td><td>${w ? xChip(w) : chip('ok', 'quitado')}</td><td class="n">${g.saldo > 0 ? `<button type="button" data-fin="xcobr" data-k="${esc(up(g.nome))}">Copiar cobrança</button>` : ''}</td></tr>`;
      if (open) g.itens.forEach(x => {
        rows += `<tr class="fped"><td class="muted">&nbsp;&nbsp;↳</td><td>Invoice ${esc(x.inv)}</td><td>${x.dep ? dCurta(x.dep) : '—'}</td><td>${x.che ? (x.est ? '~' : '') + dCurta(x.che) : '—'}</td><td>${x.ini ? dCurta(x.ini) : '—'}</td><td class="n">US$ ${fmt(x.dev)}</td><td class="n">US$ ${fmt(x.saldo)}</td><td>${xChip(x)}</td><td class="n">${x.saldo > 0 ? `<button type="button" data-fin="pag" data-id="${x.e.id}">Registrar pagamento</button>` : ''}</td></tr>`;
        if (ST.pagando === x.e.id) rows += `<tr class="fpag"><td></td><td colspan="8"><div class="row" style="align-items:flex-end;gap:10px"><div class="field" style="flex:0 1 180px"><label for="finVal">Valor recebido (US$)</label><input id="finVal" type="number" step="0.01" min="0" value="${x.saldo}"></div><div class="field" style="flex:0 1 170px"><label for="finDat">Data</label><input id="finDat" type="date" value="${F.todayISO()}"></div><button type="button" class="primary" data-fin="pagok" data-id="${x.e.id}">Confirmar</button><button type="button" data-fin="pagno">Cancelar</button></div></td></tr>`;
      });
    });
    el.innerHTML = `<section class="step"><div class="row between"><div><h2 style="margin:0">Financeiro</h2><p class="note" style="margin:2px 0 0">Exportações em US$ (original líquido + frete) · a cobrança só começa ${prazoCob()} dias após a chegada ao cliente e fica atrasada depois de ${prazoAtr()} dias (mude em Configurações). Nunca cobra no dia do embarque.</p></div></div>
      ${modSw()}
      <div class="kpis"><div><b>US$ ${fmt(T.receber)}</b><span>a receber · ${T.nReceber} pedido(s) · ${T.nCli} cliente(s)</span></div><div><b style="color:var(--warn,#e8c15a)">US$ ${fmt(T.cobrar)}</b><span>hora de cobrar · ${T.nCobrar} pedido(s)</span></div><div><b style="color:var(--bad,#ef6b6b)">US$ ${fmt(T.atrasado)}</b><span>atrasado · ${T.nAtras} pedido(s)</span></div><div><b style="color:var(--ok,#4cc58a)">US$ ${fmt(T.recebido)}</b><span>recebido em ${esc(mesNome(ST.mes))} · ${T.nRec} pagamento(s)</span></div><div><b>US$ ${fmt(T.fat)}</b><span>faturamento de ${esc(mesNome(ST.mes))}</span></div></div>
      ${chartHTML(L, 'US$')}
      <div class="row" style="align-items:center;gap:8px;margin:10px 0">${tab('receber', 'A receber')}${tab('cobrar', 'Hora de cobrar')}${tab('recebidos', 'Recebidos')}${tab('todos', 'Todos')}<span style="flex:1"></span><div class="field" style="flex:0 1 220px"><label for="finMes">Mês (recebidos, todos e totais)</label><select id="finMes" data-fin="mes">${M.map(m => `<option value="${m}" ${m === ST.mes ? 'selected' : ''}>${esc(mesNome(m))}</option>`).join('')}</select></div></div>
      ${ST.msg ? `<p class="note" id="finMsg">${esc(ST.msg)}</p>` : ''}
      ${G.length ? `<div class="tablewrap"><table><thead><tr><th>Cliente</th><th>Invoice</th><th>Embarque</th><th>Chegada</th><th>Cobrar a partir de</th><th class="n">Valor</th><th class="n">Falta pagar</th><th>Situação</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="empty">${ST.fx === 'receber' ? 'Nada a receber das exportações. ' : ST.fx === 'cobrar' ? 'Nenhuma exportação para cobrar agora.' : 'Nenhuma exportação neste filtro.'}</p>`}
      <p class="note">“~” na chegada = estimada (embarque + 3 dias), porque a data de chegada do voo internacional ainda não foi preenchida no Roteiro. Clique no cliente para ver os pedidos.</p></section>`;
    fx(el);
  }

  function render() {
    const el = $('vFinanceiro'); if (!el) return;
    if (ST.mod === 'exp') { renderExp(el); return; }
    const L = linhas(), M = meses(L); if (!ST.mes || !M.includes(ST.mes)) ST.mes = M[0];
    const T = totais(L, ST.mes), G = grupos(filtrar(L));
    const tab = (k, t) => `<button type="button" class="${ST.filtro === k ? 'primary' : ''}" data-fin="f" data-k="${k}">${t}</button>`;
    let rows = '';
    G.forEach(g => {
      const open = ST.aberto[up(g.nome)] != null ? ST.aberto[up(g.nome)] : false;
      rows += `<tr class="fgrp" data-fin="tog" data-k="${esc(up(g.nome))}" style="cursor:pointer;background:rgba(255,255,255,.03)"><td><b>${open ? '▾' : '▸'} ${esc(g.nome)}</b></td><td class="muted">${g.itens.length} pedido(s)</td><td></td><td></td><td class="n">R$ ${fmt(g.dev)}</td><td class="n"><b>R$ ${fmt(g.saldo)}</b></td><td>${grpChip(g)}</td><td class="n">${g.saldo > 0 ? `<button type="button" data-fin="cobr" data-k="${esc(up(g.nome))}">Copiar cobrança</button>` : ''}</td></tr>`;
      if (open) g.itens.forEach(x => {
        rows += `<tr class="fped"><td class="muted">&nbsp;&nbsp;↳</td><td>${x.e.nf ? 'NF ' + esc(x.e.nf) : 'Invoice ' + esc(x.e.inv)}</td><td>${dCurta(x.e.dataISO)}</td><td>${dCurta(x.vence)}</td><td class="n">R$ ${fmt(x.dev)}</td><td class="n">R$ ${fmt(x.saldo)}</td><td>${sitChip(x)}</td><td class="n">${x.saldo > 0 ? `<button type="button" data-fin="pag" data-id="${x.e.id}">Registrar pagamento</button>` : ''}</td></tr>`;
        if (ST.pagando === x.e.id) rows += `<tr class="fpag"><td></td><td colspan="7"><div class="row" style="align-items:flex-end;gap:10px"><div class="field" style="flex:0 1 180px"><label for="finVal">Valor recebido (R$)</label><input id="finVal" type="number" step="0.01" min="0" value="${x.saldo}"></div><div class="field" style="flex:0 1 170px"><label for="finDat">Data</label><input id="finDat" type="date" value="${F.todayISO()}"></div><button type="button" class="primary" data-fin="pagok" data-id="${x.e.id}">Confirmar</button><button type="button" data-fin="pagno">Cancelar</button></div></td></tr>`;
      });
    });
    el.innerHTML = `<section class="step"><div class="row between"><div><h2 style="margin:0">Financeiro</h2><p class="note" style="margin:2px 0 0">Quem está devendo, quanto e há quantos dias · pedidos nacionais (prazo de ${prazo()} dias, mude em Configurações)</p></div></div>
      ${modSw()}
      <div class="kpis"><div><b>R$ ${fmt(T.receber)}</b><span>a receber · ${T.nReceber} pedido(s) · ${T.nCli} cliente(s)</span></div><div><b style="color:var(--bad,#ef6b6b)">R$ ${fmt(T.atrasado)}</b><span>atrasado · ${T.nAtras} pedido(s)</span></div><div><b style="color:var(--ok,#4cc58a)">R$ ${fmt(T.recebido)}</b><span>recebido em ${esc(mesNome(ST.mes))} · ${T.nRec} pagamento(s)</span></div><div><b>R$ ${fmt(T.fat)}</b><span>faturamento de ${esc(mesNome(ST.mes))}</span></div></div>
      ${chartHTML(L.map(x => Object.assign({}, x, { key: x.s.key })), 'R$')}
      <div class="row" style="align-items:center;gap:8px;margin:10px 0">${tab('receber', 'A receber')}${tab('atrasados', 'Atrasados')}${tab('recebidos', 'Recebidos')}${tab('todos', 'Todos')}<span style="flex:1"></span><div class="field" style="flex:0 1 220px"><label for="finMes">Mês (recebidos, todos e totais)</label><select id="finMes" data-fin="mes">${M.map(m => `<option value="${m}" ${m === ST.mes ? 'selected' : ''}>${esc(mesNome(m))}</option>`).join('')}</select></div></div>
      ${ST.msg ? `<p class="note" id="finMsg">${esc(ST.msg)}</p>` : ''}
      ${G.length ? `<div class="tablewrap"><table><thead><tr><th>Cliente</th><th>Pedido</th><th>Emitido</th><th>Vence</th><th class="n">Valor</th><th class="n">Falta pagar</th><th>Situação</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="empty">${ST.filtro === 'receber' ? 'Nada a receber. Todos os pedidos estão pagos. ' : ST.filtro === 'atrasados' ? 'Nenhum pedido atrasado.' : 'Nenhum pedido neste filtro.'}</p>`}
      <p class="note">Clique no nome do cliente para ver os pedidos dele. As exportações (em US$) estão no botão “Exportação · US$” acima.</p></section>`;
    fx(el);
  }

  function msgCliente(g) {
    const emp = (S.cfg.empresa && S.cfg.empresa.nome) || 'Prestige Aquarium', ab = g.itens.filter(x => x.saldo > 0);
    if (ab.length === 1) return F.msgCobranca(ab[0].e, emp);
    return `Olá! Tudo bem? Aqui é da ${emp}. Passando para lembrar dos pedidos em aberto:\n` + ab.map(x => `• ${dBR(x.e.dataISO)} (${x.e.nf ? 'NF ' + x.e.nf : 'invoice ' + x.e.inv}): R$ ${fmt(x.saldo)}`).join('\n') + `\nTotal em aberto: R$ ${fmt(g.saldo)}. Pode nos enviar o comprovante assim que fizer? Obrigado!`;
  }
  async function copiar(t) { try { await navigator.clipboard.writeText(t); } catch (_) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (__) { /* ok */ } ta.remove(); } }
  function registrar(id, valor, data) {
    const e = (S.hist || []).find(x => x.id === id); if (!e) return;
    const v = r2(+valor || 0); if (v <= 0) { ST.msg = 'Informe o valor recebido.'; render(); return; }
    e.pay = e.pay || { status: 'aguardando', pago: 0, dataPago: '', obs: '' };
    e.pay.pago = r2((e.pay.pago || 0) + v); e.pay.dataPago = data || F.todayISO();
    if (F.saldo(e) <= 0.005) e.pay.status = 'pago';
    e.upd = Date.now(); PP.saveHist(); ST.pagando = null;
    ST.msg = `Pagamento de R$ ${fmt(v)} registrado (${e.cliente.nome}, ${e.nf ? 'NF ' + e.nf : 'invoice ' + e.inv}).`;
    if (PP.renderClientes) PP.renderClientes();
    render(); if (PP.assist) PP.assist.refresh(); if (PP.side) PP.side.render();
  }
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-fin]'); if (!b || !$('vFinanceiro').contains(b) || b.tagName === 'SELECT') return;
    const a = b.dataset.fin;
    if (a === 'mod') { ST.mod = b.dataset.k; ST.pagando = null; ST.msg = ''; ST.mes = ''; render(); }
    else if (a === 'fx') { ST.fx = b.dataset.k; ST.pagando = null; ST.msg = ''; render(); }
    else if (a === 'xcobr') { const g = expGrupos(expLinhas().filter(x => up(x.nome) === b.dataset.k))[0]; if (g) { await copiar(msgExp(g)); ST.msg = 'Mensagem de cobrança (em inglês) copiada. É só colar no e-mail ou WhatsApp do cliente.'; render(); } }
    else if (a === 'f') { ST.filtro = b.dataset.k; ST.pagando = null; ST.msg = ''; render(); }
    else if (a === 'tog') { if (ev.target.closest('button')) return; ST.aberto[b.dataset.k] = !ST.aberto[b.dataset.k]; render(); }
    else if (a === 'cobr') { const g = grupos(linhas().filter(x => up(x.nome) === b.dataset.k))[0]; if (g) { await copiar(msgCliente(g)); ST.msg = 'Mensagem de cobrança copiada. É só colar no WhatsApp do cliente.'; render(); } }
    else if (a === 'pag') { ST.pagando = b.dataset.id; ST.msg = ''; render(); const i = $('finVal'); if (i) i.focus(); }
    else if (a === 'pagno') { ST.pagando = null; render(); }
    else if (a === 'pagok') { if (ST.mod === 'exp') registrarExp(b.dataset.id, $('finVal').value, $('finDat').value); else registrar(b.dataset.id, $('finVal').value, $('finDat').value); }
  });
  document.addEventListener('change', ev => { const t = ev.target; if (t && t.id === 'finMes' && $('vFinanceiro').contains(t)) { ST.mes = t.value; render(); } });
  PP.fin = { render, _x: { linhas, totais, grupos, msgCliente, expLinhas, expTot, expGrupos, msgExp } };
})();
