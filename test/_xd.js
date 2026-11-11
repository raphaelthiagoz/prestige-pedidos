
  /* ============================================================
     telas
     ============================================================ */
  const fld = (l, path, type = 'text', extra = '', cls = '') => `<div class="field ${cls}"><label>${l}</label><input type="${type}" data-xp="${path}" value="${esc(gv(path))}" ${extra}></div>`;
  const dname = d => d === 'inv' ? 'Invoice (US$)' : d === 'brl' ? 'Invoice em R$' : d === 'pl' ? 'Packing List' : d === 'et' ? 'Etiquetas' : d.startsWith('at:') ? ATN[d.slice(3)] : CZN[d.slice(3)].split(' (')[0];

  function ordTxt() { return S.ordem === 'manual' ? '<b>Ordem manual:</b> os documentos saem na ordem desta tabela. Arraste pela alça ⠿ (ou use ▲ ▼) para mover.' : `<b>Ordem automática:</b> ${(CFG.ordem || []).length ? 'primeiro as espécies da ordem guardada, depois ' : ''}as que mais saem (mais peixes) vêm primeiro. Arraste pela alça ⠿ (ou use ▲ ▼) para mover onde quiser.`; }
  function totalsLine() {
    const t = T();
    return `<span>Caixas: <b>${t.boxes}</b></span><span>Peixes: <b>${nB(t.fish)}</b></span><span>Peso: <b>${nB(t.kg)} kg</b></span><span>Peixes US$: <b>${nU(t.goods, 2)}</b></span><span>Package fee: <b>${nU(t.fee, 2)}</b></span><span>Total: <b>US$ ${nU(t.total, 2)}</b></span>`;
  }
  function warnHTML() {
    const m = missing();
    return m.length ? `<b>Ainda em branco:</b> ${m.slice(0, 12).map(esc).join(' · ')}${m.length > 12 ? ' · +' + (m.length - 12) : ''}. Os arquivos saem mesmo assim, com esses campos vazios para você completar no Word.` : '✓ Tudo preenchido.';
  }
  function docsCard() {
    const L = docList();
    return `<div class="xdocs">${L.map(d => `<div class="xdoc"><span>${esc(d.label)}</span><span class="muted">${esc(d.name)}${d.need ? ' — ' + esc(d.need) : ''}</span><button type="button" data-xdl="${d.id}" ${d.need ? 'disabled' : ''}>⬇ Baixar</button></div>`).join('')}</div>`;
  }
  /* ---------- prévia (sob demanda, editável) ---------- */
  function stageBody() {
    const D = DEST[S.dest];
    if (!S.items.length) return '<div class="empty">Carregue a stocklist respondida ou cole o pedido para ver os documentos.</div>';
    if (S.tab === 'inv') return invoice();
    if (S.tab === 'pl') return packing();
    if (S.tab === 'et') return labels();
    if (S.tab === 'at') { if (!D.atest.includes(S.sub.atest)) S.sub.atest = D.atest[0]; return atestado(S.sub.atest); }
    if (!D.czi.includes(S.sub.czi)) S.sub.czi = D.czi[0]; return czi(S.sub.czi);
  }
  function previewHTML() {
    const D = DEST[S.dest];
    const main = [['inv', 'Invoice'], ['pl', 'Packing List'], ['et', 'Etiquetas'], ['at', 'Atestados (' + D.atest.length + ')'], ['cz', 'CZI (' + D.czi.length + ')']];
    let sub = '';
    if (S.tab === 'inv' && S.conv.on) sub = `<div class="tabs sub"><button type="button" data-xiv="usd" aria-selected="${S.invView === 'usd'}">Invoice US$ (vai ao cliente)</button><button type="button" data-xiv="brl" aria-selected="${S.invView === 'brl'}">Convertida em R$ (para a NF)</button></div>`;
    if (S.tab === 'at') sub = `<div class="tabs sub">${D.atest.map(k => `<button type="button" data-xsub="atest:${k}" aria-selected="${S.sub.atest === k}">${ATN[k]}</button>`).join('')}</div>`;
    if (S.tab === 'cz') sub = `<div class="tabs sub">${D.czi.map(k => `<button type="button" data-xsub="czi:${k}" aria-selected="${S.sub.czi === k}">${CZN[k]}</button>`).join('')}</div>`;
    return `<div class="tabs">${main.map(([k, l]) => `<button type="button" data-xtab="${k}" aria-selected="${S.tab === k}">${l}</button>`).join('')}</div>${sub}<div class="xstage" id="xStage">${stageBody()}</div>`;
  }
  const prevOpen = () => !!$('xModal');
  function openPrev() {
    closePrev(true);
    const m = document.createElement('div'); m.id = 'xModal'; m.className = 'xmodal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Prévia dos documentos');
    m.innerHTML = `<div class="xmbox"><div class="row between" style="align-items:center"><h2>Prévia dos documentos · exportação ${numStr()} · ${DEST[S.dest].label}</h2><button type="button" class="primary" data-xa="closeprev">✕ Fechar prévia</button></div>
      <p class="note"><b>Clique em qualquer texto sublinhado</b> (nomes, quantidades, preços, NF, MAWB, GTA…) para corrigir: a mudança vale para todos os documentos e para a tela do pedido. Campos <span class="blank">amarelos</span> estão em branco. Os arquivos baixados saem no <b>seu modelo</b> (xlsx/docx), com o layout exato; esta prévia é aproximada.</p>
      <div id="xPrev" class="xprev">${previewHTML()}</div></div>`;
    document.body.appendChild(m); document.body.classList.add('xnoscroll');
    m.addEventListener('mousedown', e => { if (e.target === m) closePrev(); });
  }
  function closePrev(silent) {
    const m = $('xModal'); if (m) m.remove(); document.body.classList.remove('xnoscroll');
    if (!silent && PPx.S.view === 'exp') render();
  }
  function renderPrev() { const p = $('xPrev'); if (p) p.innerHTML = previewHTML(); }
  function refreshStage() { const st = $('xStage'); if (!st) return; const sc = st.scrollTop; st.innerHTML = stageBody(); st.scrollTop = sc; }

  function renderExp() {
    const D = DEST[S.dest], el = $('vExp');
    const act = document.activeElement, keep = act && act.dataset && (act.dataset.xp || (act.dataset.xi != null ? act.dataset.xi + ':' + act.dataset.xk : null));
    el.innerHTML = `${xTabs()}
    <section class="step"><div class="row between" style="align-items:center"><h2>Destino e numeração</h2><div class="row"><button type="button" class="primary" data-xa="prev">👁 Ver prévia dos documentos</button><button type="button" data-xa="novo">Nova exportação</button></div></div>
      <div class="row" style="align-items:flex-end">
        <div class="field grow"><label>Destino</label><div class="chips">${Object.entries(DEST).map(([k, v]) => `<button type="button" class="xchip" data-xdest="${k}" aria-pressed="${S.dest === k}">${v.label}</button>`).join('')}</div></div>
        <div class="field" style="flex:0 0 150px"><label>Nº desta exportação</label><div class="xbig">${numStr()}</div></div>
        ${fld('Data', 'date', 'date', '', '')}
      </div>
      <p class="note">Escolhendo o destino, o consignee, os atestados e os CZIs mudam sozinhos. O mesmo nº vale para invoice, packing list, atestados e CZI. As exportações já feitas ficam no <b>Histórico</b>.${S.curId ? ' <b>Esta exportação já está salva no histórico.</b>' : ''}</p>
      <details class="xdet" id="xNum" ${S.numOpen ? 'open' : ''}><summary>Numeração das exportações <span class="muted">· última usada ${p3(CFG.last)}/${CFG.ano} — próxima ${p3(CFG.last + 1)}/${CFG.ano}</span></summary>
        <div class="row" style="margin-top:8px"><div class="field" style="flex:0 1 190px"><label for="xLast">Última invoice usada (nº)</label><input type="number" min="0" id="xLast" value="${CFG.last}"></div><div class="field" style="flex:0 1 120px"><label for="xAno">Ano</label><input type="number" id="xAno" value="${CFG.ano}"></div>
        <div class="field grow"><label>Já usados</label><span class="note">${(CFG.used || []).slice().sort((a, b) => b.n - a.n).map(u => `${p3(u.n)} (${esc((DEST[u.d] || {}).label || u.d)} · ${esc(u.dt)})`).join(' · ') || '—'}</span></div></div>
        <p class="note">Ajuste a "última usada" quando quiser (hoje está em 017, a próxima é 018). Ao baixar o .zip ou salvar, o app avança sozinho. Vale só para exportações.</p></details></section>
    <div class="xgrid"><div class="xleft">
      <section class="step"><h2>Pedido do cliente</h2>
        <div class="row"><div class="field grow"><label>Stocklist de exportação respondida (.xlsx)</label><input type="file" id="xFile" accept=".xlsx"><p class="note">Lê a coluna "Order …" (caixas). Fica guardada para colar pedidos de texto depois.</p></div>
          <div class="field grow"><label>Ou cole o pedido (uma linha por espécie: <span class="mono">8 corydoras schwartzi</span>)</label><textarea id="xTxt" spellcheck="false" style="min-height:70px"></textarea><div class="row"><button type="button" data-xa="addtxt">Adicionar do texto</button></div></div></div>
        <p class="note" id="xMsg" role="status">${esc(S.msg || '')}</p>
        <div class="tablewrap"><table class="xit"><thead><tr><th></th><th>Espécie</th><th>Nome comum</th><th>Caixas</th><th>Qtd/cx</th><th>US$/peixe</th><th>Kg/cx</th><th></th></tr></thead><tbody>
        ${S.items.map((x, i) => `<tr data-xrow="${i}"><td style="white-space:nowrap"><span class="grip" draggable="true" data-xgrip="${i}" title="Arraste para mudar a ordem" aria-hidden="true">⠿</span><button type="button" class="mv" data-xmv="-1" data-xi2="${i}" aria-label="Subir linha ${i + 1}">▲</button><button type="button" class="mv" data-xmv="1" data-xi2="${i}" aria-label="Descer linha ${i + 1}">▼</button></td><td><input data-xi="${i}" data-xk="sci" value="${esc(x.sci)}"></td><td><input data-xi="${i}" data-xk="pt" value="${esc(x.pt)}" class="${x.pt ? '' : 'xblank'}"></td><td><input data-xi="${i}" data-xk="boxes" type="number" min="0" value="${esc(x.boxes)}" style="width:62px"></td><td><input data-xi="${i}" data-xk="qpb" type="number" min="0" value="${esc(x.qpb)}" style="width:72px"></td><td><input data-xi="${i}" data-xk="price" type="number" step="0.01" min="0" value="${esc(x.price)}" style="width:72px"></td><td><input data-xi="${i}" data-xk="kg" type="number" min="0" step="0.5" value="${esc(x.kg)}" placeholder="${unitKg()}" style="width:62px"></td><td><button type="button" class="danger" data-xdel="${i}" title="Remover linha" aria-label="Remover linha">✕</button></td></tr>`).join('')}</tbody></table></div>
        <div class="row"><button type="button" data-xa="addrow">+ Adicionar espécie</button></div>
        <div class="xtot" id="xTot">${totalsLine()}</div>
        <div class="row" style="align-items:center"><span class="note" id="xOrdTxt" style="flex:1 1 260px">${ordTxt()}</span><button type="button" data-xa="ordauto" ${S.ordem === 'manual' ? '' : 'hidden'}>↺ Voltar à ordem automática</button><button type="button" data-xa="ordsave">Guardar esta ordem para os próximos pedidos</button>${(CFG.ordem || []).length ? '<button type="button" data-xa="ordclear">Apagar ordem guardada</button>' : ''}</div></section>
      <details class="step xdet" id="xCons" ${S.consOpen ? 'open' : ''}><summary>Consignee: <b>${esc(S.cons.name)}</b> <span class="muted">· ${esc(S.cons.addrAt)} — clique para editar</span></summary>
        <div class="row">${fld('Nome (invoice, packing, etiquetas, CZI)', 'cons.name', 'text', '', 'grow')}${fld('Nome nos atestados', 'cons.nameAt')}</div>
        <div class="row">${fld('Endereço – linha 1 (invoice/packing)', 'cons.addr')}${fld('Linha 2 (cidade / país)', 'cons.addr2')}</div>
        <div class="row">${fld('Endereço em uma linha (atestados e CZI)', 'cons.addrAt', 'text', '', 'grow')}${fld('País (atestado)', 'cons.country')}</div>
        <div class="row">${fld('Telefone', 'cons.phone')}${fld('E-mail', 'cons.email')}${S.dest !== 'MIA' ? fld('Posto fronteiriço (CZI)', 'cons.border') : ''}</div>
        <div class="row">${fld('Etiqueta – endereço', 'cons.lab1', 'text', '', 'grow')}${fld('Etiqueta – cidade / país', 'cons.lab2', 'text', '', 'grow')}</div>
        <p class="note">Mudou o endereço do cliente? Edite aqui: fica salvo para as próximas exportações deste destino.</p></details>
    </div><div class="xleft">
      <section class="step"><h2>Dados da exportação (você digita a cada pedido)</h2>
        <div class="row">${fld('Nota Fiscal nº', 'ex.nf', 'text', 'placeholder="00008941/8942 S-2"')}${fld('Aeroporto de saída', 'ex.aero')}${fld('DU-E', 'ex.dued', 'text', 'placeholder="26BR001971465-1"')}</div>
        <div class="row">${fld('MAWB', 'ex.mawb', 'text', 'placeholder="074-70222390"')}${fld('HAWB', 'ex.hawb')}${fld('AWB', 'ex.awb')}</div>
        <div class="row">${fld('Voo internacional (nº)', 'ex.voo', 'text', 'placeholder="KL0792"')}${fld('Partida (data/hora)', 'ex.dep', 'datetime-local')}</div>
        <div class="row">${fld('GTA nº', 'ex.gta')}${fld('Série da GTA', 'ex.serie')}${fld('Package fee (US$/caixa)', 'ex.fee', 'number', 'step="0.5" min="0"')}</div>
        <div class="row">${fld('Data de embalagem', 'ex.pkDate', 'date')}${fld('Hora de embalagem', 'ex.pkTime')}${fld('Oxigênio', 'ex.oxy')}${fld('Temperatura', 'ex.temp')}</div>
        <h2>LPCO (recebidos por você)</h2>
        <div class="row">${fld('LPCO MAPA → vai no CZI', 'ex.lpcoMapa', 'text', 'placeholder="E2600665213"')}${fld('LPCO IBAMA → vai nas etiquetas', 'ex.lpcoIbama', 'text', 'placeholder="E2600604683"')}</div>
        <p class="note" id="xCert">${certNote()}</p></section>
      <section class="step"><h2>Conversão para real (para a Nota Fiscal)</h2>
        <label style="display:flex;gap:8px;align-items:center;color:var(--fg);font-size:.9rem"><input type="checkbox" data-xp="conv.on" ${S.conv.on ? 'checked' : ''}> Gerar também a invoice convertida em R$ (uso interno, não vai ao cliente)</label>
        ${S.conv.on ? `<div class="row">${fld('Data da cotação', 'conv.date', 'date')}${fld('Dólar PTAX compra (R$)', 'conv.rate', 'number', 'step="0.0001" min="0"')}<div class="field" style="flex:0 0 auto;justify-content:flex-end"><button type="button" data-xa="ptax">⟳ Buscar PTAX do dia (Banco Central)</button></div></div><p class="note" id="xPtmsg" role="status">${esc(S.conv.msg || 'Sem internet ou em fim de semana/feriado, o app usa o último dia útil; você também pode digitar a cotação.')}</p>` : ''}</section>
      <section class="step"><h2>Documentos desta exportação</h2>
        <div class="warnbox" id="xWarn">${warnHTML()}</div><div id="xDocs">${docsCard()}</div>
        <div class="row"><button type="button" class="primary" data-xa="zip">⬇ Baixar todos (.zip) e salvar</button><button type="button" data-xa="prev">👁 Ver prévia</button><button type="button" data-xa="save">Salvar no histórico</button><button type="button" data-xa="rot">✓ Abrir roteiro</button></div></section>
    </div></div>`;
    if (keep) { try { const sel = keep.includes(':') ? `[data-xi="${keep.split(':')[0]}"][data-xk="${keep.split(':')[1]}"]` : `[data-xp="${keep}"]`, n = el.querySelector(sel); if (n) { n.focus(); if (n.setSelectionRange && /text|search/.test(n.type || '')) n.setSelectionRange(n.value.length, n.value.length); } } catch (_) { /* ok */ } }
    persist();
  }
  function certNote() {
    const D = DEST[S.dest], c = k => { const m = S.ex.lpcoMapa; if (!m) return '(LPCO MAPA em branco)'; const suf = S.dest === 'JPN' ? (k === 'JP' ? '-1' : k === 'DE' ? '-2' : '') : ''; return m.replace(/\/SEV-GRU$/i, '') + suf + '/SEV-GRU'; };
    return `Nº do certificado no CZI: <b>${D.czi.map(k => esc(c(k))).join('  ·  ')}</b> (o app acrescenta "/SEV-GRU"${S.dest === 'JPN' ? '; no Japão, -1 no CZI do Japão e -2 no da Alemanha' : ''}).`;
  }
  // atualiza só o que depende dos valores digitados, sem recriar os campos (o foco não se perde)
  function liveForm() {
    const g = id => $(id); if (g('xTot')) g('xTot').innerHTML = totalsLine(); if (g('xWarn')) g('xWarn').innerHTML = warnHTML(); if (g('xDocs')) g('xDocs').innerHTML = docsCard(); if (g('xCert')) g('xCert').innerHTML = certNote();
    persist();
  }
  function live() { liveForm(); if (prevOpen()) refreshStage(); }
  function liveMsgs() { const p = $('xPtmsg'); if (p) p.textContent = S.conv.msg || ''; }

  /* ---------- Roteiro (revisão) ---------- */
  const ST_L = { p: 'Pendente', r: 'Refazer', o: 'OK' };
  const stOf = k => (S.rot.st && S.rot.st[k]) || 'p';
  function rotItems() {
    const D = DEST[S.dest], T0 = T(), sis = D.atest.filter(k => k !== 'VIG');
    return [
      { k: 'inv', l: 'INVOICE', app: 'inv', need: [] },
      { k: 'nf', l: 'NOTA FISCAL', note: 'emitida à parte; o valor em R$ está em Pedido › Invoice › Convertida' },
      { k: 'pl', l: 'PACKING LIST', app: 'pl', need: [] },
      { k: 'etg', l: 'ETIQUETAS MAIORES', app: 'et', need: [['NF', 'ex.nf'], ['LPCO IBAMA', 'ex.lpcoIbama'], ['DU-E', 'ex.dued']] },
      { k: 'etm', l: 'ETIQUETAS MENORES', note: 'ainda sem modelo no app; confira à parte' },
      { k: 'gta', l: 'GTA', need2: [['GTA nº', 'ex.gta'], ['Série', 'ex.serie']] },
      { k: 'czi', l: 'CZI' + (D.czi.length > 1 ? ' (2 CZIs)' : ''), app: 'cz', need: [['LPCO MAPA', 'ex.lpcoMapa'], ['MAWB', 'ex.mawb'], ['Partida', 'ex.dep']] },
      { k: 'req', l: 'REQUERIMENTO', note: 'preenchido e assinado (fora do app)' },
      { k: 'ent', l: 'NOTAS DE ENTRADA', note: 'cobrem as espécies e quantidades?' },
      { k: 'sisa', l: 'ATESTADO SISA' + (sis.length > 1 ? ' (2: ' + sis.map(k => k === 'JP' ? 'Japão' : 'Europa').join(' + ') + ')' : ''), app: 'at', sub: sis[0], need: [] },
      { k: 'vig', l: 'ATESTADO VIGIAGRO', app: 'at', sub: 'VIG', need: [['GTA', 'ex.gta']] },
      { k: 'mawb', l: 'MAWB', need2: [['MAWB', 'ex.mawb']] },
      { k: 'lpcoI', l: 'LPCO IBAMA', need2: [['LPCO IBAMA', 'ex.lpcoIbama']] },
      { k: 'lpcoM', l: 'LPCO MAPA', need2: [['LPCO MAPA', 'ex.lpcoMapa']] },
      { k: 'due', l: 'DU-E', need2: [['DU-E', 'ex.dued']] },
      { k: 'awb', l: 'AWB', need2: [['AWB', 'ex.awb']] },
      { k: 'hawb', l: 'HAWB', need2: [['HAWB', 'ex.hawb']] },
      { k: 'voo', l: 'INFO DO VOO (nacional + internacional, horários)', need2: [['Voo internacional', 'ex.voo'], ['Partida', 'ex.dep']] },
      { k: 'peso', l: 'PESO DAS CAIXAS E QUANTIDADES', calc: `${T0.boxes} caixas · ${nB(T0.kg)} kg · ${nB(T0.fish)} peixes`, note: 'vem do pedido; confira com a balança e a contagem' }
    ];
  }
  function rvGroups() {
    const its = rotItems();
    return [{ t: 'Documentos e dados', id: 'g1', it: its },
      { t: 'Anexar no MAPA', id: 'g2', it: [['m_req', 'REQUERIMENTO PREENCHIDO E ASSINADO'], ['m_pl', 'PACKING LIST ASSINADO'], ['m_at', 'ATESTADOS SISA E VIGIAGRO ASSINADOS NO DIA'], ['m_ent', 'NOTAS DE ENTRADA'], ['m_czi', 'CZI']].map(([k, l]) => ({ k, l })) },
      { t: 'Imprimir', id: 'g3', it: [['p_nf', 'NOTA FISCAL'], ['p_pl', 'PACKING LIST'], ['p_gta', 'GTA'], ['p_vig', 'ATESTADO VIGIAGRO'], ['p_laudo', 'LAUDOS DAS CAIXAS']].map(([k, l]) => ({ k, l })) },
      { t: 'Despachante', id: 'g4', it: [{ k: 'desp', l: 'ENVIAR TUDO POR E-MAIL PARA O DESPACHANTE', mail: true }] }];
  }
  function mailText() {
    const D = DEST[S.dest], t = T();
    return `Assunto: Exportação ${numStr()} – ${D.label} – documentos\n\nBom dia,\n\nSegue em anexo a documentação da exportação ${numStr()} (${S.cons.name}, ${D.label}):\n• Invoice\n• Packing List\n• Nota Fiscal\n• GTA\n• Atestados SISA e Vigiagro (assinados)\n• CZI\n• MAWB / HAWB\n• Notas de entrada\n• Requerimento assinado\n\nCaixas: ${t.boxes} · Peso: ${nB(t.kg)} kg · Peixes: ${nB(t.fish)}\nMAWB: ${S.ex.mawb || '—'} · Voo: ${S.ex.voo || '—'}\n\nAtenciosamente,\nPrestige Aquarium`;
  }
  function rvRow(it) {
    const st = stOf(it.k); let hint = '';
    const need = (it.need || []).concat(it.need2 || []).filter(([, p]) => !gv(p));
    if (need.length && (it.app || it.need2)) hint = `<div class="miss">faltam dados no pedido: ${need.map(x => esc(x[0])).join(', ')}</div>`;
    const mail = it.mail ? `<details style="margin-top:6px"><summary class="muted" style="cursor:pointer">Texto de e-mail pronto (copiar e colar)</summary><textarea id="xMail" style="min-height:190px;margin-top:6px">${esc(mailText())}</textarea><button type="button" data-xa="copymail" style="margin-top:6px">Copiar texto</button></details>` : '';
    const hasN = !!((S.rot.nt || {})[it.k]), open = hasN || (S.rot.no && S.rot.no[it.k]);
    return `<div class="rv s-${st}" id="rv_${it.k}"><div class="rvl"><div class="nm">${esc(it.l)}</div>${it.note ? `<div class="sm">${esc(it.note)}</div>` : ''}${it.calc ? `<div class="sm" style="color:var(--accent)">${esc(it.calc)}</div>` : ''}${hint}${mail}</div>
      <div class="seg3" role="group" aria-label="${esc(it.l)}">${['p', 'r', 'o'].map(v => `<button type="button" data-xst="${it.k}:${v}" class="${st === v ? 'on ' + v : ''}">${v === 'p' ? '✗' : v === 'r' ? '↻' : '✓'} ${ST_L[v]}</button>`).join('')}</div>
      <div class="rva">${it.app ? `<button type="button" class="ib" data-xrotgo="${it.app}" ${it.sub ? `data-xrsub="${it.sub}"` : ''} title="Ver no pedido" aria-label="Ver no pedido">↗</button>` : ''}<button type="button" class="ib ${hasN ? 'has' : ''}" data-xnote="${it.k}" title="Anotação" aria-label="Anotação">✎</button></div>
      ${open ? `<input class="rvn" data-xnt="${it.k}" placeholder="anotação (ex.: conferido 14:10, nº do voo…)" value="${esc((S.rot.nt || {})[it.k] || '')}">` : ''}</div>`;
  }
  const nOk = () => { const G = rvGroups(), all = G.flatMap(g => g.it); return [all.filter(i => stOf(i.k) === 'o').length, all.length]; };
  function xTabs() { const [o, n] = nOk(); return `<div class="tabs" role="tablist" aria-label="Exportação"><button type="button" data-xa="vped" aria-selected="${S.xview !== 'rot'}">Pedido de exportação</button><button type="button" data-xa="vrot" aria-selected="${S.xview === 'rot'}">Roteiro ✓ <span class="muted">${o}/${n}</span></button></div>`; }
  function renderRot() {
    const G = rvGroups(), all = G.flatMap(g => g.it), n = all.length, c = { p: 0, r: 0, o: 0 };
    all.forEach(i => c[stOf(i.k)]++);
    const falta = G.map(g => ({ g, it: g.it.filter(i => stOf(i.k) !== 'o') })).filter(x => x.it.length);
    const L = falta.flatMap(x => x.it).sort((x, y) => (stOf(x.k) === 'r' ? 0 : 1) - (stOf(y.k) === 'r' ? 0 : 1)), sh = L.slice(0, 8);
    $('vExp').innerHTML = `${xTabs()}<section class="step"><h2>Roteiro de revisão · exportação ${numStr()} · ${DEST[S.dest].label}</h2>
      <p class="note">Marque o que você já conferiu. É só um roteiro: não muda nada nos documentos. ${S.curId ? 'O que você marca fica salvo com esta exportação.' : 'Salve a exportação no histórico para guardar o roteiro com ela.'}</p>
      <div class="row" style="align-items:center;gap:16px"><div class="field" style="flex:2"><div class="xbar"><i style="width:${Math.round(c.o / n * 100)}%"></i></div></div><span><b style="color:var(--ok)">${c.o} OK</b> · <b style="color:var(--bad)">${c.r} refazer</b> · <b style="color:var(--warn)">${c.p} pendentes</b> <span class="muted">de ${n}</span></span></div>
      ${c.o === n ? '<div class="okbox">✅ <b>Tudo conferido.</b> Pode embarcar.</div>' : `<div><div class="muted" style="margin-bottom:4px">O que ainda acusa (clique para ir até o item):</div><div class="chips">${sh.map(i => `<button type="button" class="xchip ${stOf(i.k) === 'r' ? 'rf' : 'pd'}" data-xjump="${i.k}">${stOf(i.k) === 'r' ? '↻' : '✗'} ${esc(i.l.length > 30 ? i.l.slice(0, 28) + '…' : i.l)}</button>`).join('')}${L.length > 8 ? `<span class="muted" style="align-self:center">+ ${L.length - 8} itens abaixo</span>` : ''}</div></div>`}
      <div class="row noprint"><label style="display:flex;gap:6px;align-items:center;color:var(--fg)"><input type="checkbox" id="xRotOnly" ${S.rot.only ? 'checked' : ''}> Mostrar só o que falta</label><button type="button" data-xa="rotprint">🖨 Imprimir roteiro</button><button type="button" data-xa="rotclear">Zerar roteiro</button><button type="button" data-xa="save">Salvar roteiro no histórico</button></div></section>
      <div class="rvgrid">${[[G[0]], [G[1], G[2], G[3]]].map(col => `<div class="rvcol">${col.map(g => { const its = S.rot.only ? g.it.filter(i => stOf(i.k) !== 'o') : g.it, ok = g.it.filter(i => stOf(i.k) === 'o').length; return `<section class="step"><h2>${g.t} — ${ok}/${g.it.length}</h2>${its.map(rvRow).join('') || '<p class="note">Tudo OK aqui ✓</p>'}</section>`; }).join('')}</div>`).join('')}</div>`;
  }

  /* ---------- exportações no Histórico ---------- */
  function histHTML() {
    const L = HIST.slice().sort((a, b) => b.n - a.n);
    return `<section class="step" id="xHist"><div class="row between"><h2>Exportações ✈</h2><span class="muted">${L.length} salva(s)</span></div>${L.length ? `<div class="tablewrap"><table class="xit"><thead><tr><th>Nº</th><th>Destino</th><th>Data</th><th>Cliente</th><th class="n">Caixas</th><th class="n">Total US$</th><th>Roteiro</th><th></th></tr></thead><tbody>${L.map(e => { const k = Object.values((e.rot && e.rot.st) || {}).filter(v => v === 'o').length; return `<tr><td>${p3(e.n)}/${e.ano}</td><td>${esc(DEST[e.dest].label)}</td><td>${dBR(e.dateISO)}</td><td>${esc(e.cons.name)}</td><td class="n">${e.tot.boxes}</td><td class="n">${nU(e.tot.total, 2)}</td><td>${k}/30 OK</td><td style="white-space:nowrap"><button type="button" data-xopen="${e.id}">Abrir</button> <button type="button" class="danger" data-xdelh="${e.id}" aria-label="Excluir">✕</button></td></tr>`; }).join('')}</tbody></table></div>` : '<p class="note">Nenhuma exportação salva ainda. Elas entram aqui quando você baixa o .zip ou salva na aba Exportação.</p>'}</section>`;
  }

  function render(v) { if (S.xview === 'rot') renderRot(); else renderExp(); }
