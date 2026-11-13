/* Prestige Pedidos — Manual (pesquisável) e Tour guiado. Texto puro, sem internet. Abre pelo botão "Manual e tour" do menu lateral. */
(function () {
  'use strict';
  const PP = window.PP, store = PP.store, esc = PP.esc;
  const $ = id => document.getElementById(id);

  /* ---------- Manual ---------- */
  const SEC = [
    { id: 'comeco', t: 'Como o sistema funciona', k: 'início comecar dados navegador nuvem sincronizar',
      h: `<p>O sistema roda no seu navegador. Os dados (clientes, pedidos, notas de entrada, valores) ficam guardados neste aparelho e, com a nuvem ligada, são sincronizados com os outros aparelhos.</p>
        <ol><li>Em <b>Configurações</b>, envie a stocklist (.xlsx). Sem ela o app não sabe os preços.</li><li>O botão <b>Hoje</b> mostra o que precisa de atenção. Comece sempre por ele.</li><li><b>Ctrl K</b> abre a busca de cliente ou NF.</li></ol>` },
    { id: 'nacional', t: 'Pedido nacional', k: 'nacional pedido ler colar cliente salvar',
      h: `<ol><li>Abra <b>Nacional</b> e preencha o cliente.</li><li>Cole o pedido e clique em <b>Ler pedido</b>. A coluna da direita mostra caixas, peixes e valor ao vivo.</li><li>Itens em vermelho estão sem estoque ou sem correspondência: corrija antes de gerar os documentos.</li><li>Gere o documento e salve. O pedido vai para o <b>Histórico</b>.</li></ol>
        <p class="note">Depois de salvo, o desconto à vista e a mortalidade são tratados no Histórico (veja "Histórico e cobrança").</p>` },
    { id: 'hist', t: 'Histórico, cobrança e mortalidade', k: 'histórico cobrança mortalidade desconto avista à vista comprovação recebi',
      h: `<p>Em <b>Histórico → Embarques e clientes</b> cada linha é um cliente de uma programação de voo.</p>
        <ul><li><b>Teve mortalidade / Não teve</b>: registre quantos peixes morreram. O crédito pode ser abatido do pedido ou guardado para o próximo.</li>
        <li><b>Comprovação</b>: anexe a foto ou marque "Cliente mandou pelo WhatsApp". Sem isso a linha mostra "sem comprovação".</li>
        <li><b>10% à vista</b> ou <b>Outro %</b>: aplica o desconto com prazo ("vale até"). Venceu e o cliente não pagou? Use <b>Retirar desconto (venceu)</b>.</li>
        <li><b>Copiar cobrança</b>, <b>Copiar mensagem do desconto</b> e <b>Copiar mensagem da mortalidade</b> montam o texto para colar no WhatsApp.</li>
        <li><b>Recebi</b> marca o pedido como pago.</li></ul>` },
    { id: 'exp', t: 'Exportação', k: 'exportação exportacao voo lpco mawb hawb due package conversão',
      h: `<ol><li>Abra <b>Exportação</b> e escolha o destino.</li><li>Preencha voo e documentos do despachante (MAWB, HAWB, DU-E): ficam sempre à vista.</li><li>Os blocos "Package fee, discount, DOA e frete", "Embalagem, oxigênio e temperatura" e "Conversão para real" ficam recolhidos com um resumo. Abra só o que precisa mexer, ou use <b>Abrir todos os blocos</b>.</li><li>O LPCO fica aberto. Salve a exportação para registrar o número no histórico.</li></ol>` },
    { id: 'mapa', t: 'Notas de entrada e MAPA (SEI)', k: 'mapa sei nota entrada nf pack protocolar devolvido indeferido pescador ctf rgp checklist',
      h: `<ol><li>Em <b>Notas de entrada → NFs de entrada</b>, cadastre cada nota com os PDFs. O app lê as espécies e o saldo.</li><li>Em <b>Passo a passo</b>, monte o pack: escolha as NFs e as quantidades por espécie.</li><li>Confira o <b>Checklist antes de protocolar</b>: ele avisa de NF já usada, data errada, PDF faltando, CTF/RGP vencidos e documentos da empresa.</li><li>Protocole no SEI e informe o número em <b>Processos</b>.</li><li>Se o MAPA devolver ou indeferir, use os botões do pack: o motivo e o histórico ficam guardados. Devolvido mantém o saldo reservado; indeferido e cancelado liberam o saldo.</li></ol>
        <p class="note">As abas "Saldo por nota", "Saldo por espécie" e "Pescadores (CTF/RGP)" ajudam a conferir.</p>` },
    { id: 'voos', t: 'Programação de voos', k: 'programação voos embarque saída cliente caixas',
      h: `<p>Monte cada embarque com a data de saída e os clientes. A programação alimenta o Histórico (mortalidade, cobrança), o Frete e os avisos do Assistente.</p>` },
    { id: 'frete', t: 'Frete', k: 'frete cte despachante cobrança',
      h: `<p>Anexe os CT-es de cada embarque, confira o valor e acompanhe quem já pagou o frete. Fretes em aberto aparecem no cartão da tela <b>Hoje</b> e como contador no menu.</p>` },
    { id: 'fin', t: 'Financeiro, Clientes e Painel', k: 'financeiro clientes painel relatório romaneio estoque tarefas',
      h: `<p><b>Financeiro</b> mostra o que está aguardando pagamento e atrasado. <b>Clientes</b> reúne histórico, saldo e crédito de cada um. <b>Painel</b> e <b>Romaneio e relatórios</b> resumem vendas; <b>Estoque e reposição</b> ajuda a planejar a compra.</p>` },
    { id: 'assist', t: 'Assistente', k: 'assistente pendências lembrete cardinal depois',
      h: `<p>O cardinal no menu lateral junta as pendências do dia: boletos, CT-e, mortalidade, descontos que vencem, packs devolvidos pelo MAPA, backup. Cada aviso tem os botões para resolver ali mesmo, ou <b>Depois</b> para adiar.</p>` },
    { id: 'backup', t: 'Backup e segurança dos dados', k: 'backup restaurar copia segurança dados',
      h: `<ol><li>Em <b>Configurações → Dados e nuvem → Backup</b>, clique em <b>Escolher pasta de backup</b> uma vez (de preferência uma pasta dentro do Google Drive ou OneDrive). Só funciona no Chrome ou Edge do computador.</li><li>Depois, <b>Fazer backup agora</b> (aqui, no aviso do topo ou no Assistente) grava o arquivo na pasta com um clique, sem janela de download. Sem pasta escolhida, o arquivo é baixado.</li><li>Para voltar atrás: <b>Restaurar backup</b>.</li></ol>
        <p>O app também faz cópias automáticas diárias dos últimos 7 dias, mas elas ficam neste mesmo navegador. Só o arquivo baixado protege se o navegador for limpo ou o computador trocado.</p>` },
    { id: 'foco', t: 'Menos coisa na tela', k: 'foco recolher menu blocos',
      h: `<p>Os títulos do menu lateral (Início, Operação, Gestão) recolhem e abrem ao clicar. Na Exportação e em Hoje, blocos secundários ficam recolhidos. O sistema lembra o que você abriu. Nada foi removido.</p>` }
  ];

  function manualHTML(q) {
    const n = String(q || '').trim().toLowerCase();
    const L = SEC.filter(s => !n || (s.t + ' ' + s.k + ' ' + s.h.replace(/<[^>]+>/g, ' ')).toLowerCase().includes(n));
    if (!L.length) return '<p class="note">Nada encontrado para essa busca. Tente outra palavra (ex.: "backup", "SEI", "desconto").</p>';
    return L.map(s => `<section class="gSec" id="g-${s.id}"><h3>${esc(s.t)}</h3>${s.h}</section>`).join('');
  }
  function openManual(sec) {
    close();
    const d = document.createElement('div'); d.id = 'guiaMod'; d.className = 'guiaBack'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Manual do sistema');
    d.innerHTML = `<div class="guiaBox"><div class="guiaHead"><b>Manual</b><input type="search" id="guiaQ" placeholder="Buscar no manual (ex.: backup, SEI, desconto)" aria-label="Buscar no manual"><button type="button" id="guiaTour" class="primary">Iniciar tour guiado</button><button type="button" id="guiaX" aria-label="Fechar manual">Fechar</button></div>
      <div class="guiaBody"><nav class="guiaToc" aria-label="Assuntos">${SEC.map(s => `<a href="#g-${s.id}" data-g="${s.id}">${esc(s.t)}</a>`).join('')}</nav><div class="guiaTxt" id="guiaTxt">${manualHTML('')}</div></div></div>`;
    document.body.appendChild(d);
    $('guiaQ').addEventListener('input', e => { $('guiaTxt').innerHTML = manualHTML(e.target.value); });
    d.addEventListener('click', e => {
      if (e.target === d || e.target.id === 'guiaX') return close();
      if (e.target.id === 'guiaTour') { close(); return startTour(); }
      const a = e.target.closest('[data-g]'); if (a) { e.preventDefault(); $('guiaQ').value = ''; $('guiaTxt').innerHTML = manualHTML(''); const el = $('g-' + a.dataset.g); if (el) el.scrollIntoView({ block: 'start' }); }
    });
    if (sec) { const el = $('g-' + sec); if (el) el.scrollIntoView({ block: 'start' }); } else $('guiaQ').focus();
    try { store.set('guiaVisto', 1); } catch (_) { /* ok */ } mark();
  }

  /* ---------- Tour guiado ---------- */
  const NAVV = k => `#nav [data-view="${k}"]`;
  const STEPS = [
    { t: 'Bem-vindo', x: 'Este tour mostra, em poucos passos, para que serve cada parte do menu. Dá para sair a qualquer momento e refazer depois.' },
    { t: 'Hoje', s: NAVV('hoje'), x: 'Seu ponto de partida. Mostra o que tem para fazer: programações do dia, fretes em aberto, pagamentos e a lista "Precisa de atenção".' },
    { t: 'Nacional', s: NAVV('pedido'), x: 'Cole o pedido do cliente, clique em Ler pedido e confira o resumo ao vivo. Daqui sai o documento e o registro no Histórico.' },
    { t: 'Exportação', s: NAVV('exp'), x: 'Pedidos para o exterior: voo, documentos do despachante, LPCO e valores. Os blocos que você usa menos ficam recolhidos.' },
    { t: 'Notas de entrada', s: NAVV('mapa'), x: 'NFs dos pescadores, saldo por espécie e os packs do MAPA/SEI. Tem checklist antes de protocolar e controle de devolvido ou indeferido.' },
    { t: 'Programação de voos', s: NAVV('embarque'), x: 'Monte os embarques por data e cliente. Ela alimenta cobrança, mortalidade e frete.' },
    { t: 'Frete', s: NAVV('frete'), x: 'CT-es, valores e quem já pagou o frete. O número no menu é a quantidade de pendências.' },
    { t: 'Histórico', s: NAVV('hist'), x: 'Pedidos já feitos. Aqui você registra mortalidade, aplica desconto à vista com prazo, copia a cobrança e marca que recebeu.' },
    { t: 'Financeiro', s: NAVV('financeiro'), x: 'O que está aguardando pagamento, o que atrasou e o que já entrou.' },
    { t: 'Assistente', s: '#assistSlot', x: 'Junta as pendências de todas as telas e deixa resolver pelo próprio aviso. Quando o número está vermelho, tem algo esperando.' },
    { t: 'Configurações e backup', s: '#btnCfg', x: 'Stocklist, menu, nuvem e Backup. Baixe um backup toda semana e guarde o arquivo fora do computador.' },
    { t: 'Pronto', x: 'Para rever, abra "Manual e tour" no menu lateral. O manual tem busca: digite "backup", "SEI" ou "desconto".' }
  ];
  let T = null;
  function visible(el) { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function startTour(i0) {
    close(); stopTour();
    T = { i: i0 || 0 };
    const sh = document.createElement('div'); sh.id = 'tourShade'; sh.className = 'tourShade';
    const bx = document.createElement('div'); bx.id = 'tourCard'; bx.className = 'tourCard'; bx.setAttribute('role', 'dialog'); bx.setAttribute('aria-label', 'Tour guiado');
    document.body.appendChild(sh); document.body.appendChild(bx);
    bx.addEventListener('click', e => {
      const a = e.target.closest('[data-t]'); if (!a) return;
      if (a.dataset.t === 'prox') { if (T.i >= STEPS.length - 1) return stopTour(true); T.i++; show(); }
      else if (a.dataset.t === 'volta') { if (T.i > 0) { T.i--; show(); } }
      else if (a.dataset.t === 'sair') stopTour(true);
      else if (a.dataset.t === 'manual') { stopTour(true); openManual(); }
    });
    window.addEventListener('resize', place); document.addEventListener('keydown', tourKey, true);
    show();
  }
  function tourKey(e) {
    if (!T) return;
    if (e.key === 'Escape') { e.preventDefault(); stopTour(true); }
    else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !(e.target.closest && e.target.closest('#tourCard button')))) { e.preventDefault(); if (T.i >= STEPS.length - 1) stopTour(true); else { T.i++; show(); } }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); if (T.i > 0) { T.i--; show(); } }
  }
  function show() {
    const st = STEPS[T.i], bx = $('tourCard'); if (!bx) return;
    const last = T.i === STEPS.length - 1;
    bx.innerHTML = `<div class="tourN">Passo ${T.i + 1} de ${STEPS.length}</div><h4>${esc(st.t)}</h4><p>${esc(st.x)}</p>
      <div class="tourBt"><button type="button" data-t="sair">${last ? 'Fechar' : 'Sair do tour'}</button>${T.i > 0 ? '<button type="button" data-t="volta">Voltar</button>' : ''}${last ? '<button type="button" data-t="manual">Abrir o manual</button>' : ''}<button type="button" class="primary" data-t="prox" id="tourNext">${last ? 'Concluir' : 'Próximo'}</button></div>`;
    const nx = $('tourNext'); if (nx) nx.focus({ preventScroll: true });
    place();
  }
  function place() {
    if (!T) return;
    const st = STEPS[T.i], bx = $('tourCard'), sh = $('tourShade'); if (!bx || !sh) return;
    let el = st.s ? document.querySelector(st.s) : null;
    if (el && !visible(el)) el = null; // menu recolhido ou tela pequena: mostra o cartão no centro, sem destaque
    if (el) { try { el.scrollIntoView({ block: 'nearest' }); } catch (_) { /* ok */ } }
    if (!el) { sh.style.cssText = ''; sh.classList.add('full'); bx.style.cssText = 'left:50%;top:50%;transform:translate(-50%,-50%)'; return; }
    sh.classList.remove('full');
    const r = el.getBoundingClientRect(), pad = 4;
    sh.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
    const bw = Math.min(340, window.innerWidth - 24), bh = bx.offsetHeight || 180;
    let left = r.right + 16, top = r.top + r.height / 2 - bh / 2;
    if (left + bw > window.innerWidth - 12) { left = Math.max(12, r.left); top = r.bottom + 14; if (top + bh > window.innerHeight - 12) top = Math.max(12, r.top - bh - 14); }
    top = Math.max(12, Math.min(top, window.innerHeight - bh - 12));
    bx.style.cssText = `left:${left}px;top:${top}px;width:${bw}px`;
  }
  function stopTour(done) {
    ['tourShade', 'tourCard'].forEach(i => { const e = $(i); if (e) e.remove(); });
    window.removeEventListener('resize', place); document.removeEventListener('keydown', tourKey, true);
    if (T && done) { try { store.set('tourVisto', 1); } catch (_) { /* ok */ } }
    T = null; mark();
  }
  function close() { const d = $('guiaMod'); if (d) d.remove(); }

  /* ---------- botão no menu lateral ---------- */
  function mark() { const b = $('btnGuia'); if (b) b.classList.toggle('novo', !store.get('guiaVisto', 0) && !store.get('tourVisto', 0)); }
  function mount() {
    const foot = document.querySelector('.sidefoot'); if (!foot || $('btnGuia')) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'btnGuia'; b.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><path d="M12 17v.01"/></svg>' + '<span>Manual e tour</span>';
    foot.insertBefore(b, foot.firstChild); b.addEventListener('click', () => { document.body.classList.remove('menu'); const mb = $('menuBack'); if (mb) mb.hidden = true; openManual(); });
    mark();
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('guiaMod') && !T) close(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();

  PP.guia = { openManual, startTour, stopTour, close, STEPS, SEC };
})();
