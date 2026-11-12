/* Prestige Pedidos — telas extras: histórico e pós-venda, painel, romaneio/relatórios, estoque e reposição, nuvem. */
(function () {
  'use strict';
  const PP = window.PP; if (!PP) return;
  const { S, store, Core, Features: F, $, fmt, fmtInt, esc, saveBlob } = PP;
  const dBR = iso => (iso ? iso.split('-').reverse().join('/') : '');
  const chip = (kind, t) => `<span class="chip ${kind}">${esc(t)}</span>`;
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const prazo = () => S.cfg.prazoPag || 7;
  const msg = (id, t) => { const el = $(id); if (el) el.textContent = t; };
  const ST = {
    hist: { q: '', st: '', open: null, mort: {}, av: {} },
    painel: { r: '30' }, relat: { dia: F.todayISO(), de: F.addDays(F.todayISO(), -29), ate: F.todayISO() },
    estoque: { dias: 30, meta: 2, so: 'vendidos' },
  };

  /* ====================== HISTÓRICO E PÓS-VENDA ====================== */
  /* mortalidade pendente: pedidos de embarques que saíram há 1 a 14 dias e ainda sem "teve / não teve" */
  function mortPend() {
    const hoje = F.todayISO(), out = [];
    (S.embarques || []).filter(em => em.saida <= F.addDays(hoje, -1) && em.saida >= F.addDays(hoje, -14)).sort((a, b) => b.saida.localeCompare(a.saida)).forEach(em => {
      const its = (em.linhas || []).map(l => S.hist.find(h => h.id === l.pedidoId)).filter(h => h && F.active(h) && !h.mort && !h.mortOk);
      if (its.length) out.push({ em, its });
    });
    return out;
  }
  function renderHist() {
    const h = ST.hist, hoje = F.todayISO();
    const all = S.hist.slice().sort((a, b) => b.ts - a.ts);
    const q = h.q.trim().toLowerCase();
    const list = all.filter(e => (!q || (e.cliente.nome + ' ' + e.inv + ' ' + e.nf).toLowerCase().includes(q)) && (!h.st || F.situacao(e, hoje, prazo()).key === h.st));
    const rec = F.r2(all.reduce((s, e) => s + F.situacao(e, hoje, prazo()).saldo, 0)), atr = all.filter(e => F.situacao(e, hoje, prazo()).key === 'atrasado');
    const tipo = h.tipo || 'todos', chipsT = `<div class="row noprint" style="align-items:center"><div class="chips">${[['todos', 'Todos'], ['nac', 'Nacionais'], ['exp', 'Exportações ']].map(([k, n]) => `<button type="button" class="xchip" data-htipo="${k}" aria-pressed="${tipo === k}">${n}</button>`).join('')}</div></div>`;
    /* v26: conferência Programação × Histórico */
    const linhasProg = []; (S.embarques || []).forEach(em => (em.linhas || []).forEach(l => { if (l.status !== 'cancelado') linhasProg.push({ em, l }); }));
    const faltam = linhasProg.filter(({ l }) => !(l.pedidoId && S.hist.some(x => x.id === l.pedidoId))).sort((a, b) => String(b.em.saida).localeCompare(String(a.em.saida)));
    const mp = mortPend();
    const mortHTML = mp.length ? `<section class="step hmort" id="hMort"><div class="row between"><div><h2 style="margin:0">Mortalidade das programações recentes</h2><p class="note" style="margin:2px 0 0">Algum cliente teve peixe morto na chegada? Clique no cliente, digite quantos morreram e o app já desconta na nota do pedido. Se não teve, marque "sem mortalidade".</p></div></div>
      ${mp.map(({ em, its }) => `<div class="row" style="align-items:center;gap:8px;margin:8px 0"><b style="min-width:130px">Programação ${dBR(em.saida)}</b>${its.map(h => `<button type="button" class="mortbtn" data-h="mortgo" data-id="${h.id}">${esc(h.cliente.nome)}</button>`).join('')}<span style="flex:1"></span><button type="button" data-h="mortok" data-eid="${em.id}">Nenhum teve mortalidade</button></div>`).join('')}</section>` : '';
    const confHTML = linhasProg.length ? `<section class="step hconf" id="hConf"><div class="row between"><div><h2 style="margin:0">Conferência: Programação × Histórico</h2><p class="note" style="margin:2px 0 0">Cada venda da Programação de voos precisa ter um pedido no histórico. O que falta aparece aqui.</p></div><button type="button" data-hc="prog">Abrir Programação</button></div>
      <div class="kpis"><div><b>${linhasProg.length}</b><span>vendas na programação</span></div><div><b style="color:var(--ok,#4cc58a)">${linhasProg.length - faltam.length}</b><span>com pedido no histórico</span></div><div><b style="color:${faltam.length ? 'var(--warn,#e8c15a)' : 'var(--ok,#4cc58a)'}">${faltam.length}</b><span>sem pedido no histórico</span></div></div>
      ${faltam.length ? `<div class="tablewrap"><table><thead><tr><th>Embarque</th><th>Cliente</th><th class="n">Caixas</th><th>Situação</th><th></th></tr></thead><tbody>${faltam.map(({ em, l }) => { const u = [...S.hist].filter(x => F.active(x) && PP.up(x.cliente.nome) === PP.up(l.cliente)).sort((a, b) => b.ts - a.ts)[0]; return `<tr><td>${dBR(em.saida)}</td><td><b>${esc(l.cliente || '(sem nome)')}</b></td><td class="n">${l.caixas || 0}</td><td><span class="chip warn">sem pedido</span></td><td style="white-space:nowrap"><button type="button" class="primary" data-hc="novo" data-eid="${em.id}" data-lid="${l.id}">Criar pedido</button> ${u ? `<button type="button" data-hc="copia" data-eid="${em.id}" data-lid="${l.id}" title="Começa com os mesmos peixes e preços do último pedido dele">Copiar último pedido</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="note" style="color:var(--ok,#4cc58a)">Tudo certo: todas as vendas da programação têm pedido no histórico. ✓</p>'}</section>` : '';
    let html = `<section class="step"><div class="row between"><h2>Histórico de pedidos</h2><span class="row"><span class="muted">${all.length} pedido(s) salvo(s)</span><button type="button" data-pn="toggle">${PP.pn && PP.pn.isOpen() ? '✕ Fechar' : '＋ Adicionar pedido'}</button></span></div>${PP.pn ? PP.pn.formHTML() : ''}
      <div class="kpis"><div><b>R$ ${fmt(rec)}</b><span>a receber</span></div><div><b>${atr.length}</b><span>atrasado(s)</span></div><div><b>R$ ${fmt(F.r2(atr.reduce((s, e) => s + F.situacao(e, hoje, prazo()).saldo, 0)))}</b><span>valor atrasado</span></div></div>
      <div class="row"><div class="field grow"><label for="hq">Buscar (cliente, invoice ou NF)</label><input id="hq" value="${esc(h.q)}"></div>
      <div class="field" style="flex:0 1 220px"><label for="hst">Situação</label><select id="hst"><option value="">Todas</option>${['aguardando', 'atrasado', 'pago', 'embarcado', 'entregue', 'cancelado'].map(k => `<option value="${k}" ${h.st === k ? 'selected' : ''}>${k === 'atrasado' ? 'Atrasado' : F.STATUS[k]}</option>`).join('')}</select></div></div>
      ${list.length ? `<div class="tablewrap"><table id="histTb"><thead><tr><th>Data</th><th>Cliente</th><th>Invoice</th><th>NF</th><th class="n">Caixas</th><th class="n">Peixes</th><th class="n">Total R$</th><th>Situação</th><th></th></tr></thead><tbody>
      ${list.map(e => { const s = F.situacao(e, hoje, prazo()); return `<tr class="${h.open === e.id ? 'sel' : ''}"><td>${dBR(e.dataISO)}</td><td>${esc(e.cliente.nome)}</td><td>${esc(e.inv)}</td><td>${esc(e.nf || '—')}</td><td class="n">${e.totais.caixas}</td><td class="n">${fmtInt(e.totais.peixes)}</td><td class="n">${fmt(F.devido(e))}</td><td>${chip(s.kind, s.label)}${e.mort && e.mort.credito ? ' ' + chip('warn', 'mortalidade') : ''}</td>
        <td style="white-space:nowrap"><button type="button" data-h="open" data-id="${e.id}">Detalhes</button> <button type="button" data-h="edit" data-id="${e.id}">Editar</button> <button type="button" data-h="repeat" data-id="${e.id}">Repetir</button> <button type="button" class="mortbtn" data-h="mortgo" data-id="${e.id}" title="Registrar mortalidade e descontar na nota do pedido">Mortalidade</button></td></tr>`; }).join('')}</tbody></table></div>` : `<p class="empty">${all.length ? 'Nenhum pedido com esse filtro.' : 'Os pedidos aparecem aqui quando você baixa os documentos ou clica em "Salvar no histórico".'}</p>`}
      </section>`;
    const open = h.open && S.hist.find(e => e.id === h.open);
    if (open) html += detail(open, hoje);
    { const LX = store.get('histLixo', []);
      if (LX.length) html += `<section class="step" id="hLixo"><details ${ST.lixoOpen ? 'open' : ''}><summary><b>Pedidos apagados (${LX.length})</b> <span class="muted">· ficam guardados neste aparelho para restaurar</span></summary>
        <div class="tablewrap" style="margin-top:10px"><table><thead><tr><th>Cliente</th><th>Invoice</th><th>Data do pedido</th><th class="n">Caixas</th><th class="n">Total</th><th>Saiu em</th><th>Motivo</th><th></th></tr></thead><tbody>${LX.map((x, i) => `<tr><td><b>${esc((x.e.cliente || {}).nome || '—')}</b></td><td>${esc(x.e.inv || '—')}</td><td>${dBR(x.e.dataISO || '')}</td><td class="n">${(x.e.totais || {}).caixas || 0}</td><td class="n">R$ ${fmt((x.e.totais || {}).total || 0)}</td><td>${new Date(x.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td><td class="muted">${esc(x.motivo || '')}</td><td><button type="button" class="primary" data-lixo="${i}">Restaurar</button></td></tr>`).join('')}</tbody></table></div></details></section>`; }
    if (tipo === 'exp') html = ''; const xh = tipo !== 'nac' && PP.exp ? PP.exp.histHTML() : '';
    $('vHist').innerHTML = chipsT + (tipo === 'exp' ? '' : mortHTML + confHTML) + html + xh;
  }

  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-hc]'); if (!b || !$('vHist').contains(b)) return;
    if (b.dataset.hc === 'prog') { PP.go('embarque'); return; }
    const em = (S.embarques || []).find(z => z.id === b.dataset.eid), l = em && em.linhas.find(z => z.id === b.dataset.lid); if (!l) return;
    const u = b.dataset.hc === 'copia' ? [...S.hist].filter(x => F.active(x) && PP.up(x.cliente.nome) === PP.up(l.cliente)).sort((a, z) => z.ts - a.ts)[0] : null;
    PP.pn.prefill({ cli: l.cliente, data: em.saida, link: { eid: em.id, lid: l.id }, from: u });
  });
  document.addEventListener('click', ev => { const b = ev.target.closest('[data-htipo]'); if (b && $('vHist').contains(b)) { ST.hist.tipo = b.dataset.htipo; renderHist(); } });
  /* ---------- desconto para pagamento à vista (dado depois, no pedido já salvo) ---------- */
  const avPrevTxt = (e, pct) => {
    const v = F.valorAvista(e, pct), antes = F.r2(e.totais.total - (e.mort && e.mort.destino === 'abater' ? e.mort.credito || 0 : 0));
    return +pct > 0 ? `Desconto de ${String(+pct).replace('.', ',')}%: <b>− R$ ${fmt(v)}</b> · total a pagar: <b>R$ ${fmt(F.r2(antes - v))}</b>` : 'Escolha a % do desconto.';
  };
  function avistaBox(e) {
    const av = e.avista, pct = ST.hist.av[e.id] != null ? ST.hist.av[e.id] : (av ? av.pct : '');
    return `<div class="block" id="avBox" style="margin-top:14px"><h3>Desconto para pagamento à vista</h3>
      <p class="note">Para o cliente que decidiu pagar à vista depois do pedido. O desconto é sobre o valor dos peixes (R$ ${fmt(F.baseAvista(e))}), sem GTA, embalagem e atestado.</p>
      <div class="row" style="align-items:center"><button type="button" data-h="avchip" data-v="5">5%</button><button type="button" data-h="avchip" data-v="10">10%</button>
        <label style="color:var(--fg)">outro: <input id="avPct" type="number" min="0" max="100" step="0.5" value="${pct === '' ? '' : esc(String(pct))}" style="width:84px" aria-label="Desconto à vista em %"> %</label></div>
      <p id="avPrev" style="margin:8px 0">${avPrevTxt(e, pct)}</p>
      <div class="row"><button type="button" class="primary" data-h="avSave" data-id="${e.id}">Aplicar desconto</button>${av ? `<button type="button" data-h="avDel" data-id="${e.id}">Remover desconto</button>` : ''}<button type="button" data-h="avNota" data-id="${e.id}" ${av ? '' : 'disabled'}>Baixar nota do pedido com desconto (.xlsx)</button></div>
      <p class="note" id="avMsg" role="status">${av ? `Desconto aplicado: ${String(av.pct).replace('.', ',')}% = R$ ${fmt(av.valor)}. Total a pagar agora: R$ ${fmt(F.devido(e))}.` : ''}</p></div>`;
  }
  document.addEventListener('input', ev => { const t = ev.target; if (t.id !== 'avPct' || S.view !== 'hist') return; const e = S.hist.find(x => x.id === ST.hist.open); if (!e) return; ST.hist.av[e.id] = t.value; if ($('avPrev')) $('avPrev').innerHTML = avPrevTxt(e, t.value); });
  function detail(e, hoje) {
    const s = F.situacao(e, hoje, prazo()), mt = ST.hist.mort[e.id] || (ST.hist.mort[e.id] = (e.mort && e.mort.dead) || {}), calc = F.mortalidade(e, mt);
    const dest = (e.mort && e.mort.destino) || 'abater';
    return `<section class="step" id="hdet"><div class="row between"><h2>${esc(e.cliente.nome)} · invoice ${esc(e.inv)} · ${dBR(e.dataISO)}</h2><button type="button" data-h="close">Fechar</button></div>
      <div class="kpis"><div><b>${e.totais.caixas}</b><span>caixas</span></div><div><b>${fmtInt(e.totais.peixes)}</b><span>peixes</span></div><div><b>R$ ${fmt(F.devido(e))}</b><span>total a pagar</span></div><div><b>R$ ${fmt(s.saldo)}</b><span>saldo em aberto</span></div></div>
      <div class="split">
        <div><h3>Pagamento e situação</h3>
          <div class="row"><div class="field"><label for="pst">Situação</label><select id="pst" data-pay="status">${['aguardando', 'pago', 'embarcado', 'entregue', 'cancelado'].map(k => `<option value="${k}" ${e.pay.status === k ? 'selected' : ''}>${F.STATUS[k]}</option>`).join('')}</select></div>
          <div class="field"><label for="ppago">Valor recebido (R$)</label><input id="ppago" type="number" step="0.01" min="0" data-pay="pago" value="${e.pay.pago || ''}"></div>
          <div class="field"><label for="pdata">Data do pagamento</label><input id="pdata" type="date" data-pay="dataPago" value="${esc(e.pay.dataPago || '')}"></div></div>
          <div class="field"><label for="pobs">Observação</label><input id="pobs" data-pay="obs" value="${esc(e.pay.obs || '')}"></div>
          <p class="note">Situação agora: ${chip(s.kind, s.label)}. “Atrasado” aparece sozinho quando passam mais de ${prazo()} dias sem pagamento (mude em Configurações).</p>
          ${s.saldo > 0 ? `<div class="field"><label for="cobr">Mensagem de cobrança</label><textarea id="cobr" readonly style="min-height:110px">${esc(F.msgCobranca(e, S.cfg.empresa.nome))}</textarea></div>
          <div class="row"><button type="button" data-h="copycobr">Copiar mensagem</button><span class="note" id="cobrMsg"></span></div>` : ''}
          ${avistaBox(e)}
          <div class="row"><button type="button" class="danger" data-h="del" data-id="${e.id}">Excluir do histórico</button></div>
        </div>
        <div class="mortbox ${ST.hist.flash === e.id ? 'flash' : ''}" id="mortBox"><h3>Mortalidade na chegada</h3>
          <p class="note">Digite quantos peixes morreram na chegada. O app calcula o crédito pelo preço cobrado e mostra como fica a nota do pedido.</p>
          <div class="kpis"><div><b>R$ ${fmt(e.totais.total)}</b><span>total do pedido</span></div><div><b style="color:var(--bad,#ef6b6b)">− R$ ${fmt(calc.credito)}</b><span>mortalidade (${fmtInt(calc.mortos)} peixes)</span></div><div><b style="color:var(--ok,#4cc58a)">R$ ${fmt(F.r2(e.totais.total - (dest === 'abater' ? calc.credito : 0)))}</b><span>${dest === 'abater' ? 'fica na nota do pedido' : 'total (crédito vai para o próximo pedido)'}</span></div></div>
          <div class="tablewrap"><table><thead><tr><th>Espécie</th><th class="n">Enviados</th><th class="n">R$ unit.</th><th class="n">Mortos</th></tr></thead><tbody>
          ${e.lines.map((l, i) => `<tr><td>${esc(l.nome || l.comum)}</td><td class="n">${fmtInt(l.peixes)}</td><td class="n">${fmt(l.preco)}</td><td class="n"><input type="number" min="0" max="${l.peixes}" data-dead="${i}" value="${mt[i] || ''}" aria-label="Mortos ${esc(l.comum)}" style="width:84px"></td></tr>`).join('')}</tbody></table></div>
          <p><b>Crédito: R$ ${fmt(calc.credito)}</b> <span class="note">(${fmtInt(calc.mortos)} peixes)</span></p>
          <div class="field"><label>O que fazer com o crédito</label>
            <label style="color:var(--fg)"><input type="radio" name="mdest" value="abater" ${dest === 'abater' ? 'checked' : ''}> Abater do saldo deste pedido</label>
            <label style="color:var(--fg)"><input type="radio" name="mdest" value="guardar" ${dest === 'guardar' ? 'checked' : ''}> Guardar como crédito para o próximo pedido do cliente</label></div>
          <div class="row"><button type="button" class="primary" data-h="mortSave" data-id="${e.id}">Aplicar ajuste</button><button type="button" data-h="mortNota" data-id="${e.id}" ${calc.credito > 0 ? '' : 'disabled'}>Baixar nota do pedido corrigida (.xlsx)</button></div>
          <p class="note" id="mortMsg" role="status">${e.mort && e.mort.credito ? `Ajuste aplicado: crédito de R$ ${fmt(e.mort.credito)} (${e.mort.destino === 'guardar' ? 'guardado para o próximo pedido' : 'abatido do saldo'}).` : ''}</p>
        </div>
      </div></section>`;
  }

  document.addEventListener('click', async ev => {
    const lx = ev.target.closest('[data-lixo]');
    if (lx && S.view === 'hist') {
      const LX = store.get('histLixo', []), it = LX[+lx.dataset.lixo]; if (!it) return;
      if (S.hist.some(z => z.id === it.e.id)) { PP.toast('Este pedido já está no histórico.'); }
      else { S.hist.push(it.e); S.hist.sort((a, b) => (a.ts || 0) - (b.ts || 0)); PP.saveHist(); PP.toast(`Pedido de ${(it.e.cliente || {}).nome || ''} restaurado no histórico. Abra-o e marque a programação para voltar.`, 'ok'); }
      LX.splice(+lx.dataset.lixo, 1); store.set('histLixo', LX); ST.lixoOpen = true; PP.renderClientes(); renderHist(); return;
    }
    const b = ev.target.closest('[data-h]'); if (!b || S.view !== 'hist') return;
    const k = b.dataset.h, id = b.dataset.id, e = S.hist.find(x => x.id === (id || ST.hist.open));
    if (k === 'open') { ST.hist.open = id; renderHist(); $('hdet') && $('hdet').scrollIntoView({ behavior: 'smooth' }); }
    else if (k === 'close') { ST.hist.open = null; renderHist(); }
    else if (k === 'mortgo') { ST.hist.open = id; ST.hist.flash = id; renderHist(); const mb = $('mortBox'); if (mb) mb.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => { ST.hist.flash = null; const m2 = $('mortBox'); if (m2) m2.classList.remove('flash'); }, 2400); }
    else if (k === 'mortok') { const em = (S.embarques || []).find(z => z.id === b.dataset.eid); if (em) { (em.linhas || []).forEach(l => { const h = S.hist.find(z => z.id === l.pedidoId); if (h && !h.mort) { h.mortOk = Date.now(); h.upd = Date.now(); } }); PP.saveHist(); renderHist(); if (PP.assist) PP.assist.refresh(); if (PP.hoje && S.view === 'hoje') PP.hoje.render(); } }
    else if (k === 'edit') { if (e && e.rapido && PP.pn) PP.pn.edit(id); else PP.loadEntry(id, 'edit'); }
    else if (k === 'repeat') PP.loadEntry(id, 'repeat');
    else if (k === 'copycobr') { try { await navigator.clipboard.writeText($('cobr').value); msg('cobrMsg', 'Mensagem copiada.'); } catch (_) { $('cobr').select(); msg('cobrMsg', 'Selecione e copie (Ctrl+C).'); } }
    else if (k === 'del') { if (confirm('Excluir este pedido do histórico e da programação? Ele deixa de contar no estoque e nos relatórios. (Dá para restaurar em Pedidos apagados.)')) { embTira(id); S.hist = S.hist.filter(x => x.id !== id); PP.saveHist(); ST.hist.open = null; PP.renderClientes(); renderHist(); } }
    else if (k === 'mortSave' && e) {
      const c = F.mortalidade(e, ST.hist.mort[e.id] || {}), dest = (document.querySelector('input[name=mdest]:checked') || {}).value || 'abater';
      e.mortOk = c.credito > 0 ? 0 : Date.now(); e.mort = c.credito > 0 ? { dead: Object.assign({}, ST.hist.mort[e.id]), credito: c.credito, mortos: c.mortos, destino: dest, em: F.todayISO() } : null; e.upd = Date.now();
      PP.saveHist(); PP.renderClientes(); renderHist();
    }
    else if (k === 'avchip' && e) { const i = $('avPct'); if (i) { i.value = b.dataset.v; ST.hist.av[e.id] = b.dataset.v; $('avPrev').innerHTML = avPrevTxt(e, b.dataset.v); } }
    else if (k === 'avSave' && e) {
      const pct = parseFloat(String(($('avPct') || {}).value || '').replace(',', '.'));
      if (!(pct > 0 && pct <= 100)) { msg('avMsg', 'Digite a % do desconto (entre 0 e 100) ou toque em 5% ou 10%.'); return; }
      e.avista = { pct, valor: F.valorAvista(e, pct), em: F.todayISO() }; e.upd = Date.now(); delete ST.hist.av[e.id];
      PP.saveHist(); PP.renderClientes(); renderHist(); if (PP.assist) PP.assist.refresh(); PP.toast('Desconto à vista aplicado.', 'ok');
    }
    else if (k === 'avDel' && e) { e.avista = null; e.upd = Date.now(); delete ST.hist.av[e.id]; PP.saveHist(); PP.renderClientes(); renderHist(); if (PP.assist) PP.assist.refresh(); PP.toast('Desconto removido: o pedido voltou ao valor de antes.', 'ok'); }
    else if (k === 'avNota' && e && e.avista) {
      const dead = e.mort && e.mort.destino === 'abater' ? (e.mort.dead || {}) : {}, nc = F.notaCorrigida(e, F.mortalidade(e, dead));
      const bytes = await PP.docs.notinhaXlsx({ cliente: e.cliente, dataISO: e.dataISO, nota: nc });
      saveBlob(`NOTA_COM_DESCONTO_${PP.slug(e.cliente.nome)}.xlsx`, new Blob([bytes], { type: XLSX }));
    }
    else if (k === 'mortNota' && e) {
      const c = F.mortalidade(e, ST.hist.mort[e.id] || {}), nc = F.notaCorrigida(e, c);
      const bytes = await PP.docs.notinhaXlsx({ cliente: e.cliente, dataISO: e.dataISO, nota: nc });
      saveBlob(`NOTINHA_CORRIGIDA_${PP.slug(e.cliente.nome)}.xlsx`, new Blob([bytes], { type: XLSX }));
    }
  });
  document.addEventListener('input', ev => {
    if (S.view !== 'hist') return;
    const t = ev.target;
    if (t.id === 'hq') { ST.hist.q = t.value; renderHist(); const i = $('hq'); i.focus(); i.setSelectionRange(t.value.length, t.value.length); }
    else if (t.dataset.dead !== undefined) {
      const e = S.hist.find(x => x.id === ST.hist.open); if (!e) return;
      ST.hist.mort[e.id] = Object.assign({}, ST.hist.mort[e.id]); ST.hist.mort[e.id][t.dataset.dead] = parseInt(t.value, 10) || 0;
      const pos = t.dataset.dead; renderHist(); const i = document.querySelector(`[data-dead="${pos}"]`); if (i) i.focus();
    }
  });
  document.addEventListener('change', ev => {
    if (S.view !== 'hist') return;
    const t = ev.target;
    if (t.id === 'hst') { ST.hist.st = t.value; renderHist(); }
    else if (t.dataset.pay) {
      const e = S.hist.find(x => x.id === ST.hist.open); if (!e) return;
      e.pay[t.dataset.pay] = t.dataset.pay === 'pago' ? (parseFloat(t.value) || 0) : t.value;
      if (t.dataset.pay === 'pago' && e.pay.pago >= F.devido(e) - 0.005 && e.pay.pago > 0 && e.pay.status === 'aguardando') e.pay.status = 'pago';
      if (t.dataset.pay === 'status' && t.value === 'pago' && !e.pay.pago) { e.pay.pago = F.devido(e); e.pay.dataPago = e.pay.dataPago || F.todayISO(); }
      e.upd = Date.now(); PP.saveHist(); renderHist();
    }
  });

  /* ====================== PAINEL ====================== */
  function range() {
    const hoje = F.todayISO(), r = ST.painel.r;
    if (r === 'mes') return [hoje.slice(0, 8) + '01', hoje];
    if (r === 'tudo') return ['2000-01-01', hoje];
    return [F.addDays(hoje, -(+r - 1)), hoje];
  }
  const bars = (rows, val, label, fmtV) => { const max = Math.max(1, ...rows.map(val)); return `<div class="bars">${rows.map(r => `<div class="bar"><span class="bl" title="${esc(label(r))}">${esc(label(r))}</span><span class="bt"><i style="width:${Math.max(2, Math.round(val(r) / max * 100))}%"></i></span><span class="bv">${fmtV(val(r))}</span></div>`).join('')}</div>`; };
  function renderPainel() {
    const [a, b] = range(), P = F.painel(S.hist, a, b, F.todayISO(), prazo()), r = ST.painel.r;
    const btn = (k, t) => `<button type="button" data-pr="${k}" aria-pressed="${r === k}">${t}</button>`;
    $('vPainel').innerHTML = `<section class="step" id="relBox"></section><section class="step"><div class="row between"><h2>Painel</h2><div class="row" style="gap:6px">${btn('7', 'Últimos 7 dias')}${btn('30', 'Últimos 30 dias')}${btn('mes', 'Este mês')}${btn('tudo', 'Tudo')}</div></div>
      <p class="note">${dBR(a)} a ${dBR(b)}. Conta os pedidos salvos no histórico (cancelados ficam de fora).</p>
      ${P.pedidos ? `<div class="kpis"><div><b>${P.pedidos}</b><span>pedidos</span></div><div><b>${P.caixas}</b><span>caixas</span></div><div><b>${fmtInt(P.peixes)}</b><span>peixes</span></div><div><b>R$ ${fmt(P.faturamento)}</b><span>faturamento</span></div><div><b>R$ ${fmt(P.ticket)}</b><span>ticket médio</span></div><div><b>R$ ${fmt(P.receber)}</b><span>a receber</span></div><div><b>${P.atrasados}</b><span>atrasado(s) · R$ ${fmt(P.valorAtrasado)}</span></div></div>
      <div class="split"><div><h3>Espécies que mais saem (peixes)</h3>${bars(P.especies.slice(0, 10), x => x.peixes, x => x.nome, fmtInt)}</div>
      <div><h3>Clientes (faturamento)</h3>${bars(P.clientes.slice(0, 10), x => x.total, x => x.nome, v => 'R$ ' + fmt(v))}</div></div>
      ${P.dias.length > 1 ? `<h3>Faturamento por dia</h3>${bars(P.dias.slice(-14), x => x.valor, x => dBR(x.dia), v => 'R$ ' + fmt(v))}` : ''}` : '<p class="empty">Nenhum pedido salvo nesse período.</p>'}</section>`;
    if (PP.relatorio) PP.relatorio.mount($('relBox'));
  }
  document.addEventListener('click', ev => { const b = ev.target.closest('[data-pr]'); if (b && S.view === 'painel') { ST.painel.r = b.dataset.pr; renderPainel(); } });

  /* ====================== ROMANEIO E RELATÓRIOS ====================== */
  function renderRelat() {
    const R = ST.relat, rm = F.romaneio(S.hist, R.dia), ib = F.ibamaRows(S.hist, R.de, R.ate);
    $('vRelat').innerHTML = `<section class="step" id="romSec"><h2>Romaneio do dia</h2>
      <div class="row" style="align-items:flex-end"><div class="field" style="flex:0 1 180px"><label for="rdia">Dia do pedido</label><input id="rdia" type="date" value="${R.dia}"></div>
      <button type="button" class="primary" data-r="romX" ${rm.pedidos.length ? '' : 'disabled'}>Baixar romaneio (.xlsx)</button><button type="button" data-r="romP" ${rm.pedidos.length ? '' : 'disabled'}>Imprimir</button></div>
      <div id="romPrint">${rm.pedidos.length ? `<div class="tablewrap"><table><thead><tr><th>Cliente</th><th>Destino</th><th>Invoice</th><th>NF</th><th class="n">Caixas</th><th class="n">Peso kg</th><th class="n">Peixes</th><th class="n">Total R$</th></tr></thead><tbody>
      ${rm.pedidos.map(e => `<tr><td>${esc(e.cliente.nome)}</td><td>${esc(String(e.cliente.end || '').replace(/\s*·\s*/g, ' – '))}</td><td>${esc(e.inv)}</td><td>${esc(e.nf || '—')}</td><td class="n">${e.totais.caixas}</td><td class="n">${e.totais.kg}</td><td class="n">${fmtInt(e.totais.peixes)}</td><td class="n">${fmt(F.devido(e))}</td></tr>`).join('')}
      <tr><td colspan="4"><b>Total do dia (${rm.pedidos.length} pedido${rm.pedidos.length > 1 ? 's' : ''})</b></td><td class="n"><b>${rm.tot.caixas}</b></td><td class="n"><b>${rm.tot.kg}</b></td><td class="n"><b>${fmtInt(rm.tot.peixes)}</b></td><td class="n"><b>${fmt(rm.tot.total)}</b></td></tr></tbody></table></div>
      <h3>Espécies do dia</h3><div class="tablewrap"><table><thead><tr><th>Espécie</th><th>Nome comum</th><th class="n">Peixes</th><th class="n">Clientes</th></tr></thead><tbody>${rm.especies.map(x => `<tr><td>${esc(x.sci)}</td><td>${esc(x.comum)}</td><td class="n">${fmtInt(x.peixes)}</td><td class="n">${x.clientes}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Nenhum pedido salvo nesse dia.</p>'}</div></section>
      <section class="step" id="ibSec"><h2>Controle de exportação (IBAMA)</h2>
      <p class="note">Modelo provisório: uma linha por espécie de cada pedido (data, NF, cliente, espécie, quantidade) e uma aba de resumo por espécie. Envie o seu arquivo antigo da aba IBAMA e eu deixo idêntico ao seu.</p>
      <div class="row" style="align-items:flex-end"><div class="field" style="flex:0 1 170px"><label for="ide">De</label><input id="ide" type="date" value="${R.de}"></div><div class="field" style="flex:0 1 170px"><label for="iate">Até</label><input id="iate" type="date" value="${R.ate}"></div>
      <button type="button" class="primary" data-r="ibX" ${ib.length ? '' : 'disabled'}>Baixar (.xlsx)</button></div>
      ${ib.length ? `<p class="note">${ib.length} linha(s), ${fmtInt(ib.reduce((s, x) => s + x.qtd, 0))} peixes no período.</p><div class="tablewrap"><table><thead><tr><th>Data</th><th>NF</th><th>Cliente</th><th>Espécie</th><th>Nome comum</th><th class="n">Quantidade</th></tr></thead><tbody>${ib.slice(0, 40).map(x => `<tr><td>${dBR(x.data)}</td><td>${esc(x.nf || '—')}</td><td>${esc(x.cliente)}</td><td>${esc(x.sci)}</td><td>${esc(x.comum)}</td><td class="n">${fmtInt(x.qtd)}</td></tr>`).join('')}</tbody></table></div>${ib.length > 40 ? '<p class="note">Mostrando as 40 primeiras; o arquivo leva todas.</p>' : ''}` : '<p class="empty">Nenhum pedido no período.</p>'}</section>`;
  }
  document.addEventListener('change', ev => {
    if (S.view !== 'relat') return; const t = ev.target;
    if (t.id === 'rdia') ST.relat.dia = t.value || ST.relat.dia; else if (t.id === 'ide') ST.relat.de = t.value || ST.relat.de; else if (t.id === 'iate') ST.relat.ate = t.value || ST.relat.ate; else return;
    renderRelat();
  });
  const head = (ws, cols) => { ws.columns = cols; const r = ws.getRow(1); r.font = { bold: true }; r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF0' } }; ws.views = [{ state: 'frozen', ySplit: 1 }]; };
  async function xlsxBytes(wb) { return new Blob([await wb.xlsx.writeBuffer()], { type: XLSX }); }
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-r]'); if (!b || S.view !== 'relat') return;
    const k = b.dataset.r, R = ST.relat;
    if (k === 'romP') { const el = $('romPrint').cloneNode(true); PP.printHTML(`<h2>Romaneio – ${dBR(R.dia)} – ${esc(S.cfg.empresa.nome)}</h2>` + el.innerHTML); }
    if (k === 'romX') {
      const rm = F.romaneio(S.hist, R.dia), wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Romaneio');
      head(ws, [{ header: 'Cliente', key: 'c', width: 30 }, { header: 'Destino', key: 'd', width: 34 }, { header: 'Invoice', key: 'i', width: 10 }, { header: 'NF', key: 'n', width: 12 }, { header: 'Caixas', key: 'x', width: 9 }, { header: 'Peso (kg)', key: 'k', width: 10 }, { header: 'Peixes', key: 'p', width: 10 }, { header: 'Total (R$)', key: 't', width: 14 }]);
      rm.pedidos.forEach(e => ws.addRow({ c: e.cliente.nome, d: String(e.cliente.end || '').replace(/\s*·\s*/g, ' – '), i: e.inv, n: e.nf, x: e.totais.caixas, k: e.totais.kg, p: e.totais.peixes, t: F.devido(e) }));
      const n = rm.pedidos.length + 1, tr = ws.addRow({ c: 'TOTAL', x: { formula: `SUM(E2:E${n})`, result: rm.tot.caixas }, k: { formula: `SUM(F2:F${n})`, result: rm.tot.kg }, p: { formula: `SUM(G2:G${n})`, result: rm.tot.peixes }, t: { formula: `SUM(H2:H${n})`, result: rm.tot.total } }); tr.font = { bold: true };
      ws.getColumn('p').numFmt = '#,##0'; ws.getColumn('t').numFmt = '#,##0.00';
      const w2 = wb.addWorksheet('Espécies'); head(w2, [{ header: 'Espécie', key: 's', width: 34 }, { header: 'Nome comum', key: 'c', width: 26 }, { header: 'Peixes', key: 'p', width: 12 }, { header: 'Clientes', key: 'k', width: 10 }]);
      rm.especies.forEach(x => w2.addRow({ s: x.sci, c: x.comum, p: x.peixes, k: x.clientes })); w2.getColumn('p').numFmt = '#,##0';
      saveBlob(`ROMANEIO_${R.dia}.xlsx`, await xlsxBytes(wb));
    }
    if (k === 'ibX') {
      const rows = F.ibamaRows(S.hist, R.de, R.ate), wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('IBAMA');
      head(ws, [{ header: 'Data', key: 'd', width: 12 }, { header: 'NF', key: 'n', width: 12 }, { header: 'Invoice', key: 'i', width: 10 }, { header: 'Cliente', key: 'c', width: 30 }, { header: 'Destino', key: 'e', width: 34 }, { header: 'Espécie', key: 's', width: 34 }, { header: 'Nome comum', key: 'm', width: 24 }, { header: 'Quantidade', key: 'q', width: 12 }]);
      rows.forEach(x => ws.addRow({ d: dBR(x.data), n: x.nf, i: x.invoice, c: x.cliente, e: String(x.destino || '').replace(/\s*·\s*/g, ' – '), s: x.sci, m: x.comum, q: x.qtd })); ws.getColumn('q').numFmt = '#,##0';
      const w2 = wb.addWorksheet('Resumo'), tot = {}; rows.forEach(x => { tot[x.sci] = tot[x.sci] || { s: x.sci, m: x.comum, q: 0 }; tot[x.sci].q += x.qtd; });
      head(w2, [{ header: 'Espécie', key: 's', width: 34 }, { header: 'Nome comum', key: 'm', width: 24 }, { header: `Total ${dBR(R.de)} a ${dBR(R.ate)}`, key: 'q', width: 24 }]);
      Object.values(tot).sort((a, b) => b.q - a.q).forEach(x => w2.addRow(x)); w2.getColumn('q').numFmt = '#,##0';
      saveBlob(`CONTROLE_IBAMA_${R.de}_${R.ate}.xlsx`, await xlsxBytes(wb));
    }
  });

  /* ====================== ESTOQUE E REPOSIÇÃO ====================== */
  const colL = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  // devolve a stocklist dele, igual, só com a coluna ESTOQUE atualizada (descontando os pedidos salvos)
  async function stocklistAtualizada() {
    const sf = store.get('stockFile', null); if (!sf || !sf.estoqueCol) throw new Error('A stocklist original não está guardada. Envie a stocklist de novo em Configurações.');
    const zip = await JSZip.loadAsync(sf.b64, { base64: true });
    const wbx = await zip.file('xl/workbook.xml').async('string'), rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
    const rid = (wbx.match(/<sheet [^>]*r:id="([^"]+)"/) || [])[1], tgt = rid && (rels.match(new RegExp(`<Relationship [^>]*Id="${rid}"[^>]*>`)) || [''])[0].match(/Target="([^"]+)"/);
    if (!tgt) throw new Error('Estrutura da stocklist inesperada.');
    const path = 'xl/' + tgt[1].replace(/^\/?(xl\/)?/, ''), L = colL(sf.estoqueCol);
    let x = await zip.file(path).async('string'), n = 0;
    PP.cat().forEach(it => {
      if (it.estoqueTab === null || it.estoqueTab === undefined || !it.vendido) return;
      const ref = `${L}${it.row}`, re = new RegExp(`<c r="${ref}"([^>]*?)(/>|>([\\s\\S]*?)</c>)`);
      const m = x.match(re); if (!m || /<f[ >]/.test(m[0])) return;
      const attrs = m[1].replace(/\st="[^"]*"/, '');
      x = x.replace(re, `<c r="${ref}"${attrs}><v>${it.estoque}</v></c>`); n++;
    });
    zip.file(path, x);
    return { bytes: await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }), n, name: sf.name };
  }
  function renderEstoque() {
    const E = ST.estoque, eff = PP.cat(), vend = eff.filter(c => c.vendido > 0);
    const rep = F.reposicao(S.hist, eff, { dias: E.dias, meta: E.meta, hoje: F.todayISO() });
    $('vEstoque').innerHTML = `<section class="step"><h2>Estoque restante</h2>
      ${!S.catalog.length ? '<p class="empty">Envie a stocklist em Configurações.</p>' : `<p class="note">Estoque da stocklist de ${esc(S.catalogInfo)} menos as caixas dos pedidos salvos desde então. Ao enviar uma stocklist nova, a conta recomeça.</p>
      <div class="row"><button type="button" class="primary" data-e="stk" ${vend.length ? '' : 'disabled'}>Baixar stocklist atualizada (.xlsx)</button><span class="note" id="stkMsg" role="status">${vend.length ? `${vend.length} espécie(s) com caixas já vendidas. O arquivo sai igual ao seu, só com a coluna ESTOQUE ajustada.` : 'Nenhuma venda salva desde a última stocklist.'}</span></div>
      ${vend.length ? `<div class="tablewrap"><table><thead><tr><th>Espécie</th><th>Nome comum</th><th class="n">Caixa</th><th class="n">Estoque na lista</th><th class="n">Já saíram</th><th class="n">Restam</th></tr></thead><tbody>${vend.map(c => `<tr><td>${esc(c.sci)}</td><td>${esc(c.comum)}</td><td class="n">${fmtInt(c.caixa)}</td><td class="n">${c.estoqueTab}</td><td class="n">${c.vendido}</td><td class="n"><b>${c.estoque === null ? '—' : c.estoque}</b></td></tr>`).join('')}</tbody></table></div>` : ''}`}</section>
      <section class="step"><div class="row between"><h2>Lista de reposição</h2><div class="row" style="align-items:flex-end;gap:10px"><div class="field" style="flex:0 1 150px"><label for="rdias">Olhar os últimos (dias)</label><input id="rdias" type="number" min="7" max="365" value="${E.dias}"></div><div class="field" style="flex:0 1 170px"><label for="rmeta">Cobrir (semanas)</label><input id="rmeta" type="number" min="1" max="12" value="${E.meta}"></div></div></div>
      <p class="note">Cruza o que vendeu nos últimos ${E.dias} dias com o que ainda resta. “Repor” é quantas caixas faltam para cobrir ${E.meta} semana(s) de venda.</p>
      ${rep.length ? `<div class="row"><button type="button" data-e="repCopy">Copiar lista</button><button type="button" data-e="repPrint">Imprimir</button><span class="note" id="repMsg" role="status"></span></div><div class="tablewrap" id="repTb"><table><thead><tr><th>Espécie</th><th>Nome comum</th><th class="n">Vendido (cx)</th><th class="n">Por semana</th><th class="n">Restam (cx)</th><th class="n">Dura (sem.)</th><th class="n">Repor (cx)</th></tr></thead><tbody>
      ${rep.map(x => `<tr class="${x.semanas !== null && x.semanas < 1 ? 'urg' : ''}"><td>${esc(x.sci)}</td><td>${esc(x.comum)}</td><td class="n">${x.vendidoCx}</td><td class="n">${x.porSemana}</td><td class="n">${x.resta === null ? 'sem estoque' : x.resta}</td><td class="n">${x.semanas === null ? '—' : x.semanas}</td><td class="n"><b>${x.repor || '—'}</b></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Sem vendas salvas nesse período.</p>'}</section>`;
  }
  document.addEventListener('change', ev => {
    if (S.view !== 'estoque') return; const t = ev.target;
    if (t.id === 'rdias') ST.estoque.dias = Math.max(7, parseInt(t.value, 10) || 30); else if (t.id === 'rmeta') ST.estoque.meta = Math.max(1, parseInt(t.value, 10) || 2); else return;
    renderEstoque();
  });
  document.addEventListener('click', async ev => { // atalho no topo de todas as telas
    const t = ev.target.closest('#stkTop'); if (!t) return;
    try { const r = await stocklistAtualizada(); saveBlob(`STOCKLIST_ATUALIZADA_${F.todayISO()}.xlsx`, new Blob([r.bytes], { type: XLSX })); PP.toast(r.n ? `Stocklist atualizada baixada (${r.n} linha(s) de estoque ajustadas pelas vendas).` : 'Stocklist baixada. Ainda não há vendas salvas desde a última lista, então saiu igual à original.'); } catch (e) { PP.toast(e.message); }
  });
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-e]'); if (!b || S.view !== 'estoque') return; const k = b.dataset.e;
    if (k === 'stk') { try { const r = await stocklistAtualizada(); saveBlob(`STOCKLIST_ATUALIZADA_${F.todayISO()}.xlsx`, new Blob([r.bytes], { type: XLSX })); msg('stkMsg', `Stocklist atualizada baixada (${r.n} linhas de estoque ajustadas).`); } catch (e) { msg('stkMsg', e.message); } }
    if (k === 'repPrint') PP.printHTML('<h2>Lista de reposição – ' + dBR(F.todayISO()) + '</h2>' + $('repTb').innerHTML);
    if (k === 'repCopy') {
      const rep = F.reposicao(S.hist, PP.cat(), { dias: ST.estoque.dias, meta: ST.estoque.meta, hoje: F.todayISO() }).filter(x => x.repor > 0);
      const t = 'REPOSIÇÃO\n' + rep.map(x => `${x.repor} cx – ${x.sci} (${x.comum}) – restam ${x.resta === null ? 0 : x.resta}`).join('\n');
      try { await navigator.clipboard.writeText(t); msg('repMsg', 'Lista copiada.'); } catch (_) { msg('repMsg', 'Não consegui copiar automaticamente.'); }
    }
  });

  /* ====================== NUVEM (SUPABASE) · login + salvamento quase ao vivo ====================== */
  let syncTimer = null, syncing = false, lastTick = 0;
  const scfg = () => (PP.cloudCfg ? PP.cloudCfg() : null);
  const DATAKEYS = ['embarques', 'catalog', 'catalogInfo', 'catStamp', 'stockFile', 'clientes', 'cfg', 'hist', 'expcfg', 'exphist', 'fretes', 'tarefas', 'kanban', 'mapa'];
  const localMod = () => +(localStorage.getItem('pp.mod') || 0);
  const gather = () => { const d = {}; DATAKEYS.forEach(k => { d[k] = store.get(k, null); }); return d; };
  PP.cloud = { state: 'off', pend: 0, msg: '', deferred: false };
  const setState = (st, m) => { PP.cloud.state = st; PP.cloud.msg = m || ''; if (PP.auth && PP.auth.info) PP.auth.info(); };
  const UPN = s => String(s || '').trim().toUpperCase();
  // guarda "o que existia" na última sincronização (só ids e nomes): é assim que o app sabe o que foi apagado de um lado
  const saveBase = d => { try { store.set('syncBase', { ix: F.idIndex(d), cli: (d.clientes || []).map(c => UPN(c.nome)) }); } catch (_) { /* ok */ } };
  const saveSync = (c, last) => { c.last = last; store.set('sync', { last, email: c.email || '' }); saveBase(gather()); };
  let applying = false;
  function applyRemote(d, mod) {
    applying = true;
    DATAKEYS.forEach(k => { if (d[k] !== null && d[k] !== undefined) { try { localStorage.setItem('pp.' + k, JSON.stringify(d[k])); } catch (_) { /* cheio */ } } });
    try { localStorage.setItem('pp.mod', String(mod)); } catch (_) { /* ok */ }
    if (PP.mapa && PP.mapa.invalidate) PP.mapa.invalidate();
    try { PP.reloadState(); } finally { applying = false; try { localStorage.setItem('pp.mod', String(mod)); } catch (_) { /* ok */ } } // redesenhar a tela não conta como "alteração sua"
  }
  // o aparelho ainda não tem nenhum dado do usuário (aparelho novo)?
  const temDados = v => Array.isArray(v) ? v.length > 0 : (v && typeof v === 'object' ? Object.keys(v).some(k => temDados(v[k])) : false);
  const aparelhoNovo = m => ['hist', 'clientes', 'embarques', 'exphist', 'fretes', 'tarefas', 'kanban', 'mapa'].every(k => !temDados(m[k]));
  const digitando = () => { const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !a.closest('#login') && !a.readOnly && a.type !== 'checkbox' && a.type !== 'radio' && a.type !== 'file'); };
  async function syncNow(manual, poll) {
    const c = scfg(); if (!c || syncing) return;
    if (!PP.auth || !PP.auth.hasSession()) { if (PP.auth) PP.auth.show(); setState('off'); return; }
    syncing = true; lastTick = Date.now();
    try {
      c.token = await PP.auth.token();
      const k = { id: c.esp, key: null }, f = fetch.bind(window), lm = localMod(), last = c.last || 0;
      if (poll) {
        const rm = await F.cloudMod(f, c, k);
        if (rm !== null && rm <= last && lm <= last) { if (PP.cloud.state !== 'ok') setState('ok'); return; } // nada de novo
        if (rm !== null && rm > last && lm <= last && digitando()) { PP.cloud.deferred = true; return; }  // não troca a tela enquanto você digita
      }
      PP.cloud.deferred = false;
      setState('sync');
      const remote = await F.cloudPull(f, c, k);
      const push = async (d, mod) => { await F.cloudPush(f, c, k, d, mod); saveSync(c, mod); PP.cloud.pend = 0; setState('ok'); };
      if (!remote) { await push(gather(), lm || Date.now()); if (manual) PP.toast('Conectado. Seus dados estão na nuvem.', 'ok'); }
      else if (remote.mod > last && aparelhoNovo(gather())) { applyRemote(remote.data, remote.mod); saveSync(c, remote.mod); PP.cloud.pend = 0; setState('ok'); PP.toast('Seus dados foram carregados da nuvem.', 'ok'); }
      else if (remote.mod > last && lm > last) { // mudou nos dois lados: junta tudo (nada se perde)
        const mine = gather(), bNovo = remote.mod >= lm, d = {};
        const base = store.get('syncBase', null), ix = base && base.ix;
        DATAKEYS.forEach(kk => { d[kk] = F.mergeData(mine[kk], remote.data[kk], bNovo, ix, kk); });
        d.hist = F.mergeHist(mine.hist, remote.data.hist); d.clientes = F.mergeClientes(mine.clientes, remote.data.clientes);
        // o que já existia na última sincronização e sumiu de um dos lados foi apagado: não volta
        if (ix && ix.hist && Array.isArray(mine.hist) && Array.isArray(remote.data.hist)) { const ja = new Set(ix.hist), a = new Set(mine.hist.map(x => String(x.id))), b = new Set(remote.data.hist.map(x => String(x.id))); d.hist = d.hist.filter(x => !ja.has(String(x.id)) || (a.has(String(x.id)) && b.has(String(x.id)))); }
        if (base && Array.isArray(base.cli) && Array.isArray(mine.clientes) && Array.isArray(remote.data.clientes)) { const ja = new Set(base.cli), a = new Set(mine.clientes.map(x => UPN(x.nome))), b = new Set(remote.data.clientes.map(x => UPN(x.nome))); d.clientes = d.clientes.filter(x => !ja.has(UPN(x.nome)) || (a.has(UPN(x.nome)) && b.has(UPN(x.nome)))); }
        const mod = Date.now(); applyRemote(d, mod); await push(d, mod); PP.toast('Os dois lados tinham mudanças: juntei tudo e enviei.', 'ok');
      } else if (remote.mod > last) { applyRemote(remote.data, remote.mod); saveSync(c, remote.mod); PP.cloud.pend = 0; setState('ok'); PP.toast('Atualizado com os dados da nuvem (alterações de outro computador).', 'ok'); }
      else if (lm > last) await push(gather(), lm);
      else { PP.cloud.pend = 0; setState('ok'); if (manual) PP.toast('Tudo igual à nuvem.', 'ok'); }
    } catch (e) {
      const off = e && (e.name === 'TypeError' || /failed to fetch|network|load failed/i.test(String(e.message))) || !navigator.onLine;
      if (!(e && e.code === 'AUTH')) {
        const first = PP.cloud.state !== 'pend' && PP.cloud.state !== 'err';
        setState(off ? 'pend' : 'err', off ? 'Sem internet — usando os dados deste PC' : String((e && e.message) || e));
        if (first || manual) PP.toast(off ? 'Sem conexão: seus dados estão salvos aqui e sobem quando a internet voltar.' : 'Não consegui sincronizar: ' + ((e && e.message) || e), 'bad');
      }
    } finally { syncing = false; }
  }
  PP.listeners.push(() => { if (!scfg() || applying) return; PP.cloud.pend++; if (PP.cloud.state === 'ok') setState('pend'); clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(false), 2000); });
  { const ms = (PP.CLOUD && PP.CLOUD.pollMs) || 20000; setInterval(() => { if (scfg() && !document.hidden) syncNow(false, true); }, ms); }
  document.addEventListener('visibilitychange', () => {
    if (!scfg()) return;
    if (!document.hidden && Date.now() - lastTick > 5000) syncNow(false, true);
    else if (document.hidden && PP.cloud.pend) syncNow(false);
  });
  window.addEventListener('online', () => { if (scfg()) syncNow(false, true); });
  document.addEventListener('focusout', () => { if (PP.cloud.deferred) setTimeout(() => { if (!digitando()) { PP.cloud.deferred = false; syncNow(false, true); } }, 800); });
  window.addEventListener('beforeunload', e => { if (scfg() && PP.cloud.pend > 0 && PP.cloud.state !== 'off') { e.preventDefault(); e.returnValue = ''; } });

  /* ====================== PROGRAMAÇÃO DE EMBARQUES ====================== */
  const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const diaDe = iso => { const [y, m, d] = iso.split('-').map(Number); return DIAS[new Date(y, m - 1, d).getDay()]; };
  const p2 = n => String(n).padStart(2, '0');
  const SITU = { programado: 'Programado', embarcado: 'Embarcado', chegou: 'Chegou', problema: 'Problema' };
  const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const saveEmb = () => store.set('embarques', S.embarques);
  const curEmb = () => S.embarques.find(e => e.id === ST.emb.sel) || null;
  const pesoOf = l => l.peso || `${(l.caixas || 0) * S.cfg.valores.kgCaixa} KG`;
  const dimOf = l => l.dim || `${p2(l.caixas || 0)} CXS DE ${S.cfg.embarque.dim}`;
  const embLabel = e => `${dBR(e.saida)} (${diaDe(e.saida)}) · ${e.titulo} · ${e.linhas.reduce((a, l) => a + (l.caixas || 0), 0)} cx`;
  ST.emb = { sel: null };
  function newEmb(saida) {
    const e = { id: uid(), titulo: 'EMBARQUES NACIONAIS', saida: saida || F.todayISO(), chegadaPrev: F.addDays(saida || F.todayISO(), 1), linhas: [] };
    S.embarques.push(e); ST.emb.sel = e.id; saveEmb(); return e;
  }
  const newLinha = o => Object.assign({ id: uid(), cliente: '', aero: '', cidade: '', caixas: 0, peso: '', dim: '', awb: '', status: 'programado', chegou: '', obs: '', pedidoId: '' }, o || {});
  function embTotals(e) {
    const cx = e.linhas.reduce((a, l) => a + (l.caixas || 0), 0), kg = e.linhas.reduce((a, l) => a + (parseFloat(String(pesoOf(l)).replace(',', '.')) || 0), 0);
    return { cx, kg, n: e.linhas.length, chegou: e.linhas.filter(l => l.status === 'chegou').length, prob: e.linhas.filter(l => l.status === 'problema').length };
  }
  // ícone de ajuda (i) ao lado de um botão: passe o mouse ou toque para ler a explicação
  const hi = t => `<span class="hinti" tabindex="0" role="note" aria-label="${esc(t)}" data-hint="${esc(t)}">i</span>`;
  const embTabs = () => `<div class="row noprint" style="align-items:center"><div class="chips">${[['nac', 'Nacionais'], ['exp', 'Exportações ']].map(([k, n]) => `<button type="button" class="xchip" data-emtab="${k}" aria-pressed="${(ST.emb.tab || 'nac') === k}">${n}</button>`).join('')}</div></div>`;
  function renderEmb() {
    if (ST.emb.tab === 'exp' && PP.exp && PP.exp.progHTML) { $('vEmbarque').innerHTML = embTabs() + PP.exp.progHTML(); return; }
    if (!ST.emb.sel || !curEmb()) ST.emb.sel = (S.embarques.slice().sort((a, b) => b.saida.localeCompare(a.saida))[0] || {}).id || null;
    const e = curEmb(), list = S.embarques.slice().sort((a, b) => b.saida.localeCompare(a.saida));
    let h = embTabs() + `<section class="step"><div class="row between"><h2>Programação de voos</h2><div class="row" style="gap:8px"><button type="button" data-em="new">+ Nova programação</button>${hi('Cria a programação de um novo dia de embarque. Depois é só mudar a data em "Saída do aquário".')}${e ? `<button type="button" data-em="dup">Duplicar esta programação</button>${hi('Copia esta programação, com os mesmos clientes, para daqui a 7 dias. Útil para quem compra toda semana.')}<button type="button" data-em="pull">Puxar pedidos do histórico</button>${hi('Traz para esta programação os pedidos salvos no Histórico com a mesma data.')}<button type="button" data-em="print">Imprimir</button><button type="button" class="primary" data-em="docx">Baixar no seu modelo (.docx)</button><button type="button" class="mortbtn" data-em="delemb" title="Apaga a programação deste dia (os pedidos continuam no Histórico)">Excluir esta programação</button>` : ''}</div></div>`;
    { const vazios = S.embarques.filter(z => !z.linhas.length).length, dias = {}, LXE = store.get('embLixo', []); S.embarques.forEach(z => { if (z.linhas.length) dias[z.saida] = (dias[z.saida] || 0) + 1; });
      const rep = Object.values(dias).filter(n => n > 1).length, sujo = vazios > (S.embarques.length === 1 ? 1 : 0) || rep > 0;
      if (sujo || LXE.length) h += `<div class="row" style="align-items:center;margin:6px 0 10px">${sujo ? '<button type="button" data-em="limpar">Limpar programações repetidas e vazias</button>' : ''}${LXE.length ? '<button type="button" data-em="restemb">Desfazer a última exclusão</button>' : ''}</div>`; }
    if (!e) { $('vEmbarque').innerHTML = h + '<p class="empty">Nenhuma programação ainda. Clique em "+ Nova programação", ou em "Puxar pedidos do histórico" depois de criar um.</p></section>'; return; }
    const T = embTotals(e), stOpts = s => Object.entries(SITU).map(([k, v]) => `<option value="${k}" ${s === k ? 'selected' : ''}>${v}</option>`).join('');
    h += `<div class="row" style="align-items:flex-end"><div class="field grow"><label for="emSel">Programação</label><select id="emSel">${list.map(x => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${esc(embLabel(x))}</option>`).join('')}</select></div>
      <div class="field" style="flex:0 1 190px"><label for="emTit">Título</label><input id="emTit" data-ef="titulo" value="${esc(e.titulo)}"></div>
      <div class="field" style="flex:0 1 160px"><label for="emSai">Saída do aquário</label><input id="emSai" type="date" data-ef="saida" value="${e.saida}"></div>
      <div class="field" style="flex:0 1 160px"><label for="emCheg">Chegada prevista</label><input id="emCheg" type="date" data-ef="chegadaPrev" value="${e.chegadaPrev || ''}"></div></div>
      <div class="emYel" id="emYel">${esc(e.titulo)} – ${diaDe(e.saida).toUpperCase()} (${p2(+e.saida.slice(8))}/${e.saida.slice(5, 7)})</div>
      <div class="kpis" id="emKpi"></div><div id="emDest"></div>
      <div class="tablewrap"><table id="emTb"><thead><tr><th>#</th><th>Cliente</th><th>Aero</th><th>Cidade / UF</th><th class="n">Caixas</th><th>Peso bruto</th><th>Dimensão das caixas</th><th>Conhecimento (AWB)</th><th>Situação</th><th>Chegou em</th><th>Observação</th><th></th></tr></thead><tbody>
      ${e.linhas.map((l, i) => `<tr data-l="${l.id}"><td>${i + 1}</td>
        <td><input data-lf="cliente" value="${esc(l.cliente)}" aria-label="Cliente ${i + 1}" style="min-width:150px" list="emClis"></td>
        <td><input data-lf="aero" value="${esc(l.aero)}" maxlength="4" style="width:64px;text-transform:uppercase;text-align:center" aria-label="Aeroporto ${i + 1}"></td>
        <td><input data-lf="cidade" value="${esc(l.cidade)}" style="min-width:110px" aria-label="Cidade ${i + 1}"></td>
        <td class="n"><input type="number" min="0" data-lf="caixas" value="${l.caixas || ''}" style="width:68px" aria-label="Caixas ${i + 1}"></td>
        <td><input data-lf="peso" value="${esc(l.peso)}" placeholder="${(l.caixas || 0) * S.cfg.valores.kgCaixa} KG" style="width:92px" aria-label="Peso ${i + 1}"></td>
        <td><input data-lf="dim" value="${esc(l.dim)}" placeholder="${esc(dimOf(Object.assign({}, l, { dim: '' })))}" style="min-width:150px" aria-label="Dimensão ${i + 1}"></td>
        <td><input data-lf="awb" value="${esc(l.awb)}" style="width:105px" aria-label="AWB ${i + 1}"></td>
        <td><select data-lf="status" aria-label="Situação ${i + 1}" class="st-${l.status}">${stOpts(l.status)}</select></td>
        <td><input type="date" data-lf="chegou" value="${esc(l.chegou)}" aria-label="Chegou em ${i + 1}"></td>
        <td><input data-lf="obs" value="${esc(l.obs)}" style="min-width:150px" aria-label="Observação ${i + 1}"></td>
        <td style="white-space:nowrap">${l.pedidoId && S.hist.some(x => x.id === l.pedidoId) ? `<button type="button" class="mv" data-em="mort" data-id="${l.id}" title="Registrar a mortalidade deste pedido e gerar a nota do pedido corrigida" style="width:auto;padding:0 8px">Mortalidade</button> ` : ''}<button type="button" class="mv" data-em="up" data-id="${l.id}" aria-label="Subir">▲</button><button type="button" class="mv" data-em="down" data-id="${l.id}" aria-label="Descer">▼</button> <button type="button" class="mv" data-em="del" data-id="${l.id}" aria-label="Remover linha">✕</button></td></tr>`).join('')}</tbody></table></div>
      <datalist id="emClis">${S.clientes.map(c => `<option value="${esc(c.nome)}">`).join('')}</datalist>
      <div class="row"><button type="button" data-em="add">+ Linha</button><span class="note">Tudo é editável. Peso e dimensão se preenchem sozinhos pelas caixas (${S.cfg.valores.kgCaixa} kg por caixa; muda em Configurações); escreva por cima para mudar só naquela linha. Aeroporto e cidade ficam guardados no cadastro do cliente.</span></div><p class="note" id="emMsg" role="status"></p></section>`;
    if (PP.assist) h += PP.assist.embHTML(e);
    $('vEmbarque').innerHTML = h; embKpi();
  }
  /* ---------- confere o aeroporto de cada cliente (cadastro / histórico) antes de mandar para o despachante ---------- */
  const destProblemas = e => (window.FreteCore && e) ? window.FreteCore.checkDestino(e, S.embarques || [], S.clientes || []) : [];
  function embDest() {
    const el = $('emDest'), e = curEmb(); if (!el || !e) return;
    const P = destProblemas(e);
    if (!P.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="alert w" style="margin:10px 0">' + P.map(p => {
      const B = (k, t, pri) => `<button type="button" ${pri ? 'class="primary"' : ''} data-em="${k}" data-id="${p.id}">${t}</button>`;
      if (p.tipo === 'diff') return `<div style="margin:6px 0"><b>Confira o destino de ${esc(p.cliente)}.</b> ${p.fonte === 'cadastro' ? 'No cadastro dele o aeroporto é' : 'Nas programações anteriores' + (p.n > 1 ? ' (' + p.n + ' vezes)' : '') + ' ele foi para'} <b>${esc(p.esperado)}</b> e agora está <b>${esc(p.aero)}</b>.<div class="row" style="margin-top:6px">${B('dfix', 'Trocar para ' + esc(p.esperado), 1)}${B('dok', 'Está certo: é ' + esc(p.aero) + ' hoje')}${p.clienteNoCadastro ? B('dcad', 'Está certo e atualizar o cadastro') : ''}</div></div>`;
      if (p.tipo === 'novo') return `<div style="margin:6px 0"><b>Confirma que o destino de ${esc(p.cliente)} é ${esc(p.aero)}?</b> Não tenho o aeroporto dele no cadastro nem nas programações anteriores.<div class="row" style="margin-top:6px">${B('dconf', 'Sim, confirmar' + (p.clienteNoCadastro ? ' e guardar no cadastro' : ''), 1)}</div></div>`;
      return `<div style="margin:6px 0"><b>Falta o aeroporto de ${esc(p.cliente)}.</b> ${p.esperado ? 'No cadastro dele é <b>' + esc(p.esperado) + '</b>.' : 'Preencha a coluna Aero antes de mandar.'}${p.esperado ? '<div class="row" style="margin-top:6px">' + B('dfix', 'Preencher com ' + esc(p.esperado), 1) + '</div>' : ''}</div>`;
    }).join('') + '</div>';
  }
  function destOk(e) {
    const P = destProblemas(e); if (!P.length) return true;
    const L = P.map(p => '• ' + p.cliente + ': ' + (p.aero || 'sem aeroporto') + (p.tipo === 'diff' ? ' (esperado ' + p.esperado + ')' : p.tipo === 'novo' ? ' (destino ainda não confirmado)' : '')).join('\n');
    return confirm('Atenção: ' + P.length + ' cliente(s) com destino para conferir antes de mandar ao despachante:\n\n' + L + '\n\nGerar mesmo assim?\n(Cancelar = voltar e corrigir)');
  }
  function embKpi() {
    const e = curEmb(); if (!e || !$('emKpi')) return; const T = embTotals(e);
    $('emKpi').innerHTML = `<div><b>${T.n}</b><span>clientes</span></div><div><b>${T.cx}</b><span>caixas</span></div><div><b>${T.kg} kg</b><span>peso bruto</span></div><div><b>${T.chegou} de ${T.n}</b><span>chegaram</span></div>${T.prob ? `<div><b style="color:var(--bad)">${T.prob}</b><span>com problema</span></div>` : ''}`;
    embDest();
    if ($('emYel')) $('emYel').textContent = `${e.titulo} – ${diaDe(e.saida).toUpperCase()} (${p2(+e.saida.slice(8))}/${e.saida.slice(5, 7)})`;
  }
  function pullHist(e) {
    const have = new Set(e.linhas.map(l => l.pedidoId).filter(Boolean)), novos = S.hist.filter(x => x.dataISO === e.saida && F.active(x) && !have.has(x.id)).sort((a, b) => a.ts - b.ts);
    novos.forEach(x => { const c = S.clientes.find(c => PP.up(c.nome) === PP.up(x.cliente.nome)) || {}; e.linhas.push(newLinha({ cliente: x.cliente.nome, aero: c.aero || '', cidade: c.cidade || '', caixas: x.totais.caixas, pedidoId: x.id })); });
    saveEmb(); renderEmb();
    msg('emMsg', novos.length ? `${novos.length} pedido(s) de ${dBR(e.saida)} trazidos do histórico. Complete aeroporto e cidade dos que estiverem vazios.` : `Nenhum pedido novo salvo no dia ${dBR(e.saida)}. (Pedidos aparecem aqui quando você baixa os documentos.)`);
  }
  document.addEventListener('click', async ev => {
    const tb = ev.target.closest('[data-emtab]'); if (tb && S.view === 'embarque') { ST.emb.tab = tb.dataset.emtab; renderEmb(); return; }
    const b = ev.target.closest('[data-em]'); if (!b || S.view !== 'embarque') return;
    const k = b.dataset.em, e = curEmb(), idx = e ? e.linhas.findIndex(l => l.id === b.dataset.id) : -1;
    if (k === 'new') { const v = S.embarques.find(z => z.saida === F.todayISO() && !z.linhas.length); if (v) { ST.emb.sel = v.id; renderEmb(); msg('emMsg', 'Já existe uma programação vazia para hoje: abri ela. Mude a data em "Saída do aquário" se for outro dia.'); } else { newEmb(F.todayISO()); renderEmb(); } return; }
    if (['dfix', 'dok', 'dcad', 'dconf'].includes(k) && e && idx >= 0) {
      const lin = e.linhas[idx], U = x => String(x || '').trim().toUpperCase(), c = S.clientes.find(c => PP.up(c.nome) === PP.up(lin.cliente)), p = destProblemas(e).find(x => x.id === lin.id);
      if (k === 'dfix') { if (p && p.esperado) lin.aero = p.esperado; }
      else if (k === 'dok') lin.aeroOk = U(lin.aero);
      else if (k === 'dcad') { if (c) { c.aero = U(lin.aero); PP.saveClientes(); } lin.aeroOk = U(lin.aero); }
      else if (c && !c.aero) { c.aero = U(lin.aero); PP.saveClientes(); lin.aeroOk = U(lin.aero); } else lin.aeroOk = U(lin.aero);
      saveEmb(); renderEmb(); return;
    }
    if (k === 'restemb') { const L = store.get('embLixo', []), it = L.shift(); if (it) { if (!S.embarques.some(z => z.id === it.e.id)) S.embarques.push(it.e); store.set('embLixo', L); ST.emb.sel = it.e.id; saveEmb(); renderEmb(); msg('emMsg', 'Embarque de ' + dBR(it.e.saida) + ' restaurado.'); } return; }
    if (k === 'limpar') {
      const vz = S.embarques.filter(z => !z.linhas.length), grupos = {}; S.embarques.filter(z => z.linhas.length).forEach(z => { (grupos[z.saida] = grupos[z.saida] || []).push(z); });
      const reps = Object.values(grupos).filter(g => g.length > 1);
      const txt = [vz.length ? `Apagar ${vz.length} programação(ões) vazia(s): ${vz.map(z => dBR(z.saida)).join(', ')}` : '', ...reps.map(g => `Juntar as ${g.length} programações de ${dBR(g[0].saida)} em uma só (${g.reduce((a, z) => a + z.linhas.length, 0)} clientes)`)].filter(Boolean).join('\n');
      if (!txt || !confirm('Limpar a programação?\n\n' + txt + '\n\nNenhum cliente é apagado.')) return;
      let D = null; try { D = store.get('fretes', null); } catch (_) { D = null; }
      reps.forEach(g => { g.sort((a, b) => b.linhas.length - a.linhas.length); const alvo = g[0]; g.slice(1).forEach(z => { z.linhas.forEach(l => { alvo.linhas.push(l); if (D && D.rec && D.rec[z.id + '|' + l.id]) { D.rec[alvo.id + '|' + l.id] = D.rec[z.id + '|' + l.id]; delete D.rec[z.id + '|' + l.id]; } }); z.linhas = []; }); });
      if (D) { store.set('fretes', D); if (PP.frete) PP.frete.reload(); }
      S.embarques = S.embarques.filter(z => z.linhas.length); if (!curEmb()) ST.emb.sel = (S.embarques.slice().sort((a, b) => b.saida.localeCompare(a.saida))[0] || {}).id || null; saveEmb(); renderEmb(); msg('emMsg', 'Pronto: programação limpa, sem perder nenhum cliente.'); return;
    }
    if (!e) return;
    if (k === 'mort') { const l = e.linhas[idx]; if (l && l.pedidoId) { ST.hist.open = l.pedidoId; ST.hist.q = ''; ST.hist.st = ''; PP.go('hist'); setTimeout(() => { const d = $('hdet'); if (d) d.scrollIntoView({ behavior: 'smooth' }); }, 120); } return; }
    if (k === 'dup') { const c = JSON.parse(JSON.stringify(e)); c.id = uid(); c.saida = F.addDays(e.saida, 7); c.chegadaPrev = F.addDays(c.saida, 1); c.linhas.forEach(l => { l.id = uid(); l.status = 'programado'; l.chegou = ''; l.awb = ''; l.obs = ''; l.pedidoId = ''; }); S.embarques.push(c); ST.emb.sel = c.id; saveEmb(); renderEmb(); msg('emMsg', 'Programação duplicada para daí a 7 dias, sem situação e conhecimento.'); }
    else if (k === 'delemb') {
      const n = e.linhas.length;
      if (!confirm(`Excluir a programação de ${dBR(e.saida)}${n ? ', com ' + n + ' cliente(s)' : ' (está vazia)'}?\n\nOs pedidos continuam no Histórico. Dá para desfazer logo depois.`)) return;
      const L = store.get('embLixo', []); L.unshift({ e, quando: Date.now() }); store.set('embLixo', L.slice(0, 20));
      S.embarques = S.embarques.filter(z => z !== e); ST.emb.sel = (S.embarques.slice().sort((a, b) => b.saida.localeCompare(a.saida))[0] || {}).id || null; saveEmb(); renderEmb(); msg('emMsg', 'Programação de ' + dBR(e.saida) + ' excluída. Foi engano? Clique em "Desfazer a última exclusão".');
    }
    else if (k === 'pull') pullHist(e);
    else if (k === 'add') { e.linhas.push(newLinha()); saveEmb(); renderEmb(); const i = document.querySelectorAll('#emTb tbody tr'); i.length && i[i.length - 1].querySelector('input').focus(); }
    else if (k === 'del' && idx >= 0) { e.linhas.splice(idx, 1); saveEmb(); renderEmb(); }
    else if ((k === 'up' || k === 'down') && idx >= 0) { const j = idx + (k === 'up' ? -1 : 1); if (j >= 0 && j < e.linhas.length) { e.linhas.splice(j, 0, e.linhas.splice(idx, 1)[0]); saveEmb(); renderEmb(); } }
    else if (k === 'docx') {
      if (!e.linhas.length) { msg('emMsg', 'Adicione clientes à programação primeiro.'); return; }
      if (!destOk(e)) return;
      const bytes = await PP.docs.embarqueDocx({ titulo: e.titulo, saidaISO: e.saida, linhas: e.linhas.map(l => ({ cliente: l.cliente, aero: l.aero, caixas: l.caixas || 0, peso: l.peso, dim: l.dim })), kg: S.cfg.valores.kgCaixa, dimPadrao: S.cfg.embarque.dim });
      saveBlob(`PROGRAMACAO_EMBARQUES_${e.saida}.docx`, new Blob([bytes], { type: PP.MIME.docx }));
    }
    else if (k === 'print') {
      if (!destOk(e)) return;
      const T = embTotals(e);
      PP.printHTML(`<h2>Programação de embarques – ${esc(e.titulo)} – ${diaDe(e.saida)} (${dBR(e.saida)})</h2><table><thead><tr><th>#</th><th>Cliente</th><th>Aero</th><th>Cidade</th><th>Cx</th><th>Peso</th><th>Dimensão</th><th>AWB</th><th>Situação</th><th>Chegou</th><th>Obs.</th></tr></thead><tbody>${e.linhas.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.cliente)}</td><td>${esc(l.aero)}</td><td>${esc(l.cidade)}</td><td>${l.caixas || 0}</td><td>${esc(pesoOf(l))}</td><td>${esc(dimOf(l))}</td><td>${esc(l.awb)}</td><td>${SITU[l.status]}</td><td>${dBR(l.chegou)}</td><td>${esc(l.obs)}</td></tr>`).join('')}<tr><td colspan="4"><b>Total</b></td><td><b>${T.cx}</b></td><td><b>${T.kg} KG</b></td><td colspan="5"></td></tr></tbody></table>`);
    }
  });
  document.addEventListener('input', ev => {
    if (S.view !== 'embarque') return; const t = ev.target, e = curEmb(); if (!e) return;
    if (t.dataset.ef) { e[t.dataset.ef] = t.type === 'date' ? t.value : t.value.toUpperCase(); if (t.dataset.ef === 'saida' && !t.value) return; saveEmb(); embKpi(); return; }
    const tr = t.closest('tr[data-l]'), l = tr && e.linhas.find(x => x.id === tr.dataset.l), f = t.dataset.lf; if (!l || !f) return;
    if (f === 'caixas') { l.caixas = Math.max(0, parseInt(t.value, 10) || 0); tr.querySelector('[data-lf=peso]').placeholder = `${l.caixas * S.cfg.valores.kgCaixa} KG`; tr.querySelector('[data-lf=dim]').placeholder = dimOf(Object.assign({}, l, { dim: '' })); }
    else l[f] = (f === 'cliente' || f === 'aero') ? t.value.toUpperCase() : t.value;
    if (f === 'cliente') { const c = S.clientes.find(c => PP.up(c.nome) === PP.up(l.cliente)); if (c) { if (!l.aero && c.aero) { l.aero = c.aero; tr.querySelector('[data-lf=aero]').value = c.aero; } if (!l.cidade && c.cidade) { l.cidade = c.cidade; tr.querySelector('[data-lf=cidade]').value = c.cidade; } } }
    if ((f === 'aero' || f === 'cidade') && l.cliente) { const c = S.clientes.find(c => PP.up(c.nome) === PP.up(l.cliente)); if (c && f === 'cidade') { c.cidade = t.value; PP.saveClientes(); } }   /* o aeroporto só vai para o cadastro quando você confirma no aviso (antes ia sozinho e escondia o erro) */
    saveEmb(); embKpi();
  });
  document.addEventListener('change', ev => {
    if (S.view !== 'embarque') return; const t = ev.target, e = curEmb();
    if (t.id === 'emSel') { ST.emb.sel = t.value; renderEmb(); return; }
    if (!e) return;
    if (t.dataset.ef === 'saida') { renderEmb(); return; }
    const tr = t.closest('tr[data-l]'), l = tr && e.linhas.find(x => x.id === tr.dataset.l);
    if (l && t.dataset.lf === 'status') { l.status = t.value; if (l.status === 'chegou' && !l.chegou) l.chegou = F.todayISO(); saveEmb(); renderEmb(); }
  });

  /* ====================== geral ====================== */
  /* ---------- pedido nacional → Programação de voos (usado pelo aviso depois de salvar) ---------- */
  const embAbertos = () => (S.embarques || []).filter(x => x.saida >= F.addDays(F.todayISO(), -1)).sort((a, b) => a.saida.localeCompare(b.saida));
  const embDoPedido = id => (S.embarques || []).find(x => x.linhas.some(l => l.pedidoId === id)) || null;
  function embColoca(entry, embId, saidaNova) {
    let e = embId === 'new' ? newEmb(saidaNova || entry.dataISO || F.todayISO()) : (S.embarques || []).find(x => x.id === embId);
    if (!e) return null;
    const c = (S.clientes || []).find(c => PP.up(c.nome) === PP.up(entry.cliente.nome)) || {};
    const l = e.linhas.find(z => z.pedidoId === entry.id);
    if (l) { l.caixas = entry.totais.caixas; l.cliente = entry.cliente.nome; } else e.linhas.push(newLinha({ cliente: entry.cliente.nome, aero: c.aero || '', cidade: c.cidade || '', caixas: entry.totais.caixas, pedidoId: entry.id }));
    saveEmb(); return e;
  }
  /* tira o pedido da programação (usado ao apagar o pedido) */
  function embTira(pedidoId) { let mudou = false; (S.embarques || []).forEach(e => { const n = e.linhas.length; e.linhas = e.linhas.filter(l => l.pedidoId !== pedidoId); if (e.linhas.length !== n) mudou = true; }); if (mudou) saveEmb(); }
  /* muda a programação do pedido para a data escolhida (cria a programação se não existir); peso, AWB e frete da linha vão junto */
  function embMove(entry, saida) {
    if (!saida) return null;
    const old = embDoPedido(entry.id); if (old && old.saida === saida) { embColoca(entry, old.id); return old; }
    let alvo = (S.embarques || []).find(x => x.saida === saida && x !== old); if (!alvo) alvo = newEmb(saida);
    if (!old) return embColoca(entry, alvo.id);
    const l = old.linhas.find(z => z.pedidoId === entry.id); old.linhas = old.linhas.filter(z => z !== l);
    l.caixas = entry.totais.caixas; alvo.linhas.push(l);
    try { const D = store.get('fretes', null); if (D && D.rec && D.rec[old.id + '|' + l.id]) { D.rec[alvo.id + '|' + l.id] = D.rec[old.id + '|' + l.id]; delete D.rec[old.id + '|' + l.id]; store.set('fretes', D); if (PP.frete) PP.frete.reload(); } } catch (_) { /* ok */ }
    if (!old.linhas.length) S.embarques = S.embarques.filter(x => x !== old);
    saveEmb(); return alvo;
  }
  /* mantém as caixas em dia quando um pedido que já está na programação é salvo de novo */
  function embAtualiza(entry) { const e = embDoPedido(entry.id); if (!e) return null; embColoca(entry, e.id); return e; }
  PP.extra = {
    embAbertos, embDoPedido, embColoca, embAtualiza, embLabel, embMove, embTira,
    render(v) { if (v === 'embarque') renderEmb(); else if (v === 'hist') renderHist(); else if (v === 'painel') renderPainel(); else if (v === 'relat') renderRelat(); else if (v === 'estoque') renderEstoque(); },
    refresh() { this.render(S.view); }, syncNow, stocklistAtualizada, ST, mortPend,
  };
  setTimeout(() => syncNow(false), 600); // ao abrir, puxa o que mudou em outro computador
})();
