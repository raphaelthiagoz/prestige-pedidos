/* Aba Clientes: cadastro + ficha (último pedido, histórico, total, mais pedidos, fretes, exportações) + importação de planilha. */
(function () {
  'use strict';
  const PP = window.PP, S = PP.S, store = PP.store, F = PP.Features, esc = PP.esc, $ = PP.$, fmt = PP.fmt;
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const up = s => String(s || '').trim().toUpperCase();
  const dBR = iso => (iso ? String(iso).split('-').reverse().join('/') : '');
  const brl = n => 'R$ ' + fmt(+n || 0);
  const ST = { letra: '', sel: -1, q: '', f: 'todos', ord: 'az', tab: 'resumo', edit: false, all: false, imp: null, cnpjMsg: '', cnpjBusy: false };
  const FIELDS = [['nome', 'Nome', ['nome', 'cliente', 'razao social', 'razao', 'fantasia', 'empresa']], ['end', 'Endereço', ['endereco', 'logradouro', 'rua']], ['cidade', 'Cidade', ['cidade', 'municipio', 'cidade/uf', 'cidade uf']], ['aero', 'Aeroporto', ['aeroporto', 'aero']], ['tel', 'Telefone', ['telefone', 'celular', 'whatsapp', 'fone', 'contato']], ['email', 'E-mail', ['e-mail', 'email', 'mail']], ['doc', 'CNPJ / CPF', ['cnpj', 'cpf', 'documento', 'cnpj/cpf', 'doc']], ['ie', 'Inscrição estadual', ['inscricao estadual', 'insc estadual', 'inscricao', 'ie']], ['cep', 'CEP', ['cep']], ['desc', 'Desconto %', ['desconto', 'desc']], ['obs', 'Observações', ['observacoes', 'observacao', 'obs', 'anotacoes']]];

  /* ---------- números de cada cliente ---------- */
  const histOf = c => S.hist.filter(e => up(e.cliente.nome) === up(c.nome) && F.active(e)).sort((a, b) => b.dataISO.localeCompare(a.dataISO) || (b.ts || 0) - (a.ts || 0));
  function statsOf(c) {
    const L = histOf(c), hoje = F.todayISO(), prazo = S.cfg.prazoPag || 7;
    const sit = L.map(e => F.situacao(e, hoje, prazo));
    const total = F.r2(L.reduce((s, e) => s + F.devido(e), 0)), aberto = F.r2(sit.reduce((s, x) => s + x.saldo, 0)), atras = sit.filter(x => x.key === 'atrasado').length;
    const last = L[0] || null, dias = last ? F.daysBetween(last.dataISO, hoje) : null;
    const freq = L.length > 1 ? Math.round(F.daysBetween(L[L.length - 1].dataISO, L[0].dataISO) / (L.length - 1)) : null;
    const top = {};
    L.forEach(e => (e.lines || []).forEach(l => { const k = l.sci || l.nome; const o = top[k] || (top[k] = { nome: l.comum || l.nome || l.sci, sci: l.sci, peixes: 0, pedidos: 0 }); o.peixes += +l.peixes || 0; o.pedidos++; }));
    return { L, sit, total, aberto, atras, last, dias, freq, ticket: L.length ? F.r2(total / L.length) : 0, top: Object.values(top).sort((a, b) => b.peixes - a.peixes).slice(0, 6), credito: F.creditoCliente(S.hist, c.nome) };
  }
  const sumido = st => st.dias != null && (st.dias > 30 || (st.freq && st.dias > st.freq * 1.8 && st.dias > 14));
  const ultTxt = st => (st.dias == null ? 'nunca pediu' : st.dias === 0 ? 'pediu hoje' : st.dias === 1 ? 'pediu ontem' : `último pedido há ${st.dias} dias`);
  const casa = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };

  /* ---------- lista ---------- */
  const ini = c => { const ch = norm(String(c.nome || '').trim()).charAt(0).toUpperCase(); return /[A-Z]/.test(ch) ? ch : '#'; };
  function rows(semLetra) {
    const q = norm(ST.q);
    let L = S.clientes.map((c, i) => ({ c, i, st: statsOf(c) }));
    if (q) L = L.filter(x => norm([x.c.nome, x.c.cidade, x.c.aero, x.c.tel, x.c.email, x.c.doc].join(' ')).includes(q));
    if (ST.f === 'aberto') L = L.filter(x => x.st.aberto > 0); else if (ST.f === 'sumido') L = L.filter(x => sumido(x.st)); else if (ST.f === 'nunca') L = L.filter(x => x.st.dias == null);
    const base = L; if (ST.letra && !semLetra) L = L.filter(x => ini(x.c) === ST.letra);
    if (ST.ord === 'az') return L.sort((a, b) => a.c.nome.localeCompare(b.c.nome, 'pt-BR'));
    return L.sort((a, b) => (a.st.dias == null) - (b.st.dias == null) || (a.st.dias || 0) - (b.st.dias || 0) || a.c.nome.localeCompare(b.c.nome));
  }
  function letrasHTML() {
    const cont = {}; rows(true).forEach(x => { const l = ini(x.c); cont[l] = (cont[l] || 0) + 1; });
    const ls = Object.keys(cont).sort((a, b) => (a === '#') - (b === '#') || a.localeCompare(b));
    if (ls.length < 2) return '';
    if (ST.letra && !cont[ST.letra]) ST.letra = '';
    return `<div class="clletras" role="group" aria-label="Filtrar por letra"><button type="button" class="${ST.letra ? '' : 'on'}" data-cll="">Todos</button>${ls.map(l => `<button type="button" class="${ST.letra === l ? 'on' : ''}" data-cll="${l}" title="${cont[l]} cliente(s)">${l}</button>`).join('')}</div>`;
  }
  function listHTML() {
    const all = S.clientes.map(statsOf), cnt = { todos: all.length, aberto: all.filter(s => s.aberto > 0).length, sumido: all.filter(sumido).length, nunca: all.filter(s => s.dias == null).length };
    const chips = [['todos', 'Todos'], ['aberto', 'Com saldo em aberto'], ['sumido', 'Sem pedir há tempo'], ['nunca', 'Nunca pediu']].map(([k, n]) => `<button type="button" class="chip2 ${ST.f === k ? 'on' : ''}" data-clf="${k}">${n} <small>${cnt[k]}</small></button>`).join('');
    const L = rows();
    return `<div class="cllist"><div class="row nowrap"><input id="clQ" type="search" placeholder="Buscar cliente, cidade, telefone…" value="${esc(ST.q)}" aria-label="Buscar cliente"><button type="button" class="primary" data-cla="novo">+ Novo</button></div>
      <div class="row nowrap" style="margin:8px 0;gap:6px"><select id="clF" aria-label="Filtro" style="flex:1;min-width:0">${[['todos', 'Todos'], ['aberto', 'Com saldo em aberto'], ['sumido', 'Sem pedir há tempo'], ['nunca', 'Nunca pediu']].map(([k, n]) => `<option value="${k}" ${ST.f === k ? 'selected' : ''}>${n} (${cnt[k]})</option>`).join('')}</select><button type="button" class="chip2 ${ST.ord === 'az' ? 'on' : ''}" data-clo="az">A–Z</button><button type="button" class="chip2 ${ST.ord === 'rec' ? 'on' : ''}" data-clo="rec">Recentes</button></div>
      ${letrasHTML()}
      <div class="clcount muted">${L.length} cliente(s)${ST.letra ? ` na letra ${ST.letra}` : ''}</div>
      <div class="clitems">${L.map(({ c, i, st }) => `<button type="button" class="cli ${i === ST.sel ? 'on' : ''}" data-clsel="${i}" title="${esc(ultTxt(st))}${st.L.length ? ' · ' + st.L.length + ' pedido(s)' : ''}"><span class="cn">${esc(c.nome)}</span>${st.atras ? `<b class="cb bad">atrasado</b>` : st.aberto > 0 ? `<b class="cb warn">${brl(st.aberto)}</b>` : sumido(st) ? '<b class="cb mute">sumiu?</b>' : ''}</button>`).join('') || '<p class="note">Nenhum cliente encontrado.</p>'}</div>
      <div class="row" style="margin-top:10px"><button type="button" data-cla="imp">⬆ Importar planilha</button><button type="button" data-cla="modelo">⬇ Modelo (.csv)</button></div></div>`;
  }

  /* ---------- ficha ---------- */
  function fichaHTML() {
    const c = S.clientes[ST.sel]; if (!c) return `<div class="clficha empty"><p class="note">Escolha um cliente na lista para ver a ficha${S.clientes.length ? '' : ' — ou importe sua planilha de clientes'}.</p></div>`;
    const st = statsOf(c), hoje = F.todayISO();
    const exps = PP.exp && PP.exp.hist ? PP.exp.hist().filter(e => casa(e.cons && e.cons.name, c.nome)).sort((a, b) => (b.dateISO || '').localeCompare(a.dateISO || '')) : [];
    const D = store.get('fretes', { cfg: { taxa: 90 }, rec: {} }) || { cfg: { taxa: 90 }, rec: {} }, FC = PP.frete && PP.frete.FC, fr = [];
    (S.embarques || []).forEach(e => (e.linhas || []).forEach(l => { if (!casa(l.cliente, c.nome)) return; const r = D.rec[e.id + '|' + l.id] || {}, t = FC ? FC.totalOf(r, D.cfg) : 0; fr.push({ e, l, r, t }); }));
    fr.sort((a, b) => b.e.saida.localeCompare(a.e.saida));
    const alerta = sumido(st) ? `<div class="alert w">Faz <b>${st.dias} dias</b> que ${esc(c.nome)} não pede${st.freq ? ` (costuma pedir a cada ~${st.freq} dias)` : ''}. Vale um contato.</div>` : '';
    const kp = [['Último pedido', st.last ? dBR(st.last.dataISO) : '—', st.dias == null ? 'nunca pediu' : st.dias === 0 ? 'hoje' : `há ${st.dias} dia(s)`], ['Pedidos', st.L.length, st.freq ? `a cada ~${st.freq} dias` : ' '], ['Total comprado', brl(st.total), st.L.length ? `ticket médio ${brl(st.ticket)}` : ' '], ['Em aberto', brl(st.aberto), st.atras ? `${st.atras} atrasado(s)` : (st.aberto > 0 ? 'dentro do prazo' : 'tudo pago')]];
    const ped = (ST.all ? st.L : st.L.slice(0, 8)).map(e => { const s = F.situacao(e, hoje, S.cfg.prazoPag || 7); return `<tr><td>${dBR(e.dataISO)}</td><td>${esc(e.inv ? 'Inv. ' + e.inv : '')}${e.nf ? ' · NF ' + esc(e.nf) : ''}</td><td class="r">${e.totais.caixas}</td><td class="r">${fmt(e.totais.peixes).replace(/,00$/, '')}</td><td class="r">${brl(F.devido(e))}</td><td><span class="badge ${s.kind}">${esc(s.label)}</span></td><td class="r"><button type="button" class="sm" data-clopen="${esc(e.id)}">Abrir</button></td></tr>`; }).join('');
    const inp = (k, label, extra) => `<div class="field ${extra || ''}"><label for="cf_${k}">${label}</label><input id="cf_${k}" data-cf="${k}" value="${esc(c[k] == null ? '' : c[k])}" autocomplete="off"></div>`;
    return `<div class="clficha">
      <div class="clhead"><button type="button" class="clback" data-cla="voltar" aria-label="Voltar à lista">‹ Clientes</button><div class="grow"><h2 class="cltitle">${esc(c.nome)}</h2><span class="muted">${esc([c.cidade, c.aero, c.tel, c.email].filter(Boolean).join(' · ') || 'Sem contato cadastrado')}</span></div>
        <div class="row"><button type="button" class="primary" data-cla="pedido">+ Novo pedido</button><button type="button" data-cla="edit">✎ Dados</button></div></div>
      ${alerta}${st.credito > 0 ? `<div class="alert ok">Crédito guardado: <b>${brl(st.credito)}</b> (mortalidade de pedidos anteriores).</div>` : ''}
      <div class="cltabs" role="tablist">${[['resumo', 'Resumo'], ['pedidos', 'Pedidos'], ['dados', 'Dados · CNPJ / IE'], ['precos', 'Preços e observações']].map(([k, n]) => `<button type="button" role="tab" aria-selected="${ST.tab === k}" class="${ST.tab === k ? 'on' : ''}" data-cla="tab" data-k="${k}">${n}</button>`).join('')}</div>
      ${ST.tab === 'resumo' ? `<div class="clkp">${kp.map(([a, b, d]) => `<div class="clk"><span>${a}</span><b>${b}</b><small>${esc(String(d))}</small></div>`).join('')}</div>
        ${c.obs ? `<p class="note"><b>Obs.:</b> ${esc(c.obs)}</p>` : ''}
        ${st.top.length ? `<section class="step"><h2>O que mais pede</h2><div class="cltop">${st.top.map(t => `<div><b>${esc(t.nome)}</b><span class="muted">${fmt(t.peixes).replace(/,00$/, '')} peixes · ${t.pedidos} pedido(s)</span></div>`).join('')}</div></section>` : '<p class="note">Quando este cliente tiver pedidos, aparecem aqui os peixes que ele mais pede.</p>'}` : ''}
      ${ST.tab === 'pedidos' ? `<section class="step"><h2>Pedidos anteriores · nacional</h2>${st.L.length ? `<div class="tablewrap"><table class="clt"><thead><tr><th>Data</th><th>Documento</th><th class="r">Caixas</th><th class="r">Peixes</th><th class="r">Valor</th><th>Situação</th><th></th></tr></thead><tbody>${ped}</tbody></table></div>${st.L.length > 8 ? `<button type="button" class="sm" data-cla="all">${ST.all ? 'Mostrar só os 8 últimos' : `Ver todos (${st.L.length})`}</button>` : ''}` : '<p class="note">Nenhum pedido nacional deste cliente no histórico ainda.</p>'}</section>
        ${exps.length ? `<section class="step"><h2>Exportações</h2><div class="tablewrap"><table class="clt"><thead><tr><th>Nº</th><th>Data</th><th>Destino</th><th class="r">Total</th></tr></thead><tbody>${exps.slice(0, 8).map(e => `<tr><td>${String(e.n).padStart(3, '0')}/${e.ano}</td><td>${e.dateISO ? dBR(e.dateISO) : '<span class="muted">sem data</span>'}</td><td>${esc(PP.exp.destLabel(e.dest) || e.dest)}</td><td class="r">US$ ${fmt((e.tot && e.tot.total) || 0)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
        ${fr.length ? `<section class="step"><h2>Fretes</h2><div class="tablewrap"><table class="clt"><thead><tr><th>Programação</th><th class="r">Frete</th><th>Situação</th></tr></thead><tbody>${fr.slice(0, 8).map(x => `<tr><td>${dBR(x.e.saida)}</td><td class="r">${x.t > 0 ? brl(x.t) : '—'}</td><td>${x.r.pago ? '<span class="badge ok">Pago</span>' : x.t > 0 ? '<span class="badge warn">Em aberto</span>' : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div></section>` : ''}` : ''}
      ${ST.tab === 'dados' ? dadosHTML(c, inp) : ''}
      ${ST.tab === 'precos' ? `<section class="step"><h2>Preços e observações</h2><div class="row">${inp('desc', 'Desconto padrão (%)')}</div>
        <div class="field"><label for="cf_precos">Preços especiais (um por linha, como no pedido nacional: ESPÉCIE = 0,35)</label><textarea id="cf_precos" data-cf="precos" rows="4">${esc(c.precos || '')}</textarea></div>
        <div class="field"><label for="cf_obs">Observações</label><textarea id="cf_obs" data-cf="obs" rows="3">${esc(c.obs || '')}</textarea></div></section>` : ''}
    </div>`;
  }

  /* ---------- Dados · CNPJ / IE (com busca na internet) ---------- */
  const soNum = s => String(s || '').replace(/\D/g, '');
  const fmtCnpj = d => d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : d;
  function cnpjOk(d) { // dígitos verificadores
    if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
    const calc = n => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += +d[i] * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === +d[12] && calc(13) === +d[13];
  }
  const cnpjNota = d => !d ? 'Digite o CNPJ e clique em buscar: o app preenche razão social, endereço, CEP, cidade e, quando a base pública tiver, a inscrição estadual.' : d.length === 14 ? (cnpjOk(d) ? 'CNPJ válido ✓ — clique em buscar para preencher os dados.' : '⚠ Este CNPJ não passa na conferência dos dígitos. Confira se digitou certo.') : d.length === 11 ? 'CPF: a busca automática só funciona para CNPJ. Preencha os dados à mão.' : 'Digite os 14 números do CNPJ.';
  function dadosHTML(c, inp) {
    const d = soNum(c.doc), eCnpj = d.length === 14, valido = eCnpj && cnpjOk(d);
    const lk = ST.cnpjMsg ? `<div class="alert ${/^✓/.test(ST.cnpjMsg) ? 'ok' : 'w'}" role="status">${esc(ST.cnpjMsg)}</div>` : '';
    return `<section class="step"><h2>Dados do cliente</h2>
      <div class="row">${inp('nome', 'Nome (como aparece nos pedidos)', 'grow')}${inp('cidade', 'Cidade / UF')}${inp('aero', 'Aeroporto')}</div>
      <div class="block cnpjbox"><div class="row" style="align-items:flex-end;gap:10px">${inp('doc', 'CNPJ / CPF', 'grow')}${inp('ie', 'Inscrição estadual (IE)', '')}<button type="button" class="primary" data-cla="cnpj" ${ST.cnpjBusy ? 'disabled' : ''}>${ST.cnpjBusy ? 'Buscando…' : 'Buscar CNPJ e IE na internet'}</button></div>
        <p class="note" id="cnpjNote" style="margin:6px 0 0">${cnpjNota(d)}</p>${lk}
        ${c.endReceita && (up(c.end) !== c.endReceita || (c.cidReceita && up(c.cidade) !== up(c.cidReceita))) ? `<p class="note" style="margin:6px 0 0">Endereço na Receita: <b>${esc(c.endReceita)}${c.cidReceita ? ' · ' + esc(c.cidReceita) : ''}</b> <button type="button" class="sm" data-cla="usaend">Usar este endereço</button></p>` : ''}
        ${c.consultaEm ? `<p class="note" style="margin:6px 0 0">Última busca: ${dBR(c.consultaEm)}${c.sitcad ? ` · situação na Receita: <b>${esc(c.sitcad)}</b>` : ''}</p>` : ''}</div>
      <div class="row">${inp('razao', 'Razão social', 'grow')}${inp('fantasia', 'Nome fantasia', 'grow')}</div>
      <div class="row">${inp('end', 'Endereço', 'grow')}${inp('cep', 'CEP')}</div>
      <div class="row">${inp('tel', 'Telefone')}${inp('email', 'E-mail', 'grow')}</div>
      <div class="row"><button type="button" class="danger" data-cla="del">Remover cliente</button><span class="note">Os pedidos dele continuam no histórico.</span></div></section>`;
  }
  /* consulta: publica.cnpj.ws (tem inscrição estadual) e, se falhar, BrasilAPI. Os dois são gratuitos e sem chave. */
  async function consultaCnpj(d) {
    const get = async (u) => { const r = await fetch(u, { headers: { Accept: 'application/json' } }); if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } return r.json(); };
    let o = null, erro = null;
    try {
      const j = await get('https://publica.cnpj.ws/cnpj/' + d), e = j.estabelecimento || {};
      const ies = (e.inscricoes_estaduais || []).filter(x => x && x.inscricao_estadual);
      o = { razao: j.razao_social || '', fantasia: e.nome_fantasia || '', sit: e.situacao_cadastral || '', logr: [e.tipo_logradouro, e.logradouro].filter(Boolean).join(' '), num: e.numero || '', comp: e.complemento || '', bairro: e.bairro || '', cep: e.cep || '', cid: (e.cidade && e.cidade.nome) || '', uf: (e.estado && e.estado.sigla) || '', tel: (e.ddd1 && e.telefone1) ? `(${e.ddd1}) ${e.telefone1}` : '', email: e.email || '', ies: ies.map(x => ({ n: String(x.inscricao_estadual), uf: (x.estado && x.estado.sigla) || '', ativo: x.ativo !== false })) };
    } catch (e1) { erro = e1; }
    if (!o) {
      try {
        const j = await get('https://brasilapi.com.br/api/cnpj/v1/' + d);
        o = { razao: j.razao_social || '', fantasia: j.nome_fantasia || '', sit: j.descricao_situacao_cadastral || '', logr: j.logradouro || '', num: j.numero || '', comp: j.complemento || '', bairro: j.bairro || '', cep: j.cep || '', cid: j.municipio || '', uf: j.uf || '', tel: j.ddd_telefone_1 || '', email: j.email || '', ies: [] };
      } catch (e2) { const er = erro || e2; throw er; }
    }
    return o;
  }
  async function buscarCnpj() {
    const c = S.clientes[ST.sel]; if (!c) return; const d = soNum(c.doc);
    if (d.length !== 14) { ST.cnpjMsg = 'Digite os 14 números do CNPJ.'; render(); return; }
    ST.cnpjBusy = true; ST.cnpjMsg = ''; render();
    try {
      const o = await consultaCnpj(d);
      const set = (k, v) => { if (v) c[k] = v; };
      c.doc = fmtCnpj(d); set('razao', o.razao); set('fantasia', o.fantasia);
      const end = [o.logr, o.num && o.num !== 'S/N' ? o.num : 'S/N', o.comp, o.bairro].filter(Boolean).join(', ');
      const cidRec = o.cid ? o.cid + (o.uf ? ' - ' + o.uf : '') : '', endRec = up(end);
      c.endReceita = endRec; c.cidReceita = cidRec; if (o.cep) c.cep = String(o.cep).replace(/^(\d{5})(\d{3})$/, '$1-$2');
      let manteve = false;
      if (endRec) { if (!c.end) c.end = endRec; else if (up(c.end) !== endRec) manteve = true; }
      if (cidRec) { if (!c.cidade) c.cidade = cidRec; else if (up(c.cidade) !== up(cidRec)) manteve = true; }
      if (o.tel && !c.tel) c.tel = o.tel; if (o.email && !c.email) c.email = String(o.email).toLowerCase();
      const ie = o.ies.find(x => x.ativo && (!o.uf || x.uf === o.uf)) || o.ies.find(x => x.ativo) || o.ies[0];
      if (ie) c.ie = ie.n;
      c.sitcad = o.sit || ''; c.consultaEm = F.todayISO();
      ST.cnpjMsg = '✓ Dados preenchidos' + (manteve ? ' (o endereço/cidade que você já tinha foram mantidos; veja abaixo o endereço da Receita e use se quiser)' : '') + (ie ? ` (IE ${ie.n}${ie.uf ? '/' + ie.uf : ''}).` : '. A base pública não trouxe a inscrição estadual deste CNPJ: digite a IE à mão (ou deixe em branco se for isento).') + ' Confira antes de usar.';
      PP.saveClientes(); PP.invalidate(); PP.renderClientes();
    } catch (e) {
      ST.cnpjMsg = e && e.status === 429 ? 'Muitas consultas seguidas (o serviço gratuito limita a poucas por minuto). Espere 1 minuto e tente de novo.' : e && e.status === 404 ? 'CNPJ não encontrado na base pública. Confira os números.' : 'Não consegui consultar agora (sem internet ou serviço fora do ar). Preencha à mão ou tente de novo mais tarde.';
    }
    ST.cnpjBusy = false; render();
  }

  /* ---------- importação de planilha ---------- */
  function parseCSV(txt) {
    txt = txt.replace(/^﻿/, ''); const first = txt.split(/\r?\n/)[0] || '', d = [';', '\t', ','].map(x => [x, first.split(x).length]).sort((a, b) => b[1] - a[1])[0][0];
    const out = []; let row = [], cur = '', q = false;
    for (let i = 0; i < txt.length; i++) { const ch = txt[i]; if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === d) { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim())) out.push(row); row = []; } else cur += ch; }
    row.push(cur); if (row.some(x => x.trim())) out.push(row); return out;
  }
  async function readFile(file) {
    if (/\.xlsx$/i.test(file.name)) {
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer()); const ws = wb.worksheets[0]; if (!ws) return [];
      const out = []; ws.eachRow({ includeEmpty: false }, row => { const r = []; for (let i = 1; i <= ws.columnCount; i++) { const cell = row.getCell(i); r.push(cell && cell.text != null ? String(cell.text).trim() : ''); } if (r.some(Boolean)) out.push(r); }); return out;
    }
    return parseCSV(await file.text());
  }
  function guess(head) { const m = {}; FIELDS.forEach(([k, , syn]) => { let best = -1; head.forEach((h, i) => { const n = norm(h); if (!n || Object.values(m).includes(i)) return; if (syn.some(s => n === s) || syn.some(s => n.includes(s))) { if (best < 0) best = i; } }); m[k] = best; }); return m; }
  function impCalc() {
    const I = ST.imp, items = [], seen = new Set(); let novos = 0, exist = 0, vazios = 0;
    I.rows.slice(1).forEach(r => { const g = k => (I.map[k] >= 0 ? String(r[I.map[k]] || '').trim() : ''), nome = up(g('nome')); if (!nome) { vazios++; return; } if (seen.has(nome)) return; seen.add(nome); const o = { nome }; FIELDS.forEach(([k]) => { if (k !== 'nome') { const v = g(k); if (v) o[k] = k === 'desc' ? Math.min(99, parseFloat(String(v).replace(',', '.')) || 0) || '' : (k === 'end' || k === 'aero' ? up(v) : v); } }); const j = S.clientes.findIndex(c => up(c.nome) === nome); items.push({ o, j }); if (j >= 0) exist++; else novos++; });
    return { items, novos, exist, vazios };
  }
  function impHTML() {
    const I = ST.imp; if (!I) return ''; const head = I.rows[0] || [], cal = impCalc();
    return `<div class="clmodal" id="clImp"><div class="clback2" data-cla="impx"></div><div class="clbox" role="dialog" aria-label="Importar clientes"><h3>Importar clientes</h3><p class="note">Arquivo: <b>${esc(I.name)}</b> · ${I.rows.length - 1} linha(s). Confira qual coluna é cada informação:</p>
      <div class="clmap">${FIELDS.map(([k, n]) => `<label>${n}${k === 'nome' ? ' *' : ''}<select data-clmap="${k}"><option value="-1">— não importar —</option>${head.map((h, i) => `<option value="${i}" ${I.map[k] === i ? 'selected' : ''}>${esc(h || 'Coluna ' + (i + 1))}</option>`).join('')}</select></label>`).join('')}</div>
      <div class="alert ${cal.items.length ? 'ok' : 'w'}" style="margin-top:10px"><b>${cal.novos}</b> novo(s) · <b>${cal.exist}</b> já cadastrado(s) (mesmo nome)${cal.vazios ? ` · ${cal.vazios} linha(s) sem nome ignorada(s)` : ''}</div>
      <div class="field"><label for="clMode">Quando o cliente já existe</label><select id="clMode"><option value="vazios">Completar só os campos que estão vazios (recomendado)</option><option value="pular">Não mexer nos já cadastrados</option><option value="sobrescrever">Substituir pelos dados da planilha</option></select></div>
      ${cal.items.length ? `<div class="tablewrap" style="max-height:170px"><table class="clt"><thead><tr><th>Nome</th><th>Cidade</th><th>Telefone</th><th></th></tr></thead><tbody>${cal.items.slice(0, 6).map(x => `<tr><td>${esc(x.o.nome)}</td><td>${esc(x.o.cidade || '')}</td><td>${esc(x.o.tel || '')}</td><td>${x.j >= 0 ? '<span class="badge warn">já existe</span>' : '<span class="badge ok">novo</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <div class="row kbact"><button type="button" class="primary" data-cla="impgo" ${cal.items.length ? '' : 'disabled'}>Importar</button><button type="button" data-cla="impx">Cancelar</button></div></div></div>`;
  }
  function impRun() {
    const mode = ($('clMode') || {}).value || 'vazios', cal = impCalc(); let add = 0, upd = 0;
    cal.items.forEach(({ o, j }) => {
      if (j < 0) { S.clientes.push(o); add++; return; }
      if (mode === 'pular') return; const c = S.clientes[j]; let ch = false;
      Object.entries(o).forEach(([k, v]) => { if (k === 'nome') return; if (mode === 'sobrescrever' || c[k] == null || c[k] === '') { if (c[k] !== v) { c[k] = v; ch = true; } } }); if (ch) upd++;
    });
    PP.saveClientes(); PP.invalidate(); PP.renderClientes(); ST.imp = null; render(); PP.toast(`Clientes importados: ${add} novo(s), ${upd} atualizado(s).`, 'ok');
  }
  function modelo() { const csv = '﻿Nome;Endereço;Cidade;Aeroporto;Telefone;E-mail;CNPJ/CPF;Desconto %;Observações\r\nEXEMPLO AQUARISMO LTDA;RUA A, 100;Manaus/AM;;(92) 99999-0000;contato@exemplo.com;00.000.000/0001-00;5;Cliente de exemplo\r\n'; PP.saveBlob('modelo-clientes.csv', new Blob([csv], { type: 'text/csv;charset=utf-8' })); }

  /* ---------- tela ---------- */
  function render() {
    const el = $('vClientes'); if (!el) return;
    el.innerHTML = `<div class="clgrid ${ST.sel >= 0 ? 'ficha' : ''}">${listHTML()}${fichaHTML()}</div>${impHTML()}`;
  }
  function open(i) { ST.sel = i; ST.tab = 'resumo'; ST.edit = false; ST.all = false; PP.go('clientes'); }
  document.addEventListener('click', e => {
    const T = e.target, v = $('vClientes'); if (!v || !v.contains(T)) return; let b;
    if ((b = T.closest('[data-clsel]'))) { ST.sel = +b.dataset.clsel; ST.tab = 'resumo'; ST.cnpjMsg = ''; ST.edit = false; ST.all = false; render(); window.scrollTo(0, 0); return; }
    if ((b = T.closest('[data-cll]'))) { ST.letra = b.dataset.cll; render(); return; }
    if ((b = T.closest('[data-clf]'))) { ST.f = b.dataset.clf; render(); return; }
    if ((b = T.closest('[data-clo]'))) { ST.ord = b.dataset.clo; render(); return; }
    if ((b = T.closest('[data-clopen]'))) { PP.loadEntry(b.dataset.clopen, 'edit'); return; }
    if (!(b = T.closest('[data-cla]'))) return; const a = b.dataset.cla, c = S.clientes[ST.sel];
    if (a === 'voltar') { ST.sel = -1; render(); }
    else if (a === 'novo') { S.clientes.push({ nome: 'NOVO CLIENTE', end: '' }); ST.sel = S.clientes.length - 1; ST.tab = 'dados'; PP.saveClientes(); PP.renderClientes(); PP.invalidate(); render(); const i = $('cf_nome'); if (i) { i.focus(); i.select(); } }
    else if (a === 'edit') { ST.tab = 'dados'; render(); }
    else if (a === 'tab') { ST.tab = b.dataset.k; ST.cnpjMsg = ''; render(); }
    else if (a === 'cnpj') buscarCnpj();
    else if (a === 'usaend' && c) { if (c.endReceita) c.end = c.endReceita; if (c.cidReceita) c.cidade = c.cidReceita; PP.saveClientes(); PP.invalidate(); PP.renderClientes(); render(); }
    else if (a === 'all') { ST.all = !ST.all; render(); }
    else if (a === 'pedido' && c) { S.cli = ST.sel; PP.invalidate(); PP.renderClientes(); PP.go('pedido'); PP.renderAll(); }
    else if (a === 'del' && c) { if (!confirm('Remover este cliente? Os pedidos dele continuam no histórico.')) return; S.clientes.splice(ST.sel, 1); S.cli = 0; ST.sel = -1; PP.saveClientes(); PP.invalidate(); PP.renderClientes(); render(); }
    else if (a === 'imp') { const f = document.createElement('input'); f.type = 'file'; f.accept = '.xlsx,.csv,.txt'; f.onchange = async () => { const file = f.files[0]; if (!file) return; try { const rows = await readFile(file); if (rows.length < 2) { PP.toast('Não encontrei linhas de clientes nesse arquivo.', 'bad'); return; } ST.imp = { name: file.name, rows, map: guess(rows[0]) }; render(); } catch (err) { PP.toast('Não consegui ler o arquivo: ' + err.message, 'bad'); } }; f.click(); }
    else if (a === 'impx') { ST.imp = null; render(); }
    else if (a === 'impgo') impRun();
    else if (a === 'modelo') modelo();
  });
  document.addEventListener('input', e => {
    const t = e.target; if (t.id === 'clQ') { ST.q = t.value; if (t.value) ST.letra = ''; const pos = t.value.length; render(); const i = $('clQ'); i.focus(); i.setSelectionRange(pos, pos); return; }
    if (!t.dataset || !t.dataset.cf || !$('vClientes').contains(t)) return; const c = S.clientes[ST.sel]; if (!c) return; const k = t.dataset.cf; let val = t.value;
    if (k === 'nome' || k === 'end' || k === 'aero') val = val.toUpperCase(); if (k === 'desc') val = Math.min(99, Math.max(0, parseFloat(String(val).replace(',', '.')) || 0)) || '';
    c[k] = val; ST._oldNome = ST._oldNome || null; PP.saveClientes(); PP.invalidate();
    if (k === 'nome') { const h = document.querySelector('#vClientes .cltitle'); if (h) h.textContent = val; }
  });
  document.addEventListener('focusin', e => { const t = e.target; if (t.dataset && t.dataset.cf === 'nome') ST._nomeAntes = t.value; });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'clF') { ST.f = t.value; render(); return; }
    if (t.dataset && t.dataset.clmap) { ST.imp.map[t.dataset.clmap] = +t.value; render(); return; }
    if (t.dataset && t.dataset.cf === 'nome') {
      const antes = ST._nomeAntes, c = S.clientes[ST.sel]; if (!c || !antes || up(antes) === up(c.nome)) { PP.renderClientes(); render(); return; }
      const n = S.hist.filter(x => up(x.cliente.nome) === up(antes)).length;
      if (n && confirm(`Atualizar também o nome nos ${n} pedido(s) do histórico de "${antes}"? Assim eles continuam ligados a este cliente.`)) { S.hist.forEach(x => { if (up(x.cliente.nome) === up(antes)) x.cliente.nome = c.nome; }); PP.saveHist(); }
      PP.renderClientes(); render();
    } else if (t.dataset && t.dataset.cf) { PP.renderClientes(); if (t.dataset.cf === 'doc') { const cc = S.clientes[ST.sel], d = soNum(t.value); if (cc && d.length === 14) { cc.doc = fmtCnpj(d); t.value = cc.doc; PP.saveClientes(); } const n = $('cnpjNote'); if (n) n.textContent = cnpjNota(d); } }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ST.imp) { ST.imp = null; render(); } });

  PP.clientes = { render, open, statsOf, histOf, parseCSV, guess, ST };
})();
