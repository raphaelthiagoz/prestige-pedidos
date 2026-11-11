/* Prestige Pedidos — tela. Tudo roda no navegador; os dados ficam no localStorage. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = n => n.toLocaleString('pt-BR');
  const fmt2 = n => (Math.round(n * 10000) / 10000).toString();
  const bufToB64 = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const clone = o => JSON.parse(JSON.stringify(o));
  const docs = Docs.make({ ExcelJS: window.ExcelJS, docx: window.docx, logoPngB64: window.LOGO_PNG_B64, logoJpgB64: window.LOGO_JPG_B64, JSZip: window.JSZip, tplNotinhaB64: window.TPL_NOTINHA_B64, tplEtiquetasB64: window.TPL_ETIQUETAS_B64, tplPackingB64: window.TPL_PACKING_B64, tplInvoiceB64: window.TPL_INVOICE_B64, tplEmbarqueB64: window.TPL_EMBARQUE_B64 });

  /* ---------- armazenamento ---------- */
  const SYNCED = ['embarques', 'catalog', 'catalogInfo', 'catStamp', 'stockFile', 'clientes', 'cfg', 'hist', 'expcfg', 'exphist', 'fretes', 'tarefas', 'kanban', 'mapa'];
  const listeners = [];
  const store = {
    get(k, d) { try { const v = localStorage.getItem('pp.' + k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    del(k) { try { localStorage.removeItem('pp.' + k); } catch (_) { /* ok */ } },
    set(k, v) {
      try { localStorage.setItem('pp.' + k, JSON.stringify(v)); store.cheio = false; } catch (_) { if (!store.cheio) { store.cheio = true; setTimeout(() => { try { window.PP.toast('ATENÇÃO: o navegador ficou sem espaço e a última alteração NÃO foi salva. Baixe um backup agora (Configurações > Dados e nuvem) e me avise.', 'bad'); window.PP.renderBanners(); } catch (__) { /* ok */ } }, 50); } }
      if (SYNCED.includes(k)) { try { localStorage.setItem('pp.mod', String(Date.now())); } catch (_) { /* ok */ } listeners.forEach(f => f(k)); }
    },
  };
  const S = {
    catalog: store.get('catalog', []),
    catalogInfo: store.get('catalogInfo', ''),
    catStamp: store.get('catStamp', 0),
    clientes: store.get('clientes', []),
    hist: store.get('hist', []),
    embarques: store.get('embarques', []),
    cfg: Object.assign(clone(Core.DEFAULT_CFG), store.get('cfg', {})),
    cli: 0, rows: [], ignored: [], tab: 'invoice', view: 'pedido', curId: null, credit: false,
    moeda: { usd: false, en: false, taxa: 5.5 },
    nota: { rows: [], sig: '' },
    orc: { pct: 0 },
  };
  // preços e estoque "de verdade": desconto/preço do cliente e caixas que já saíram em pedidos salvos
  let _eff = null;
  const invalidate = () => { _eff = null; };
  const cat = () => (_eff || (_eff = Features.effCatalog(S.catalog, Features.soldBoxes(S.hist, S.catStamp, S.curId), S.clientes[S.cli])));
  // carimbo "upd" automático: toda alteração num pedido do histórico (pagamento, mortalidade, NF, cancelamento…) marca a hora,
  // para a sincronização saber qual versão é a mais nova quando dois aparelhos mexem ao mesmo tempo
  const _hsig = new Map();
  const histSig = e => { const u = e.upd; delete e.upd; const j = JSON.stringify(e); if (u !== undefined) e.upd = u; return j; };
  // lixeira: todo pedido que sai do histórico (apagado aqui ou pela sincronização) fica guardado para restaurar
  const lixo = (json, motivo) => { try { const e = JSON.parse(json), L = store.get('histLixo', []); L.unshift({ e, quando: Date.now(), motivo }); store.set('histLixo', L.slice(0, 60)); } catch (_) { /* ok */ } };
  const histSnap = () => { _hsig.clear(); (S.hist || []).forEach(e => { if (e && e.id !== undefined) _hsig.set(e.id, histSig(e)); }); };
  const saveHist = () => {
    const agora = Date.now(), vivos = new Set((S.hist || []).map(e => e && e.id));
    _hsig.forEach((j, id) => { if (!vivos.has(id)) { lixo(j, 'apagado neste aparelho'); _hsig.delete(id); } });
    (S.hist || []).forEach(e => { if (!e || e.id === undefined) return; const g = histSig(e), o = _hsig.get(e.id); if (o !== undefined && o !== g) e.upd = Math.max(agora, (e.upd || 0) + 1); _hsig.set(e.id, g); });
    store.set('hist', S.hist); invalidate();
  };
  histSnap();
  // garante sub-objetos novos em configs antigas
  ['apelidos', 'apelidosNota', 'etiquetas'].forEach(k => { S.cfg[k] = Object.assign({}, Core.DEFAULT_CFG[k], S.cfg[k] || {}); });
  ['empresa', 'vet', 'valores', 'numeracao', 'embarque'].forEach(k => { S.cfg[k] = Object.assign({}, Core.DEFAULT_CFG[k], S.cfg[k] || {}); });
  S.cfg.prazoPag = S.cfg.prazoPag || 7; S.cfg.prazoExpCobrar = S.cfg.prazoExpCobrar || 10; S.cfg.prazoExpAtraso = S.cfg.prazoExpAtraso || 15;
  const saveCfg = () => store.set('cfg', S.cfg);
  const saveClientes = () => store.set('clientes', S.clientes);

  /* ---------- configurações ---------- */
  const SPEC = {
    cfgValores: [['valores.gtaBase', 'GTA base (R$)', 'number'], ['valores.gtaMilheiro', 'GTA por milheiro (R$)', 'number'], ['valores.embalagem', 'Embalagem por caixa (R$)', 'number'],
      ['valores.caixaMaior', 'Caixa maior (R$)', 'number'], ['valores.atestado', 'Atestado (R$)', 'number'], ['valores.kgCaixa', 'Peso por caixa (kg)', 'number']],
    cfgEmpresa: [['empresa.cnpj', 'CNPJ'], ['empresa.ie', 'Inscrição estadual'], ['empresa.endereco', 'Endereço'], ['empresa.cep', 'CEP'], ['empresa.cidade', 'Cidade'], ['empresa.email', 'E-mail (opcional)'], ['empresa.enderecoAtestado', 'Endereço no atestado']],
    cfgVet: [['vet.nome', 'Nome'], ['vet.crmv', 'CRMV'], ['vet.celular', 'Celular']],
    cfgEtiq: [['etiquetas.porPagina', 'Etiquetas por página (6 ou 8)', 'number']],
    cfgEmb: [['embarque.dim', 'Dimensão padrão das caixas']],
    cfgNum: [['numeracao.ultimaInvoice', 'Última invoice emitida', 'number'], ['numeracao.ultimoAtestado', 'Último atestado emitido', 'number'], ['prazoPag', 'Prazo de pagamento nacional (dias)', 'number'], ['prazoExpCobrar', 'Exportação: cobrar a partir de (dias após a chegada)', 'number'], ['prazoExpAtraso', 'Exportação: atrasado após (dias após a chegada)', 'number']],
  };
  const getPath = (o, p) => p.split('.').reduce((a, k) => a[k], o);
  const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
  function renderConfigForms() {
    Object.entries(SPEC).forEach(([id, list]) => {
      $(id).innerHTML = list.map(([p, label, type]) => `<div class="field"><label for="c_${p}">${label}</label><input id="c_${p}" data-path="${p}" data-type="${type || 'text'}" type="${type === 'number' ? 'number' : 'text'}" ${type === 'number' ? 'step="0.01"' : ''} value="${esc(getPath(S.cfg, p))}"></div>`).join('');
    });
  }
  function renderNames() {
    $('apDoc').value = Core.apelidosToText(S.cfg.apelidos); $('apNota').value = Core.apelidosToText(S.cfg.apelidosNota);
  }
  ['apDoc', 'apNota'].forEach(id => $(id).addEventListener('input', e => {
    S.cfg[id === 'apDoc' ? 'apelidos' : 'apelidosNota'] = Core.parseApelidos(e.target.value); saveCfg(); S.nota.sig = null; renderAll();
  }));
  document.addEventListener('input', e => {
    const p = e.target.dataset && e.target.dataset.path; if (!p) return;
    const v = e.target.dataset.type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value;
    setPath(S.cfg, p, v); saveCfg();
    if (p.startsWith('valores.')) { applyExDefaults(); renderAll(); } else if (p.startsWith('numeracao.')) { if (!S.curId) initNumbers(); renderAll(); } else if (p === 'prazoPag' || p === 'prazoExpCobrar' || p === 'prazoExpAtraso') { if (S.view !== 'pedido') PP.extra && PP.extra.refresh(); } else renderDoc();
  });

  /* ---------- stocklist ---------- */
  async function loadWorkbook(file) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    return wb;
  }
  $('fStock').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const wb = await loadWorkbook(f);
      const r = Core.parseStocklistWorksheet(wb.worksheets[0]);
      if (r.error || !r.items.length) { $('stockmsg').textContent = r.error || 'Nenhum item encontrado.'; return; }
      S.catalog = r.items.map(i => Object.assign({}, i, { pedido: 0 }));
      S.catalogInfo = `${f.name} · ${new Date().toLocaleDateString('pt-BR')}`;
      S.catStamp = Date.now(); // pedidos salvos antes desta stocklist não descontam mais do estoque
      store.set('catalog', S.catalog); store.set('catalogInfo', S.catalogInfo); store.set('catStamp', S.catStamp);
      try { store.set('stockFile', { name: f.name, b64: bufToB64(await f.arrayBuffer()), estoqueCol: r.cols.estoque || 0 }); } catch (_) { /* arquivo grande demais para guardar: só não exporta a stocklist atualizada */ }
      invalidate(); newOrder(true);
      $('stockmsg').textContent = `${S.catalog.length} itens carregados.`;
      refreshCatInfo(); renderAll();
    } catch (err) { $('stockmsg').textContent = 'Não consegui abrir esse arquivo. Use a stocklist em .xlsx.'; console.error(err); }
  });
  function refreshCatInfo() { $('catinfo').textContent = S.catalog.length ? `Stocklist: ${S.catalog.length} itens · ${S.catalogInfo}` : 'Nenhuma stocklist carregada. Abra Configurações e envie a sua.'; }

  /* ---------- clientes ---------- */
  function renderClientes() {
    const sel = $('cliente');
    sel.innerHTML = S.clientes.length ? S.clientes.map((c, i) => `<option value="${i}" ${i === S.cli ? 'selected' : ''}>${esc(c.nome)}</option>`).join('') : '<option value="">Cadastre um cliente (botão Novo)</option>';
    const c = S.clientes[S.cli];
    $('cliEdit').hidden = !c;
    if (c) { $('cliNome').value = c.nome; $('cliEnd').value = c.end || ''; $('cliAero').value = c.aero || ''; $('cliCidade').value = c.cidade || ''; $('cliDesc').value = c.desc || ''; $('cliPrecos').value = c.precos || ''; }
    const cr = c ? Features.creditoCliente(S.hist, c.nome) : 0;
    $('credBox').hidden = !(cr > 0);
    $('credTxt').textContent = cr > 0 ? `Este cliente tem R$ ${fmt(cr)} de crédito (mortalidade de pedidos anteriores).` : '';
    if (!(cr > 0)) S.credit = false;
    $('credUse').checked = S.credit;
  }
  const afterClient = () => { invalidate(); S.nota.sig = ''; renderClientes(); renderAll(); };
  $('cliente').addEventListener('change', e => {
    S.cli = +e.target.value || 0; S.credit = false;
    // trocou de cliente com um pedido salvo aberto: passa a ser um pedido NOVO (o anterior continua intacto no histórico e na programação)
    if (S.curId) { const ant = S.hist.find(x => x.id === S.curId); S.curId = null; S.embData = ''; invalidate(); initNumbers(); if (ant) { const ni = parseInt(ant.inv, 10) || 0, na = parseInt(ant.atNum, 10) || 0; if (ni >= (parseInt($('inv').value, 10) || 0)) $('inv').value = ni + 1; if (na >= (parseInt($('atNum').value, 10) || 0)) $('atNum').value = na + 1; } if ($('embAsk')) $('embAsk').hidden = true; $('draftBar').hidden = false; $('draftBar').textContent = `Você trocou de cliente: este agora é um pedido NOVO.${ant ? ' O pedido de ' + ant.cliente.nome + ' (invoice ' + ant.inv + ') continua salvo, sem alteração.' : ''}`; $('saveMsg').textContent = ''; }
    afterClient(); syncEmbData();
  });
  $('cliNovo').onclick = () => { S.clientes.push({ nome: 'NOVO CLIENTE', end: '' }); S.cli = S.clientes.length - 1; saveClientes(); renderClientes(); $('cliNome').focus(); $('cliNome').select(); invalidate(); renderDoc(); };
  $('cliNome').addEventListener('input', e => { const c = S.clientes[S.cli]; if (!c) return; c.nome = e.target.value.toUpperCase(); saveClientes(); $('cliente').options[S.cli].textContent = c.nome; renderDoc(); });
  $('cliEnd').addEventListener('input', e => { const c = S.clientes[S.cli]; if (!c) return; c.end = e.target.value.toUpperCase(); saveClientes(); renderDoc(); });
  $('cliAero').addEventListener('input', e => { const c = S.clientes[S.cli]; if (!c) return; c.aero = e.target.value.toUpperCase(); saveClientes(); });
  $('cliCidade').addEventListener('input', e => { const c = S.clientes[S.cli]; if (!c) return; c.cidade = e.target.value; saveClientes(); });
  $('cliDesc').addEventListener('input', e => { const c = S.clientes[S.cli]; if (!c) return; c.desc = Math.min(99, Math.max(0, parseFloat(e.target.value) || 0)) || ''; saveClientes(); afterPriceChange(); });
  $('cliPrecos').addEventListener('input', e => { const c = S.clientes[S.cli]; if (!c) return; c.precos = e.target.value; saveClientes(); afterPriceChange(); });
  function afterPriceChange() { invalidate(); S.nota.sig = ''; renderAll(); }
  $('cliDel').onclick = () => { if (!S.clientes[S.cli]) return; if (!confirm('Remover este cliente? Os pedidos dele continuam no histórico.')) return; S.clientes.splice(S.cli, 1); S.cli = 0; saveClientes(); S.credit = false; afterClient(); };
  /* embarque do pedido (cabeçalho): mostra a saída e deixa trocar; a Programação de voos acompanha */
  function syncEmbData() {
    const el = $('embData'), nt = $('embDataNt'); if (!el) return;
    const em = S.curId && PP.extra && PP.extra.embDoPedido ? PP.extra.embDoPedido(S.curId) : null;
    if (em) S.embData = em.saida;
    el.value = S.embData || '';
    if (nt) nt.textContent = em ? 'Na programação de ' + dBR(em.saida) + '. Mude a data para mover.' : S.embData ? 'Entra na programação ao salvar.' : 'Sem embarque marcado.';
  }
  $('embData').addEventListener('change', ev => {
    S.embData = ev.target.value || '';
    const e = S.curId ? S.hist.find(x => x.id === S.curId) : null;
    if (e && S.embData && PP.extra && PP.extra.embMove) { const em = PP.extra.embMove(e, S.embData); if (em) PP.toast(`Embarque de ${e.cliente.nome} agora é ${dBR(em.saida)}. A Programação de voos já foi atualizada.`, 'ok'); }
    syncEmbData();
  });
  $('pedDel').addEventListener('click', () => {
    const e = S.curId ? S.hist.find(x => x.id === S.curId) : null;
    if (!e) { if (!S.rows.length && !$('txt').value.trim()) { PP.toast('Não há pedido aberto para apagar.'); return; } if (confirm('Apagar o que está na tela? Este pedido ainda não foi salvo no histórico.')) { newOrder(); go('pedido'); } return; }
    const em = PP.extra && PP.extra.embDoPedido ? PP.extra.embDoPedido(e.id) : null;
    if (!confirm(`Apagar o pedido de ${e.cliente.nome} (invoice ${e.inv})?\n\nEle sai do histórico${em ? ' e da programação do embarque de ' + dBR(em.saida) : ''}. Se foi engano, dá para restaurar em Histórico > "Pedidos apagados".`)) return;
    if (PP.extra && PP.extra.embTira) PP.extra.embTira(e.id);
    S.hist = S.hist.filter(x => x.id !== e.id); saveHist(); renderClientes(); newOrder(); go('pedido');
    PP.toast(`Pedido de ${e.cliente.nome} apagado. Para desfazer: Histórico > Pedidos apagados.`, 'ok');
  });

  $('credUse').addEventListener('change', e => { S.credit = e.target.checked; S.nota.sig = ''; renderAll(); });
  const cliente = () => S.clientes[S.cli] || { nome: 'CLIENTE', end: '' };

  /* ---------- campos do pedido ---------- */
  function initNumbers() { const n = S.cfg.numeracao; $('inv').value = (n.ultimaInvoice || 0) + 1; $('atNum').value = (n.ultimoAtestado || 0) + 1; }
  function initFields() {
    initNumbers();
    $('data').value = Features.todayISO();
    applyExDefaults();
  }
  function applyExDefaults() {
    const v = S.cfg.valores;
    $('vAt').value = v.atestado; $('vEmb').value = v.embalagem;
  }
  function readEx() {
    const n = id => parseFloat($(id).value) || 0, v = S.cfg.valores;
    return { gtaAuto: $('gtaAuto').checked, gta: n('vGta'), temAt: $('temAt').checked, atestado: n('vAt'), embalagem: n('vEmb'), qCaixaMaior: parseInt($('qEmb2').value || '0', 10) || 0, caixaMaior: v.caixaMaior };
  }

  /* ---------- ler pedido ---------- */
  $('ler').onclick = () => {
    if (!S.catalog.length) { $('ignored').hidden = false; $('ignored').textContent = 'Envie a stocklist primeiro (Configurações).'; return; }
    const r = Core.parseText($('txt').value, cat());
    S.rows = Core.applyOrder(r.rows, S.cfg.ordem, cat()); S.ignored = r.ignored; S.nota.sig = ''; renderAll();
  };
  let lerTimer = null;
  $('txt').addEventListener('input', () => { clearTimeout(lerTimer); lerTimer = setTimeout(() => { if (S.catalog.length && $('txt').value.trim()) $('ler').click(); }, 700); });
  $('fPedido').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    if (!S.catalog.length) { $('pedmsg').textContent = 'Envie a stocklist primeiro (Configurações).'; return; }
    try {
      const wb = await loadWorkbook(f);
      const parsed = Core.parseStocklistWorksheet(wb.worksheets[0]).items.filter(i => i.pedido > 0);
      if (!parsed.length) { $('pedmsg').textContent = 'Não achei quantidades na coluna "Seu pedido aqui".'; return; }
      const r = Core.rowsFromStocklistOrder(parsed, cat());
      S.rows = Core.applyOrder(r.rows, S.cfg.ordem, cat()); S.ignored = []; S.nota.sig = '';
      $('pedmsg').textContent = `${parsed.length} itens lidos de ${f.name}.`;
      renderAll();
    } catch (err) { $('pedmsg').textContent = 'Não consegui abrir esse arquivo.'; }
  });

  /* ---------- conferência ---------- */
  const byId = id => Core.byId(cat(), id);
  function renderConf() {
    const tb = $('conf').querySelector('tbody'); tb.innerHTML = '';
    $('confEmpty').hidden = S.rows.length > 0;
    $('conf').hidden = S.rows.length === 0;
    $('ignored').hidden = !S.ignored.length;
    const wr = Core.groupWarnings(S.rows);
    $('ignored').hidden = !S.ignored.length && !wr.length;
    $('ignored').textContent = [S.ignored.length ? 'Linhas que não entendi: ' + S.ignored.join(' | ') : '', ...wr].filter(Boolean).join(' · ');
    S.rows.forEach((r, i) => {
      const it = byId(r.sel), st = Core.status(r, cat()), tr = document.createElement('tr'); if (!r.use) tr.className = 'off';
      const opts = (r.cands.length ? r.cands.map(c => byId(c.id) || c) : cat()).map(c => `<option value="${c.id}" ${c.id === r.sel ? 'selected' : ''}>${esc(c.sci)} · ${esc(c.comum)} · ${c.caixa}/cx · R$ ${fmt(c.preco)}${c.precoTab !== undefined && c.precoTab !== c.preco ? ' (tabela ' + fmt(c.precoTab) + ')' : ''} · ${c.estoque === null ? 'SEM ESTOQUE' : 'estoque ' + c.estoque + ' cx' + (c.vendido ? ' (já saíram ' + c.vendido + ')' : '')}</option>`).join('');
      const emb = `<div class="row nowrap" style="gap:6px;align-items:center"><select data-i="${i}" data-k="mode" aria-label="Embalagem item ${i + 1}" style="min-width:130px"><option value="inteira" ${r.mode === 'inteira' ? 'selected' : ''}>Caixas inteiras</option><option value="mista" ${r.mode === 'mista' ? 'selected' : ''}>Caixa mista</option></select>
        ${r.mode === 'inteira' ? `<input type="number" min="0" value="${r.boxes}" data-i="${i}" data-k="boxes" aria-label="Caixas item ${i + 1}"><span class="raw">cx ×</span><input type="number" min="1" value="${it ? Core.perBoxOf(r, it) : ''}" data-i="${i}" data-k="perBox" title="Peixes por caixa (a stocklist usa ${it ? it.caixa : ''}). Mude aqui se for diferente." aria-label="Peixes por caixa item ${i + 1}" style="width:100px">` : `<span class="raw">nº</span><input type="number" min="1" value="${r.group}" data-i="${i}" data-k="group" aria-label="Número da caixa item ${i + 1}">`}</div>`;
      const peixes = it ? Core.fishOf(r, cat()) : 0;
      tr.dataset.i = i;
      tr.innerHTML = `<td style="white-space:nowrap"><span class="grip" draggable="true" data-grip="${i}" title="Arraste para ordenar" aria-hidden="true">⠿</span><button type="button" class="mv" data-mv="-1" data-i="${i}" aria-label="Subir item ${i + 1}">▲</button><button type="button" class="mv" data-mv="1" data-i="${i}" aria-label="Descer item ${i + 1}">▼</button></td>
        <td><input type="checkbox" aria-label="Usar item ${i + 1}" ${r.use ? 'checked' : ''} data-i="${i}" data-k="use"></td>
        <td><div>${fmtInt(r.qty)}</div><div class="raw">${esc(r.raw)}</div></td>
        <td><select aria-label="Item ${i + 1}" data-i="${i}" data-k="sel">${r.sel === null ? '<option value="">Escolher item…</option>' : ''}${opts}</select></td>
        <td>${emb}</td><td class="n">${it ? fmtInt(peixes) : '—'}</td><td class="n">${it ? `<input type="number" step="0.01" min="0" value="${fmt2(r.preco > 0 ? r.preco : it.preco)}" data-i="${i}" data-k="preco" title="Preço só deste pedido. Tabela: R$ ${fmt(it.preco)}" aria-label="Preço unitário item ${i + 1}" style="width:84px${r.preco > 0 ? ';border-color:var(--warn)' : ''}">` : '—'}</td>
        <td class="n">${it ? fmt(peixes * (r.preco > 0 ? r.preco : it.preco)) : '—'}</td><td><span class="chip ${st.kind}">${esc(st.txt)}</span></td>`;
      tb.appendChild(tr);
    });
  }
  $('conf').addEventListener('change', e => {
    const t = e.target, i = +t.dataset.i, k = t.dataset.k; if (k === undefined) return; const r = S.rows[i];
    if (k === 'use') r.use = t.checked;
    if (k === 'sel') { r.sel = +t.value; delete r.perBox; delete r.preco; const it = byId(r.sel); if (r.frac) r.qty = Math.round(r.frac * it.caixa); r.boxes = r.frac ? 1 : Math.ceil(r.qty / it.caixa); r.use = Core.status(r, cat()).kind !== 'bad'; }
    if (k === 'boxes') { r.boxes = Math.max(0, parseInt(t.value || '0', 10)); const it0 = byId(r.sel); if (it0 && r.mode === 'inteira') r.qty = r.boxes * Core.perBoxOf(r, it0); }
    if (k === 'perBox') { const it0 = byId(r.sel), v = Math.max(1, parseInt(t.value || '0', 10) || 0); if (it0) { if (v === it0.caixa) delete r.perBox; else r.perBox = v; r.qty = r.boxes * Core.perBoxOf(r, it0); } }
    if (k === 'preco') { const it0 = byId(r.sel), v = parseFloat(String(t.value).replace(',', '.')) || 0; if (!it0 || !(v > 0) || Math.abs(v - it0.preco) < 0.00005) delete r.preco; else r.preco = v; S.nota.sig = ''; }
    if (k === 'group') r.group = Math.max(1, parseInt(t.value || '1', 10));
    if (k === 'mode') { r.mode = t.value; if (r.mode === 'mista' && !r.group) r.group = Math.max(0, ...S.rows.map(x => x.group)) + 1; }
    renderAll();
  });

  /* ---------- ordenar a conferência ---------- */
  function moveRow(from, to) {
    if (from === to || from < 0 || to < 0 || from >= S.rows.length || to >= S.rows.length) return;
    S.rows.splice(to, 0, S.rows.splice(from, 1)[0]); S.nota.sig = ''; renderAll();
  }
  let dragFrom = -1;
  const confBody = $('conf').querySelector('tbody');
  confBody.addEventListener('dragstart', e => { const g = e.target.closest('[data-grip]'); if (!g) return; dragFrom = +g.dataset.grip; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(dragFrom)); } catch (_) {} g.closest('tr').classList.add('dragging'); });
  confBody.addEventListener('dragover', e => { if (dragFrom < 0) return; e.preventDefault(); confBody.querySelectorAll('.dragover').forEach(x => x.classList.remove('dragover')); const tr = e.target.closest('tr'); if (tr) tr.classList.add('dragover'); });
  confBody.addEventListener('drop', e => { if (dragFrom < 0) return; e.preventDefault(); const tr = e.target.closest('tr'); const to = tr ? +tr.dataset.i : dragFrom; const f = dragFrom; dragFrom = -1; moveRow(f, to); });
  confBody.addEventListener('dragend', () => { dragFrom = -1; confBody.querySelectorAll('.dragover,.dragging').forEach(x => x.classList.remove('dragover', 'dragging')); });
  confBody.addEventListener('click', e => { const b = e.target.closest('[data-mv]'); if (b) moveRow(+b.dataset.i, +b.dataset.i + +b.dataset.mv); });
  $('ordSave').onclick = () => {
    const cur = []; S.rows.forEach(r => { const it = byId(r.sel); if (it && !cur.includes(it.sci)) cur.push(it.sci); });
    if (!cur.length) { $('ordMsg').textContent = 'Leia um pedido primeiro.'; return; }
    S.cfg.ordem = cur.concat((S.cfg.ordem || []).filter(x => !cur.includes(x))); saveCfg();
    $('ordMsg').textContent = `Ordem guardada (${S.cfg.ordem.length} espécies). Vale para os próximos pedidos.`;
  };
  $('ordClear').onclick = () => { S.cfg.ordem = []; saveCfg(); $('ordMsg').textContent = 'Ordem padrão apagada. Os próximos pedidos ficam na ordem em que o cliente escreveu.'; };

  /* ---------- print / foto do pedido (leitura de texto no próprio navegador) ---------- */
  function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('script')); document.head.appendChild(s); }); }
  async function imageToCanvas(file) {
    const bmp = await createImageBitmap(file);
    const k = Math.max(1, Math.min(3, 2200 / bmp.width));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(bmp, 0, 0, cv.width, cv.height);
    const d = g.getImageData(0, 0, cv.width, cv.height), px = d.data, n = px.length / 4, hist = new Array(256).fill(0); let sum = 0;
    for (let i = 0; i < px.length; i += 4) { const y = Math.round(0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]); px[i] = y; hist[y]++; sum += y; }
    const inv = sum / n < 110; // print em modo escuro: inverte
    // limiar de Otsu (separa letra de fundo mesmo com sombra leve de foto)
    let tot = 0, sB = 0, wB = 0, best = 0, th = 128; for (let i = 0; i < 256; i++) tot += i * hist[i];
    for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += i * hist[i]; const mB = sB / wB, mF = (tot - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; th = i; } }
    for (let i = 0; i < px.length; i += 4) { let y = px[i]; if (inv) y = 255 - y; const v = (inv ? 255 - th : th); y = y > v + 8 ? 255 : (y < v - 40 ? 0 : y); px[i] = px[i + 1] = px[i + 2] = y; }
    g.putImageData(d, 0, 0); return cv;
  }
  let ocrAll = []; // texto de cada print já lido neste pedido
  async function lerImagem(file) {
    const msg = $('imgmsg'), th = document.createElement('div'); th.className = 'thumb';
    try { th.innerHTML = `<img alt="Print ${ocrAll.length + 1}" src="${URL.createObjectURL(file)}"><span>lendo…</span>`; $('thumbs').appendChild(th); } catch (_) { /* sem miniatura */ }
    try {
      msg.textContent = 'Lendo o print… (na primeira vez demora um pouco mais)';
      if (!window.Tesseract) await loadScript('vendor/ocr/tesseract.min.js');
      const cv = await imageToCanvas(file);
      const w = await Tesseract.createWorker('por', 1, { workerPath: 'vendor/ocr/worker.min.js', corePath: 'vendor/ocr/', langPath: 'vendor/ocr/', gzip: true, workerBlobURL: false,
        logger: m => { if (m.status === 'recognizing text') msg.textContent = 'Lendo o print… ' + Math.round(m.progress * 100) + '%'; } });
      await w.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
      const { data } = await w.recognize(cv); await w.terminate();
      const linhas = data.text.split(/\n/).map(x => x.replace(/\s+/g, ' ').trim()).filter(x => x.length > 1);
      S.ocrRaw = linhas;
      const r = Core.ocrRows(linhas, cat());
      ocrAll.push({ nome: file.name, linhas, keep: r.keep, text: r.text, dropped: r.dropped.length, suspect: r.suspect });
      $('ocrRaw').hidden = false; $('ocrRawTxt').textContent = ocrAll.map((o, i) => `--- Print ${i + 1} ---\n` + o.linhas.join('\n')).join('\n\n');
      const keep = ocrAll.flatMap(o => o.keep), susp = ocrAll.flatMap(o => o.suspect), drop = ocrAll.reduce((a, o) => a + o.dropped, 0);
      th.querySelector('span').textContent = r.keep.length ? `${r.keep.length} linha(s)` : 'nada achado';
      if (!keep.length) { msg.textContent = 'Não achei linhas de pedido nesse print. Tente um print mais nítido ou digite o pedido.'; $('txt').value = $('txt').value || linhas.join('\n'); return; }
      // soma o texto dos prints, sem repetir linha igual (mesmo item aparecendo em dois prints sobrepostos)
      const cur = $('txt').value.split('\n').map(x => x.trim()).filter(Boolean), novas = r.text.split('\n').filter(l => l.trim() && !cur.includes(l.trim()));
      $('txt').value = cur.concat(novas).join('\n');
      msg.textContent = `${ocrAll.length} print(s): peguei ${keep.length} linha(s) de pedido e ignorei ${drop} outras. Confira o texto ao lado antes de gerar.` + (susp.length ? ` ATENÇÃO: ${susp.length} linha(s) pareciam peixe mas não consegui ler (${susp.map(x => x.slice(0, 40)).join(' | ')}). Digite essas à mão.` : '');
      $('ler').click();
    } catch (err) { th.querySelector('span') && (th.querySelector('span').textContent = 'erro'); msg.textContent = 'Não consegui ler esse arquivo. Tente outro print ou digite o pedido.'; console.error(err); }
  }
  let ocrQueue = Promise.resolve();
  const enqueueImgs = files => { files.forEach(f => { ocrQueue = ocrQueue.then(() => lerImagem(f)); }); };
  $('fImg').addEventListener('change', e => { enqueueImgs([...e.target.files]); e.target.value = ''; });
  document.addEventListener('paste', e => {
    const fs = [...(e.clipboardData ? e.clipboardData.files : [])].filter(x => x.type.startsWith('image/'));
    if (fs.length) { e.preventDefault(); enqueueImgs(fs); }
  });

  /* ---------- aparência: nome e assistente ---------- */
  (function () {
    const nm = $('uNome'), on = $('asOn'), au = $('asAuto');
    nm.value = store.get('uNome', 'Raphael');
    on.checked = store.get('asOn', true) !== false; au.checked = store.get('asAuto', true) !== false;
    nm.addEventListener('input', () => { store.set('uNome', nm.value.trim()); if (S.view === 'hoje' && PP.hoje) PP.hoje.render(); });
    on.addEventListener('change', () => { store.set('asOn', on.checked); if (PP.assist) PP.assist.refresh(); });
    au.addEventListener('change', () => { store.set('asAuto', au.checked); });
    const fx = $('fxFull'); if (fx) { fx.checked = store.get('fxFull', false) === true; fx.addEventListener('change', () => { store.set('fxFull', fx.checked); if (window.PPfxSync) window.PPfxSync(); }); }
  })();

  /* ---------- plano, notinha e pedido ---------- */
  function currentPlan() { return Core.plan(S.rows, cat()); }
  const creditAvail = () => Features.creditoCliente(S.hist.filter(e => e.id !== S.curId), cliente().nome);
  function syncNota(P) {
    const sig = P.L.map(l => [l.it.id, l.boxesCol, l.qtyBox, l.peixes, l.it.preco].join(':')).join('|') + '|' + S.credit;
    if (sig !== S.nota.sig) { S.nota.sig = sig; S.nota.rows = Core.notinhaRows(P, S.cfg); if (S.nota.keep) { S.nota.rows = S.nota.keep; S.nota.keep = null; } }
    S.nota.rows = S.nota.rows.filter(r => !r.aplicado);
    const av = creditAvail();
    if (S.credit && av > 0) S.nota.rows.push(Features.creditRow(av));
  }
  function notaState(P) {
    syncNota(P);
    const ex = readEx();
    const totals = Core.notinhaTotals(S.nota.rows, ex, S.cfg.valores);
    if (ex.gtaAuto) { $('vGta').value = totals.gta.toFixed(2); }
    $('vGta').readOnly = ex.gtaAuto;
    return { rows: S.nota.rows, totals, ex, dia: $('dia').value };
  }
  // atestado no orçamento: só para clientes que voam pela AZUL (VCP e CNF); LATAM (GRU, BSB etc.) não leva
  const orcTemAtestado = c => /\b(VCP|CNF)\b/i.test(String((c && c.aero) || ''));
  function order(P) {
    const nota = notaState(P);
    const orcRows = nota.rows.filter(r => !r.aplicado), orcAt = orcTemAtestado(cliente()), orcEx = { ...nota.ex, temAt: orcAt }, orcT = Core.orcTotals(orcRows, orcEx, S.cfg.valores, S.orc);
    return { P, cliente: cliente(), cfg: S.cfg, moeda: S.moeda, dataISO: $('data').value, num: { invoice: $('inv').value, atestado: parseInt($('atNum').value || '0', 10), nf: $('nf').value || '000000000' }, nota, orcRows, orcEx, orcT, orc: S.orc };
  }

  function renderSum() {
    const P = currentPlan(), N = notaState(P);
    $('sum').innerHTML = P.L.length ? `<div><b>${P.L.length}</b><span>itens</span></div><div><b>${P.total}</b><span>caixas</span></div><div><b>${fmtInt(P.peixes)}</b><span>peixes</span></div><div><b>R$ ${fmt(P.valor)}</b><span>valor dos peixes</span></div><div><b>${P.total * S.cfg.valores.kgCaixa} kg</b><span>peso</span></div><div><b>R$ ${fmt(N.totals.total)}</b><span>total da notinha</span></div>` : '';
  }

  /* ---------- documentos: tela ---------- */
  const TABS = [['invoice', 'Invoice'], ['atestado', 'Atestado'], ['packing', 'Packing list'], ['etiquetas', 'Etiquetas'], ['notinha', 'Notinha final'], ['orcamento', 'Orçamento'], ['nf', 'Dados p/ Nota Fiscal']];
  const range = l => (l.ini === l.fim ? String(l.ini) : `${l.ini}-${l.fim}`);
  const dataBR = () => Docs.dataBR($('data').value);
  function renderDoc() {
    const P = currentPlan(), o = order(P), L = P.L, el = $('doc'), C = cliente(), E = S.cfg.empresa;
    renderCheck(P, o); saveDraft();
    $('printDoc').disabled = !L.length; $('saveHist').disabled = !L.length;
    $('tabs').innerHTML = TABS.map(([k, n]) => `<button role="tab" aria-selected="${k === S.tab}" data-tab="${k}">${n}</button>`).join('');
    $('zip').disabled = !L.length;
    if (!L.length) { el.innerHTML = '<p class="empty">Os documentos aparecem aqui depois que você ler o pedido.</p>'; return; }
    const dl = (kind, label) => `<div class="dlrow"><button class="primary" data-dl="${kind}">${label}</button></div>`;
    let h = '';
    if (S.tab === 'invoice') {
      const kg = S.cfg.valores.kgCaixa, us = S.moeda.usd && S.moeda.taxa > 0, tx = us ? S.moeda.taxa : 1, mo = x => fmt(us ? x / tx : x), mu = x => (us ? (Math.round(x / tx * 10000) / 10000).toLocaleString('pt-BR', { minimumFractionDigits: 4 }) : fmt(x));
      h = `<div class="paper"><h3>${esc(E.nome || 'PRESTIGE AQUARIUM LTDA')}</h3>
      <div class="meta"><span><b>INVOICE Nº</b> ${esc($('inv').value)}</span><span><b>DATA</b> ${dataBR()}</span><span><b>SOLD TO</b> ${esc(C.nome)} ${C.end ? '· ' + esc(C.end) : ''}</span></div>
      <table><thead><tr><th>N. boxes</th><th>Qty p/ Box</th><th>Nome científico</th><th>Nome comum</th><th>Total fish</th><th>${us ? 'Unit price US$' : 'Preço unit R$'}</th><th>${us ? 'Total US$' : 'Total R$'}</th><th>Weight KG</th></tr></thead><tbody>
      ${L.map(l => `<tr><td>${l.boxesCol ?? ''}</td><td>${fmtInt(l.qtyBox)}</td><td>${esc(l.it.sci)}</td><td>${esc(Core.docName(l.it, S.cfg))}</td><td>${fmtInt(l.peixes)}</td><td>${mu(l.it.preco)}</td><td>${mo(l.valor)}</td><td>${l.boxesCol ? l.boxesCol * kg : ''}</td></tr>`).join('')}
      <tr><td><b>${P.total}</b></td><td></td><td></td><td></td><td><b>${fmtInt(P.peixes)}</b></td><td></td><td><b>${mo(P.valor)}</b></td><td><b>${P.total * kg}</b></td></tr></tbody></table></div>${dl('invoice', 'Baixar invoice (.xlsx)')}`;
    } else if (S.tab === 'atestado') {
      h = `<div class="paper"><h3>ATESTADO Nº ${String(o.num.atestado).padStart(3, '0')}/${$('data').value.slice(0, 4)}</h3>
      <p>O Médico Veterinário abaixo assinado atesta que os animais (peixes ornamentais), procedentes da Prestige Aquarium Ltda., CNPJ: ${esc(E.cnpj)}, abaixo relacionados, foram por mim inspecionados e submetidos a exames clínicos, encontram-se em boas condições sanitárias para trânsito de animais e não apresentaram sintomas de doenças infectocontagiosas e parasitárias, próprias da espécie, na data da emissão deste documento.</p>
      <table><thead><tr><th>Quantidade de caixas</th><th>Nome científico</th><th>Nome comum</th><th>Quant. peixes</th></tr></thead><tbody>
      ${L.map(l => `<tr><td>${l.boxesCol ?? ''}</td><td>${esc(l.it.sci)}</td><td>${esc(Core.docName(l.it, S.cfg))}</td><td>${fmtInt(l.peixes)}</td></tr>`).join('')}
      <tr><td><b>${P.total}</b></td><td></td><td></td><td><b>${fmtInt(P.peixes)}</b></td></tr></tbody></table>
      <p>Nota Fiscal Nº.: ${esc(o.num.nf)} - SÉRIE 2<br>Manaus/AM, ${Docs.dataLonga($('data').value)}</p></div>${dl('atestado', 'Baixar atestado (.docx)')}`;
    } else if (S.tab === 'packing') {
      h = `<div class="paper"><h3>${esc(E.nome || 'PRESTIGE AQUARIUM LTDA')}</h3><p>PACKING LIST · ${esc(C.nome)} · ${dataBR()}</p>
      <table><thead><tr><th>Espécies (nome vulgar)</th><th>Quant. / Peixe (caixa nº)</th></tr></thead><tbody>
      ${L.map(l => `<tr><td>${esc(l.it.sci)} – ${esc(Core.docName(l.it, S.cfg))}</td><td>${range(l)}</td></tr>`).join('')}</tbody></table></div>${dl('packing', 'Baixar packing list (.docx)')}`;
    } else if (S.tab === 'etiquetas') {
      h = `<div class="labels">${P.boxes.map(b => `<div class="label"><div class="t">${esc(E.nome)}</div><div class="c">${esc(C.nome)}</div>${b.items.map(x => `<div>${esc(x.it.sci)} – ${esc(Core.docName(x.it, S.cfg))} – ${fmtInt(x.q)}</div>`).join('')}<div class="raw">${esc(o.num.nf)}</div><div class="box">${String(b.no).padStart(2, '0')}/${String(b.total).padStart(2, '0')}</div></div>`).join('')}</div>
      <p class="note">${P.boxes.length} etiquetas, uma por caixa.</p>${dl('etiquetas', 'Baixar etiquetas (.docx)')}`;
    } else if (S.tab === 'orcamento') {
      h = orcPanel(o);
    } else if (S.tab === 'notinha') {
      const N = o.nota, T = N.totals, ex = N.ex;
      h = `<div class="paper"><h3>Prestige Aquarium LTDA</h3>
      <div>${esc(E.endereco)} · ${esc(E.cep)} · ${esc(E.cidade)}</div>
      <p><b>EMBARQUE CHEGARÁ ${esc(N.dia)}. ENVIAREMOS O CONHECIMENTO QUANDO POSSUIRMOS</b></p>
      <div class="meta"><span><b>CLIENTE:</b> ${esc(C.nome)}</span><span><b>ENTREGA:</b> ${dataBR()}</span></div>
      <table><thead><tr><th>Nome peixe</th><th>N. cxs</th><th>Qtd p/ cx</th><th>Total</th><th>Valor unit</th><th>Total R$</th></tr></thead><tbody>
      ${N.rows.map((r, i) => `<tr><td><input class="nm" data-nr="${i}" data-f="nome" value="${esc(r.nome)}" aria-label="Nome ${i + 1}"></td>
        <td><input type="number" min="0" data-nr="${i}" data-f="cxs" value="${r.cxs ?? ''}" aria-label="Caixas ${i + 1}"></td>
        <td><input type="number" min="0" data-nr="${i}" data-f="qtd" value="${r.qtd}" aria-label="Qtd por caixa ${i + 1}"></td>
        <td>${fmtInt(Core.notinhaFish(r))}</td>
        <td><input type="number" step="0.01" min="0" data-nr="${i}" data-f="unit" value="${r.unit}" aria-label="Valor unitário ${i + 1}"></td>
        <td>${fmt(Core.notinhaLineTotal(r))}</td></tr>`).join('')}
      <tr><td colspan="5"><b>Subtotal dos peixes</b></td><td><b>${fmt(T.fish)}</b></td></tr>
      <tr><td>ATESTADO</td><td colspan="4"></td><td>${ex.temAt ? fmt(T.atestado) : '-'}</td></tr>
      <tr><td>GTA</td><td colspan="4"></td><td>${fmt(T.gta)}</td></tr>
      ${ex.qCaixaMaior > 0 ? `<tr><td>EMBALAGEM (caixa maior)</td><td>${ex.qCaixaMaior}</td><td colspan="2"></td><td>${fmt(ex.caixaMaior)}</td><td>${fmt(T.emb2)}</td></tr>` : ''}
      <tr><td>EMBALAGEM</td><td>${T.caixas}</td><td colspan="2"></td><td>${fmt(ex.embalagem)}</td><td>${fmt(T.emb)}</td></tr>
      <tr class="tot"><td colspan="5">VALOR TOTAL</td><td class="hl">R$ ${fmt(T.total)}</td></tr></tbody></table></div>
      <p class="note">Os campos em amarelo são editáveis: ajuste o que chegou ao cliente e o total se recalcula. O arquivo baixado já leva as fórmulas.</p>${dl('notinha', 'Baixar notinha final (.xlsx)')}`;
    } else {
      const tsv = L.map(l => [l.it.sci, l.it.comum, l.peixes, String(l.it.preco).replace('.', ','), l.valor.toFixed(2).replace('.', ',')].join('\t')).join('\n');
      h = `<div class="tablewrap"><table><thead><tr><th>Descrição</th><th class="n">Quantidade</th><th class="n">Valor unit.</th><th class="n">Total</th></tr></thead><tbody>
      ${L.map(l => `<tr><td>${esc(l.it.sci)} (${esc(l.it.comum)})</td><td class="n">${fmtInt(l.peixes)}</td><td class="n">${fmt(l.it.preco)}</td><td class="n">${fmt(l.valor)}</td></tr>`).join('')}
      <tr><td><b>Total</b></td><td class="n"><b>${fmtInt(P.peixes)}</b></td><td></td><td class="n"><b>${fmt(P.valor)}</b></td></tr></tbody></table></div>
      <div class="copyrow"><button id="copy">Copiar itens</button><span class="note" id="copymsg">A Nota Fiscal continua sendo emitida por você. Aqui ficam os itens prontos para copiar.</span></div><textarea id="tsv" hidden>${esc(tsv)}</textarea>`;
    }
    el.innerHTML = h;
  }

  /* ---------- ORÇAMENTO (Nacional): igual à notinha final, antes do embarque ---------- */
  function orcPaper(o) {
    const T = o.orcT, ex = o.orcEx, E = S.cfg.empresa, C = o.cliente, R = o.orcRows;
    const money = v => 'R$ ' + fmt(v), dash = v => (v > 0 ? money(v) : '-');
    const logo = window.LOGO_PNG_B64 ? `<img class="orclogo" alt="" src="data:image/png;base64,${window.LOGO_PNG_B64}">` : '';
    const extra = [];
    if (T.desconto > 0) extra.push(`<tr class="orcsub"><td colspan="5" class="r">${esc(String(T.pct).replace('.', ','))}% DESCONTO</td><td class="r">- ${money(T.desconto)}</td></tr><tr class="orcsub"><td colspan="5" class="r"><b>Subtotal com desconto</b></td><td class="r"><b>${money(T.aposDesc)}</b></td></tr>`);
    if (ex.temAt) extra.push(`<tr><td colspan="5">ATESTADO</td><td class="r">${dash(T.atestado)}</td></tr>`);
    extra.push(`<tr><td colspan="5">GTA</td><td class="r">${dash(T.gta)}</td></tr>`);
    if (ex.qCaixaMaior > 0) extra.push(`<tr><td colspan="3">EMBALAGEM (caixa maior)</td><td class="r">${ex.qCaixaMaior}</td><td class="r">${money(ex.caixaMaior)}</td><td class="r">${money(T.emb2)}</td></tr>`);
    extra.push(`<tr><td colspan="3">EMBALAGEM</td><td class="r">${T.caixas}</td><td class="r">${money(ex.embalagem)}</td><td class="r">${money(T.emb)}</td></tr>`);
    return `<div class="orcpg"><div class="orchead">${logo}<div class="orcemp"><b>${esc(E.nome || 'Prestige Aquarium LTDA')}</b><br>${esc(E.endereco || '')}<br>CEP: ${esc((E.cep || '').replace(/^CEP:?\s*/i, ''))}<br>${esc(E.cidade || '')}</div></div>
      <div class="orctit">ORÇAMENTO</div>
      <div class="orcmeta"><span><b>CLIENTE:</b> ${esc(C.nome)}</span><span><b>DATA:</b> ${dataBR()}</span><span><b>CPF/CNPJ:</b> ${esc(C.doc || '')}</span></div>
      <table class="orctab"><thead><tr><th class="l">NOME PEIXE</th><th>N. CXS</th><th>QTD P/ CX</th><th>TOTAL</th><th>VALOR UNIT</th><th>TOTAL R$</th></tr></thead><tbody>
      ${R.map(r => `<tr><td>${esc(r.nome)}</td><td class="c">${r.cxs ?? ''}</td><td class="c">${fmtInt(r.qtd)}</td><td class="c">${fmtInt(Core.notinhaFish(r))}</td><td class="r">${money(r.unit)}</td><td class="r">${money(Core.notinhaLineTotal(r))}</td></tr>`).join('')}
      <tr class="orcsub"><td colspan="5" class="r"><b>Subtotal dos peixes</b></td><td class="r"><b>${money(T.fish)}</b></td></tr>
      ${extra.join('')}
      <tr class="orctot"><td colspan="5">VALOR TOTAL</td><td class="r">${money(T.total)}</td></tr></tbody></table></div>`;
  }
  function orcPanel(o) {
    const O = S.orc, T = o.orcT;
    const chip = (v, t) => `<button type="button" class="orcchip${(!O.custom && +O.pct === v) ? ' on' : ''}" data-orcpct="${v}">${t}</button>`;
    const custom = !!O.custom;
    return `<div class="block orcctl"><div class="row nowrap" style="gap:8px;align-items:flex-end;flex-wrap:wrap">
        <div><label>Desconto no valor dos peixes</label><div class="orcchips">${chip(0, 'Sem desconto')}${chip(5, '5%')}${chip(10, '10%')}<span class="orcother${custom ? ' on' : ''}"><input type="number" min="0" max="100" step="0.5" data-orc="pct" value="${custom ? O.pct : ''}" placeholder="outro %" aria-label="Desconto em porcentagem"></span></div></div></div>
      <p class="note" style="margin:8px 0 0">O orçamento usa os itens e preços do pedido, mais GTA e embalagem já calculados${o.orcEx.temAt ? ', e o atestado (cliente de ' + esc((o.cliente.aero || '').toUpperCase()) + ', voo Azul)' : '. Sem atestado: ele só entra para clientes de VCP e CNF (Azul)'}. Frete e taxa do despachante não entram no orçamento nacional. Ele <b>não</b> entra no histórico, no estoque nem na numeração.</p></div>
      <div class="paper orcprev">${orcPaper(o)}</div>
      <div class="dlrow"><button class="primary" data-orcdl="xlsx">Baixar orçamento (.xlsx)</button><button class="primary" data-orcdl="pdf">Baixar orçamento (PDF)</button><span class="note">Total: <b>R$ ${fmt(T.total)}</b>${T.desconto > 0 ? ` · desconto de R$ ${fmt(T.desconto)}` : ''}</span></div>`;
  }
  function loadJS(src) { return new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = src; sc.onload = res; sc.onerror = () => rej(new Error('Não foi possível carregar ' + src)); document.head.appendChild(sc); }); }
  async function orcPdfBytes(o) {
    if (!window.html2canvas) await loadJS('vendor/html2canvas.min.js');
    if (!(window.jspdf && window.jspdf.jsPDF)) await loadJS('vendor/jspdf.umd.min.js');
    const host = document.createElement('div'); host.className = 'orcHost'; host.innerHTML = orcPaper(o); document.body.appendChild(host);
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const el = host.firstElementChild, cv = await window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true, width: 794, windowWidth: 794 });
      const pdf = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
      const PW = 595.28, PH = 841.89, mg = 28, w = PW - mg * 2, pxPage = Math.floor((PH - mg * 2) * cv.width / w);
      for (let y = 0, i = 0; y < cv.height; y += pxPage, i++) {
        const h = Math.min(pxPage, cv.height - y), part = document.createElement('canvas'); part.width = cv.width; part.height = h;
        part.getContext('2d').drawImage(cv, 0, y, cv.width, h, 0, 0, cv.width, h);
        if (i) pdf.addPage();
        pdf.addImage(part.toDataURL('image/jpeg', 0.94), 'JPEG', mg, mg, w, h * w / cv.width, undefined, 'FAST');
      }
      pdf.setProperties({ title: 'Orçamento ' + o.cliente.nome, author: S.cfg.empresa.nome || 'Prestige Aquarium', creator: 'Sistema de Pedidos Prestige' });
      return new Uint8Array(pdf.output('arraybuffer'));
    } finally { host.remove(); }
  }
  async function orcFile(kind) {
    const o = order(currentPlan()), base = `ORCAMENTO_${slug(o.cliente.nome)}`;
    if (kind === 'pdf') return { name: base + '.pdf', mime: 'application/pdf', bytes: await orcPdfBytes(o) };
    const o2 = { ...o, nota: { ...o.nota, rows: o.orcRows, ex: o.orcEx } };
    return { name: base + '.xlsx', mime: MIME.xlsx, bytes: await docs.orcamentoXlsx(o2) };
  }

  /* ---------- downloads ---------- */
  const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'CLIENTE';
  const MIME = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  const FILES = { invoice: ['INVOICE', 'xlsx', 'invoiceXlsx'], notinha: ['NOTINHA_FINAL', 'xlsx', 'notinhaXlsx'], atestado: ['ATESTADO', 'docx', 'atestadoDocx'], packing: ['PACKINGLIST', 'docx', 'packingDocx'], etiquetas: ['ETIQUETAS', 'docx', 'etiquetasDocx'] };
  async function buildFile(kind) {
    const o = order(currentPlan()); const [pref, ext, fn] = FILES[kind];
    return { name: `${pref}_${slug(o.cliente.nome)}.${ext}`, ext, bytes: await docs[fn](o) };
  }
  function saveBlob(name, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function rememberNumbers() {
    const inv = parseInt($('inv').value, 10), at = parseInt($('atNum').value, 10), first = !S.curId; // pedido já salvo (aberto do histórico) não mexe na numeração
    if (first) { if (inv > 0) S.cfg.numeracao.ultimaInvoice = inv; if (at > 0) S.cfg.numeracao.ultimoAtestado = at; saveCfg(); }
    saveOrder(); renderConfigForms();
  }
  $('doc').addEventListener('click', async e => {
    const oc = e.target.closest('[data-orcpct]');
    if (oc) { S.orc.pct = +oc.dataset.orcpct; S.orc.custom = false; renderDoc(); return; }
    const od = e.target.closest('[data-orcdl]');
    if (od) { od.disabled = true; const t0 = od.textContent; od.textContent = 'Gerando…'; try { const f = await orcFile(od.dataset.orcdl); saveBlob(f.name, new Blob([f.bytes], { type: f.mime })); PP.toast('Orçamento gerado: ' + f.name); } catch (err) { PP.toast('Não consegui gerar o orçamento: ' + (err && err.message || err)); } finally { od.disabled = false; od.textContent = t0; } return; }
    const b = e.target.closest('[data-dl]');
    if (b) { b.disabled = true; try { const f = await buildFile(b.dataset.dl); builtIssues = await verifyBuilt([f], currentPlan()); saveBlob(f.name, new Blob([f.bytes], { type: MIME[f.ext] })); rememberNumbers(); } finally { b.disabled = false; renderDoc(); } return; }
    if (e.target.id === 'copy') {
      const ta = $('tsv'); let ok = false;
      try { await navigator.clipboard.writeText(ta.value); ok = true; } catch (_) { /* usa seleção */ }
      if (!ok) { ta.hidden = false; ta.select(); }
      $('copymsg').textContent = ok ? 'Itens copiados.' : 'Copie o texto selecionado abaixo.';
    }
  });
  $('zip').onclick = async () => {
    const btn = $('zip'); btn.disabled = true;
    try {
      const bad = (S.lastCheck || []).filter(x => x.lvl === 'bad');
      if (bad.length && !confirm('A conferência achou problema(s):\n\n- ' + bad.map(x => x.txt).join('\n- ') + '\n\nGerar mesmo assim?')) return;
      const zip = new JSZip(); const o = order(currentPlan()), built = [];
      for (const k of Object.keys(FILES)) { if (k === 'atestado' && !$('temAt').checked) continue; const f = await buildFile(k); zip.file(f.name, f.bytes); built.push(f); }
      builtIssues = await verifyBuilt(built, o.P);
      const blob = await zip.generateAsync({ type: 'blob' });
      saveBlob(`PEDIDO_${slug(o.cliente.nome)}_${$('data').value}.zip`, blob); rememberNumbers();
    } finally { btn.disabled = false; renderDoc(); }
  };
  $('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { S.tab = b.dataset.tab; renderDoc(); } });

  /* ---------- notinha editável ---------- */
  $('doc').addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.orc) { // campos do orçamento: recalcula mantendo o foco
      S.orc[t.dataset.orc] = Math.max(0, parseFloat(t.value) || 0); if (t.dataset.orc === 'pct') S.orc.custom = true;
      const id = t.id || t.getAttribute('aria-label'), pos = t.selectionStart;
      renderDoc();
      const again = Array.from($('doc').querySelectorAll('input')).find(x => (x.id || x.getAttribute('aria-label')) === id);
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (_) { /* number */ } }
      return;
    }
    if (t.dataset.nr === undefined) return;
    const r = S.nota.rows[+t.dataset.nr], f = t.dataset.f;
    if (f === 'nome') r.nome = t.value.toUpperCase();
    else if (f === 'cxs') r.cxs = t.value === '' ? null : Math.max(0, parseInt(t.value, 10) || 0);
    else r[f] = Math.max(0, parseFloat(t.value) || 0);
    if (f === 'nome') return;
    const pos = { sel: t.selectionStart }; // recalcula totais mantendo o foco
    const id = t.getAttribute('aria-label');
    renderSum(); renderDoc();
    const again = Array.from($('doc').querySelectorAll('input')).find(x => x.getAttribute('aria-label') === id);
    if (again) { again.focus(); try { again.setSelectionRange(pos.sel, pos.sel); } catch (_) { /* number não suporta */ } }
  });

  /* ---------- backup ---------- */
  const snapshot = () => ({ app: 'prestige-pedidos', v: 2, catalog: S.catalog, catalogInfo: S.catalogInfo, catStamp: S.catStamp, stockFile: store.get('stockFile', null), clientes: S.clientes, cfg: S.cfg, hist: S.hist, embarques: S.embarques, expcfg: store.get('expcfg', null), exphist: store.get('exphist', null), fretes: store.get('fretes', null), tarefas: store.get('tarefas', null), kanban: store.get('kanban', null), mapa: store.get('mapa', null) });
  const bkLabel = () => { const l = store.get('lastBackup', 0); $('bkLast').textContent = l ? 'Último backup: ' + new Date(l).toLocaleDateString('pt-BR') + '.' : 'Nenhum backup baixado ainda.'; };
  $('bkExport').onclick = () => { saveBlob(`prestige-pedidos-backup-${Features.todayISO()}.json`, new Blob([JSON.stringify(snapshot())], { type: 'application/json' })); store.set('lastBackup', Date.now()); bkLabel(); renderBanners(); };
  // aplica um backup (arquivo .json ou cópia automática) por cima dos dados atuais
  function aplicarBackup(d) {
    {
      if (d.catalog) { S.catalog = d.catalog; store.set('catalog', d.catalog); }
      if (d.catalogInfo) { S.catalogInfo = d.catalogInfo; store.set('catalogInfo', d.catalogInfo); }
      if (d.catStamp) { S.catStamp = d.catStamp; store.set('catStamp', d.catStamp); }
      if (d.stockFile) store.set('stockFile', d.stockFile);
      if (d.hist) { S.hist = d.hist; saveHist(); }
      if (d.embarques) { S.embarques = d.embarques; store.set('embarques', S.embarques); }
      if (d.expcfg) store.set('expcfg', d.expcfg);
      if (d.exphist) store.set('exphist', d.exphist);
      if (d.fretes) { store.set('fretes', d.fretes); if (PP.frete) PP.frete.reload(); }
      if (d.tarefas) store.set('tarefas', d.tarefas);
      if (d.kanban) store.set('kanban', d.kanban);
      if (d.mapa) store.set('mapa', d.mapa);
      if (PP.exp) PP.exp.reload();
      if (d.clientes) { S.clientes = d.clientes; S.cli = 0; saveClientes(); }
      if (d.cfg) { S.cfg = Object.assign(clone(Core.DEFAULT_CFG), d.cfg); ['apelidos', 'apelidosNota', 'etiquetas'].forEach(k => { S.cfg[k] = Object.assign({}, Core.DEFAULT_CFG[k], S.cfg[k] || {}); }); ['empresa', 'vet', 'valores', 'numeracao', 'embarque'].forEach(k => { S.cfg[k] = Object.assign({}, Core.DEFAULT_CFG[k], S.cfg[k] || {}); }); saveCfg(); }
      store.set('lastBackup', Date.now()); bkLabel(); renderBanners(); invalidate();
      if (PP.mapa && PP.mapa.invalidate) PP.mapa.invalidate();
      histSnap();
      renderConfigForms(); renderNames(); refreshCatInfo(); renderClientes(); newOrder();
      try { go(S.view); } catch (_) { /* tela redesenha na próxima troca */ }
    }
    return S.hist.length;
  }
  $('bkImport').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const n = aplicarBackup(JSON.parse(await f.text())); alert_(`Backup restaurado (${n} pedidos no histórico).`); }
    catch (_) { alert_(' Arquivo de backup inválido.'); }
  });
  function alert_(m) { $('stockmsg').textContent = m; }

  /* ---------- salvar no histórico, rascunho, novo pedido ---------- */
  function saveOrder() {
    const P = currentPlan(); if (!P.L.length) return null;
    const o = order(P); let prev = S.curId ? S.hist.find(e => e.id === S.curId) : null;
    // segurança: nunca gravar o pedido de um cliente por cima do pedido de outro
    if (prev && up(prev.cliente.nome) !== up(o.cliente.nome) && confirm(`Este pedido estava salvo para ${prev.cliente.nome} e agora o cliente é ${o.cliente.nome}.\n\nOK = salvar como pedido NOVO (o de ${prev.cliente.nome} continua como está).\nCancelar = é o mesmo pedido, só corrigi o nome.`)) { prev = null; S.curId = null; }
    const id = S.curId || ('o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
    const ap = S.nota.rows.find(r => r.aplicado);
    const e = Features.makeEntry({ id, ts: prev ? prev.ts : Date.now(), dataISO: o.dataISO, cliente: o.cliente, inv: o.num.invoice, atNum: o.num.atestado, nf: $('nf').value || '', stamp: S.catStamp, P, nota: o.nota, catalog: cat(), rows: S.rows, cfg: S.cfg, kg: S.cfg.valores.kgCaixa, creditoAplicado: ap ? ap.unit : 0, prev, moeda: S.moeda.usd || S.moeda.en ? Object.assign({}, S.moeda) : null });
    e.upd = Date.now();
    if (prev) S.hist[S.hist.indexOf(prev)] = e; else S.hist.push(e);
    S.curId = id; saveHist(); renderClientes();
    $('saveMsg').textContent = `Pedido salvo no histórico (invoice ${e.inv}, ${e.cliente.nome}). O estoque da conferência já considera estas caixas.`;
    if (S.embData && PP.extra && PP.extra.embMove) { const em = PP.extra.embMove(e, S.embData), box = $('embAsk'); if (em && box) { box.hidden = false; box.dataset.id = e.id; box.innerHTML = `<span>✓ Este pedido está na programação do embarque de <b>${dBR(em.saida)}</b>.</span> <button type="button" data-ea="ver">Abrir programação</button>`; } }
    else embAsk(e);
    syncEmbData();
    return e;
  }

  /* ---------- depois de salvar: perguntar se entra na Programação de voos ---------- */
  const embAskDismissed = new Set(), dBR = iso => (iso ? iso.split('-').reverse().join('/') : '');
  function embAsk(e) {
    const box = $('embAsk'), X = PP.extra; if (!box || !X) return;
    const ja = X.embDoPedido(e.id);
    if (ja) { X.embAtualiza(e); box.hidden = false; box.innerHTML = `<span>✓ Este pedido está na programação do embarque de <b>${dBR(ja.saida)}</b> (caixas atualizadas).</span> <button type="button" data-ea="ver">Abrir programação</button>`; box.dataset.id = e.id; return; }
    if (embAskDismissed.has(e.id)) { box.hidden = true; return; }
    const L = X.embAbertos(), padrao = (L.find(x => x.saida === e.dataISO) || L[0] || {}).id || 'new';
    box.dataset.id = e.id; box.hidden = false;
    box.innerHTML = `<div><b>Colocar este pedido na Programação de voos?</b> <span class="muted">${esc(e.cliente.nome)} · ${e.totais.caixas} caixa(s)</span></div>
      <div class="row" style="margin-top:8px;align-items:flex-end"><div class="field grow"><label for="eaSel">Em qual embarque</label><select id="eaSel">${L.map(x => `<option value="${x.id}" ${x.id === padrao ? 'selected' : ''}>${esc(X.embLabel(x))}</option>`).join('')}<option value="new" ${padrao === 'new' ? 'selected' : ''}>＋ Criar novo embarque</option></select></div>
      <div class="field" id="eaNovoF" style="flex:0 1 160px" ${padrao === 'new' ? '' : 'hidden'}><label for="eaNovo">Saída do novo embarque</label><input id="eaNovo" type="date" value="${e.dataISO}"></div>
      <button type="button" class="primary" data-ea="ok">Colocar na programação</button><button type="button" data-ea="no">Agora não</button></div>`;
  }
  document.addEventListener('change', ev => { if (ev.target && ev.target.id === 'eaSel') { const f = $('eaNovoF'); if (f) f.hidden = ev.target.value !== 'new'; } });
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-ea]'); if (!b || !$('embAsk') || !$('embAsk').contains(b)) return;
    const box = $('embAsk'), id = box.dataset.id, e = S.hist.find(x => x.id === id), k = b.dataset.ea;
    if (k === 'no') { embAskDismissed.add(id); box.hidden = true; return; }
    if (k === 'ver') { go('embarque'); return; }
    if (k === 'ok' && e) {
      const v = $('eaSel').value, em = PP.extra.embColoca(e, v, v === 'new' ? ($('eaNovo').value || e.dataISO) : null);
      if (!em) return;
      box.innerHTML = `<span>✓ Pedido colocado na programação do embarque de <b>${dBR(em.saida)}</b> (${em.linhas.length} cliente(s)). Complete peso, AWB e situação lá.</span> <button type="button" data-ea="ver">Abrir programação</button>`;
    }
  });
  $('saveHist').onclick = () => { if (!saveOrder()) $('saveMsg').textContent = 'Leia um pedido primeiro.'; renderConf(); };
  function newOrder() {
    S.rows = []; S.ignored = []; S.curId = null; S.embData = ''; S.credit = false; S.nota = { rows: [], sig: '' }; syncEmbData();
    ['txt', 'nf'].forEach(k => { $(k).value = ''; }); $('qEmb2').value = '0'; $('temAt').checked = true; $('gtaAuto').checked = true;
    ['pedmsg', 'imgmsg', 'saveMsg'].forEach(k => { $(k).textContent = ''; }); if ($('embAsk')) $('embAsk').hidden = true; $('thumbs').innerHTML = ''; $('ocrRaw').hidden = true; $('draftBar').hidden = true; ocrAll = [];
    initFields(); invalidate(); store.del('draft'); renderClientes(); renderAll();
  }
  $('novoPed').onclick = () => { if (S.rows.length && !S.curId && !confirm('Começar um novo pedido? O pedido atual ainda não foi salvo no histórico (só é salvo ao baixar os documentos ou clicar em "Salvar no histórico").')) return; newOrder(); go('pedido'); };
  let draftT = null;
  function saveDraft() {
    clearTimeout(draftT);
    draftT = setTimeout(() => {
      if (!S.rows.length && !$('txt').value.trim()) { store.del('draft'); return; }
      const d = { ts: Date.now(), cli: cliente().nome, txt: $('txt').value, rows: S.rows, ignored: S.ignored, curId: S.curId, credit: S.credit, moeda: S.moeda, stamp: S.catStamp, nota: S.nota.rows.filter(r => !r.aplicado) };
      ['inv', 'atNum', 'nf', 'data', 'dia', 'vGta', 'vAt', 'vEmb', 'qEmb2'].forEach(k => { d[k] = $(k).value; }); ['gtaAuto', 'temAt'].forEach(k => { d[k] = $(k).checked; });
      store.set('draft', d);
    }, 400);
  }
  function restoreDraft() {
    const d = store.get('draft', null); if (!d || (!(d.rows || []).length && !(d.txt || '').trim())) return;
    const i = S.clientes.findIndex(c => c.nome === d.cli); if (i >= 0) S.cli = i;
    S.curId = d.curId || null; S.credit = !!d.credit; invalidate();
    $('txt').value = d.txt || '';
    ['inv', 'atNum', 'nf', 'data', 'dia', 'vGta', 'vAt', 'vEmb', 'qEmb2'].forEach(k => { if (d[k] !== undefined) $(k).value = d[k]; }); ['gtaAuto', 'temAt'].forEach(k => { if (d[k] !== undefined) $(k).checked = d[k]; });
    if (d.moeda) { S.moeda = d.moeda; syncMoedaUI(); }
    S.rows = d.stamp === S.catStamp ? (d.rows || []) : []; S.ignored = d.ignored || [];
    if (S.rows.length && d.nota && d.nota.length) S.nota.keep = d.nota;
    renderClientes();
    const hh = new Date(d.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    $('draftBar').hidden = false; $('draftBar').textContent = `Recuperei o pedido que estava em andamento (${d.cli}, ${hh}). Para começar outro, clique em "Novo pedido".`;
    if (!S.rows.length && S.catalog.length && $('txt').value.trim()) $('ler').click();
  }

  /* ---------- abrir pedido do histórico / repetir ---------- */
  function rowsFromSnap(snap) {
    const c = cat(), out = [], miss = [];
    snap.forEach(sr => {
      const key = [sr.sci, sr.comum, sr.caixa, sr.rio || ''].join('|');
      const it = c.find(x => Core.itemKey(x) === key) || c.find(x => x.sci === sr.sci && x.comum === sr.comum) || c.find(x => x.sci === sr.sci);
      if (!it) { miss.push(sr.comum); return; }
      const cands = c.filter(x => x.sci === it.sci && x.comum === it.comum);
      const r = { qty: sr.qty, raw: sr.raw || sr.comum, cands: cands.length ? cands : [it], sel: it.id, use: sr.use, mode: sr.mode, boxes: sr.boxes, group: sr.group };
      if (sr.perBox) r.perBox = sr.perBox; if (sr.frac) r.frac = sr.frac; if (sr.preco && sr.preco !== it.preco) r.preco = sr.preco;
      if (r.mode === 'inteira') r.qty = r.boxes * Core.perBoxOf(r, it);
      out.push(r);
    });
    return { rows: out, miss };
  }
  function loadEntry(id, mode) {
    const e = S.hist.find(x => x.id === id); if (!e) return;
    newOrder();
    let i = S.clientes.findIndex(c => up(c.nome) === up(e.cliente.nome));
    if (i < 0) { S.clientes.push({ nome: e.cliente.nome, end: e.cliente.end }); i = S.clientes.length - 1; saveClientes(); }
    S.cli = i; invalidate();
    if (mode === 'edit') {
      S.curId = e.id; invalidate();
      $('inv').value = e.inv; $('atNum').value = e.atNum || ''; $('nf').value = e.nf || ''; $('data').value = e.dataISO; $('dia').value = e.dia || $('dia').value; $('temAt').checked = !!e.temAt;
      Object.assign(S.moeda, e.moeda || { usd: false, en: false }); syncMoedaUI();
      S.credit = e.creditoAplicado > 0;
    }
    syncEmbData();
    const r = rowsFromSnap(e.rows);
    S.rows = r.rows; S.ignored = r.miss.length ? ['Não achei mais na stocklist atual: ' + r.miss.join(', ')] : [];
    S.nota.sig = '';
    if (mode === 'edit') S.nota.keep = e.nota.rows.filter(x => !x.aplicado);
    $('txt').value = e.rows.map(x => x.raw).join('\n');
    renderClientes(); renderAll(); go('pedido');
    $('draftBar').hidden = false; $('draftBar').textContent = mode === 'edit' ? `Editando o pedido de ${e.cliente.nome} (invoice ${e.inv}). Ao baixar, ele é atualizado no histórico.` : `Pedido repetido de ${e.cliente.nome}: preços e estoque são os de hoje. Confira antes de gerar.`;
  }
  const up = s => String(s || '').trim().toUpperCase();

  /* ---------- conferência automática entre documentos ---------- */
  let builtIssues = null;
  function renderCheck(P, o) {
    const box = $('checkBox'); if (!P.L.length) { box.hidden = true; return; }
    const list = Features.crossCheck({ P, nota: o.nota, rows: S.rows, catalog: cat(), cliente: o.cliente, num: o.num, hist: S.hist, curId: S.curId, kg: S.cfg.valores.kgCaixa });
    if (builtIssues) builtIssues.forEach(t => list.push(t));
    S.lastCheck = list;
    const bad = list.filter(x => x.lvl === 'bad').length, warn = list.filter(x => x.lvl === 'warn').length;
    const head = bad ? `${bad} problema(s) para resolver antes de gerar` : warn ? `Tudo bate, com ${warn} aviso(s)` : 'Tudo confere entre os documentos';
    box.hidden = false; box.className = 'checkbox ' + (bad ? 'bad' : warn ? 'warn' : 'ok');
    box.innerHTML = `<details ${bad || warn ? 'open' : ''}><summary><b>Conferência dos documentos:</b> ${head}</summary><ul>${list.map(x => `<li class="${x.lvl}"><span aria-hidden="true">${x.lvl === 'ok' ? '✔' : x.lvl === 'warn' ? '!' : '✖'}</span> ${esc(x.txt)}</li>`).join('')}</ul></details>`;
  }
  // abre os arquivos que acabaram de ser gerados e confere se o que está dentro bate com o pedido
  async function verifyBuilt(files, P) {
    const out = [], num = n => +n;
    try {
      const inv = files.find(f => f.name.startsWith('INVOICE')); if (inv) {
        const x = await (await JSZip.loadAsync(inv.bytes)).file('xl/worksheets/sheet1.xml').async('string');
        const cx = x.match(/<f>SUM\(C9:D\d+\)<\/f><v>([\d.]+)<\/v>/), pe = x.match(/<f>SUM\(L9:M\d+\)<\/f><v>([\d.]+)<\/v>/);
        out.push(cx && pe && num(cx[1]) === P.total && num(pe[1]) === P.peixes ? { lvl: 'ok', txt: `Arquivo da invoice aberto e conferido: ${P.total} caixas e ${fmtInt(P.peixes)} peixes.` } : { lvl: 'bad', txt: 'A invoice gerada não bate com o pedido (caixas/peixes).' });
      }
      const et = files.find(f => f.name.startsWith('ETIQUETAS')); if (et) {
        const x = await (await JSZip.loadAsync(et.bytes)).file('word/document.xml').async('string'), n = (x.match(/<w:t[^>]*>\d\d\/\d\d<\/w:t>/g) || []).length;
        out.push(n === P.boxes.length ? { lvl: 'ok', txt: `Arquivo das etiquetas aberto e conferido: ${n} etiquetas.` } : { lvl: 'bad', txt: `O arquivo de etiquetas tem ${n} etiquetas e o pedido ${P.boxes.length} caixas.` });
      }
      const pk = files.find(f => f.name.startsWith('PACKINGLIST')); if (pk) {
        const x = (await (await JSZip.loadAsync(pk.bytes)).file('word/document.xml').async('string')).replace(/<[^>]+>/g, ' '), falta = P.L.filter(l => !x.includes(l.it.sci));
        out.push(!falta.length ? { lvl: 'ok', txt: 'Arquivo do packing list aberto e conferido: todas as espécies estão nele.' } : { lvl: 'bad', txt: 'Faltam no packing list: ' + falta.map(l => l.it.sci).join(', ') });
      }
    } catch (err) { out.push({ lvl: 'warn', txt: 'Não consegui reabrir os arquivos gerados para conferir.' }); }
    return out;
  }
  const printEl = (html) => { $('printArea').innerHTML = html; document.body.classList.add('printing'); setTimeout(() => { window.print(); setTimeout(() => { document.body.classList.remove('printing'); $('printArea').innerHTML = ''; }, 300); }, 50); };
  $('printDoc').onclick = () => { const z = $('doc').cloneNode(true); z.querySelectorAll('.dlrow,.copyrow,textarea,.note').forEach(x => x.remove()); printEl(z.innerHTML); };

  /* ---------- fatura em dólar / inglês ---------- */
  function syncMoedaUI() { $('moeda').value = S.moeda.usd ? 'usd' : S.moeda.en ? 'en' : 'brl'; $('taxa').value = S.moeda.taxa; $('taxaBox').hidden = !S.moeda.usd; }
  $('moeda').addEventListener('change', e => { S.moeda.usd = e.target.value === 'usd'; S.moeda.en = e.target.value === 'en'; $('taxaBox').hidden = !S.moeda.usd; renderDoc(); });
  $('taxa').addEventListener('input', e => { S.moeda.taxa = parseFloat(e.target.value) || 0; renderDoc(); });

  /* ---------- pedido por voz ---------- */
  (function () {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition, btn = $('voz'), msg = $('vozMsg'); let rec = null, on = false;
    if (!SR) { btn.disabled = true; msg.textContent = 'Seu navegador não tem reconhecimento de voz (use o Chrome).'; return; }
    btn.onclick = () => {
      if (on) { rec.stop(); return; }
      rec = new SR(); rec.lang = 'pt-BR'; rec.continuous = true; rec.interimResults = false;
      rec.onresult = ev => { for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) { const t = Features.spokenToDigits(ev.results[i][0].transcript); $('txt').value = ($('txt').value.replace(/\s+$/, '') + (($('txt').value.trim()) ? '\n' : '') + t); } $('txt').dispatchEvent(new Event('input')); };
      rec.onerror = ev => { msg.textContent = ev.error === 'not-allowed' ? 'Permita o microfone no navegador.' : 'Erro no microfone: ' + ev.error; };
      rec.onend = () => { on = false; btn.textContent = 'Falar o pedido'; msg.textContent = msg.textContent.startsWith('Erro') || msg.textContent.startsWith('Permita') ? msg.textContent : 'Pronto. Confira o texto: uma linha por espécie (diga “linha” ou fale uma de cada vez).'; };
      on = true; btn.textContent = '■ Parar'; msg.textContent = 'Ouvindo… fale uma espécie por vez, ex.: “duzentos e cinquenta borboleta listrada”.'; rec.start();
    };
  })();
  $('limpaTxt').onclick = () => { $('txt').value = ''; ocrAll = []; $('thumbs').innerHTML = ''; $('ocrRaw').hidden = true; };

  /* ---------- telas ---------- */
  const ICONS = {
    hoje: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z', pedido: 'M9 3h6v3H9z M7 5H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2 M8 12h8 M8 16h5',
    exp: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z', embarque: 'M5 4h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M4 9h16 M8 2v4 M16 2v4',
    frete: 'M2 6h12v10H2z M14 10h4.5l3.5 3.5V16H14z M7 19.2a1.6 1.6 0 1 0 0-.01 M17.5 19.2a1.6 1.6 0 1 0 0-.01', hist: 'M4 6h16 M4 12h16 M4 18h10', painel: 'M5 20V10 M12 20V4 M19 20v-7', relat: 'M7 9V3h10v6 M6 18H4v-7h16v7h-2 M7 14h10v7H7z',
    estoque: 'M21 8l-9-5-9 5v8l9 5 9-5z M3 8l9 5 9-5 M12 13v8', clientes: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8', mapa: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 13h7 M9 17h5', tarefas: 'M9 11l3 3 8-8 M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11', cfg: 'M4 7h10 M18 7h2 M4 17h2 M10 17h10 M14 4v6 M6 14v6', mais: 'M4 7h16 M4 12h16 M4 17h16',
    alert: 'M12 3l10 18H2z M12 10v5 M12 18v.01', clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2', mail: 'M3 6h18v12H3z M3 7l9 6 9-6', cloud: 'M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.5a4 4 0 0 1 0 8H7z', dollar: 'M12 3v18 M16 7.5C16 6 14 5 12 5S8 6 8 7.5 10 10 12 10.5s4 1.5 4 3-2 2.5-4 2.5-4-1-4-2.5'
  };
  const icon = (k, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k].split(' M').map((d, i) => `<path d="${i ? 'M' : ''}${d}"/>`).join('')}</svg>`;
  const VIEWS = [['hoje', 'Hoje', 'vHoje', 'hoje', 'Início'], ['pedido', 'Nacional', 'vPedido', 'pedido', 'Operação'], ['exp', 'Exportação ✈', 'vExp', 'exp'], ['mapa', 'Notas de entrada', 'vMapa', 'mapa'], ['embarque', 'Programação de voos', 'vEmbarque', 'embarque'], ['frete', 'Frete 🚚', 'vFrete', 'frete'], ['hist', 'Histórico', 'vHist', 'hist', 'Gestão'], ['financeiro', 'Financeiro', 'vFinanceiro', 'dollar'], ['clientes', 'Clientes', 'vClientes', 'clientes'], ['painel', 'Painel', 'vPainel', 'painel'], ['relat', 'Romaneio e relatórios', 'vRelat', 'relat'], ['estoque', 'Estoque e reposição', 'vEstoque', 'estoque'], ['tarefas', 'Tarefas', 'vTarefas', 'tarefas']];
  const BAR = [['hoje', 'Hoje'], ['pedido', 'Pedido'], ['exp', 'Export.'], ['frete', 'Frete']];
  const TITLES = { hoje: null, pedido: 'Pedido nacional', exp: 'Exportação', embarque: 'Programação de voos', frete: 'Frete', hist: 'Histórico', financeiro: 'Financeiro', painel: 'Painel', relat: 'Romaneio e relatórios', estoque: 'Estoque e reposição', mapa: 'Notas de entrada (MAPA)', tarefas: 'Tarefas', clientes: 'Clientes' };
  const lbl = n => n.replace(/ ?[✈🚚]/g, '').trim();
  /* menu lateral: ordem e itens ocultos ficam em S.cfg.menu (sincroniza com a nuvem) */
  const NAV_HEADS = { '#in': 'Início', '#op': 'Operação', '#ge': 'Gestão' };
  const NAV_DEFAULT = ['#in', 'hoje', '#op', 'pedido', 'exp', 'mapa', 'embarque', 'frete', '#ge', 'hist', 'financeiro', 'clientes', 'painel', 'relat', 'estoque', 'tarefas'];
  const navName = k => (NAV_HEADS[k] !== undefined ? NAV_HEADS[k] : ((VIEWS.find(x => x[0] === k) || [])[1] ? lbl(VIEWS.find(x => x[0] === k)[1]) : k));
  function navOrder() {
    const m = (S.cfg && S.cfg.menu) || {}, saved = Array.isArray(m.order) ? m.order : [], out = [];
    saved.forEach(k => { if (NAV_DEFAULT.includes(k) && !out.includes(k)) out.push(k); });
    NAV_DEFAULT.forEach(k => { if (!out.includes(k)) out.push(k); }); // tela nova entra no fim
    return out;
  }
  const navHidden = () => { const m = (S.cfg && S.cfg.menu) || {}; return (Array.isArray(m.hide) ? m.hide : []).filter(k => NAV_DEFAULT.includes(k) && k !== 'hoje'); };
  function navSave(order, hide) {
    S.cfg.menu = { order: order.slice(), hide: hide.filter(k => k !== 'hoje') }; saveCfg();
    renderNav(S.view); if (window.PP && PP.menuCfg) PP.menuCfg.render();
  }
  function renderNav(v) {
    const open = PP.assist && PP.assist.openCount ? PP.assist.openCount('frete') : 0, hide = navHidden();
    const itens = navOrder().filter(k => !hide.includes(k));
    // título de seção sem nenhuma tela depois dele (até o próximo título) não aparece
    const vis = itens.filter((k, i) => !NAV_HEADS[k] || (itens[i + 1] && !NAV_HEADS[itens[i + 1]]));
    $('nav').innerHTML = vis.map(k => NAV_HEADS[k] !== undefined ? `<div class="ngrp">${NAV_HEADS[k]}</div>` : `<button type="button" role="tab" aria-selected="${k === v}" data-view="${k}">${icon((VIEWS.find(x => x[0] === k) || [])[3])}<span>${navName(k)}</span>${k === 'frete' && open ? `<b class="bdg">${open}</b>` : ''}</button>`).join('');
    $('bar').innerHTML = BAR.map(([k, n]) => `<button type="button" data-view="${k}" class="${k === v ? 'on' : ''}">${icon(k)}${n}</button>`).join('') + `<button type="button" id="barMore">${icon('mais')}Mais</button>`;
  }
  function go(v) {
    S.view = v; document.body.dataset.view = v; document.body.classList.toggle('xwide', false); document.body.classList.remove('menu'); $('menuBack').hidden = true;
    VIEWS.forEach(([k, , id]) => { $(id).hidden = k !== v; });
    renderNav(v);
    const tt = $('vtitle'); if (v === 'hoje') { if (PP.hoje) PP.hoje.title(); } else tt.textContent = TITLES[v] || v;
    document.title = (v === 'hoje' ? '' : (TITLES[v] || '') + ' · ') + 'Sistema de Pedidos - Prestige Aquarium Ltda';
    if (v === 'hoje') { if (PP.hoje) PP.hoje.render(); } else if (v === 'exp') { if (PP.exp) PP.exp.render(v); } else if (v === 'frete') { if (PP.frete) PP.frete.render(); } else if (v === 'mapa') { if (PP.mapa) PP.mapa.render(); } else if (v === 'financeiro') { if (PP.fin) PP.fin.render(); } else if (v === 'tarefas') { if (PP.kanban) PP.kanban.render(); } else if (v === 'clientes') { if (PP.clientes) PP.clientes.render(); } else if (v !== 'pedido' && PP.extra) PP.extra.render(v);
    const el = $(VIEWS.find(x => x[0] === v)[2]); el.classList.remove('vin'); void el.offsetWidth; el.classList.add('vin');
    if (PP.side) PP.side.render();
    if (PP.assist) PP.assist.refresh();
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b && (b.closest('#nav') || b.closest('#bar'))) { const vv = b.dataset.view; if (window.PP && PP.motion && vv !== S.view) PP.motion.vt(() => go(vv)); else go(vv); } if (e.target.closest('#barMore')) { document.body.classList.add('menu'); $('menuBack').hidden = false; } if (e.target.id === 'menuBack') { document.body.classList.remove('menu'); $('menuBack').hidden = true; } });

  /* ---------- configurações em gaveta ---------- */
  const cfgEl = $('config');
  const syncBack = () => { $('cfgBack').hidden = !cfgEl.open; document.body.classList.toggle('xnoscroll', cfgEl.open); };
  cfgEl.addEventListener('toggle', syncBack);
  $('btnCfg').innerHTML = icon('cfg') + ' Configurações';
  $('btnCfg').onclick = () => { cfgEl.open = true; document.body.classList.remove('menu'); $('menuBack').hidden = true; cfgEl.scrollTop = 0; };
  $('cfgBack').onclick = () => { cfgEl.open = false; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && cfgEl.open && $('srch').hidden) cfgEl.open = false; });

  /* ---------- avisos no topo ---------- */
  function renderBanners() {
    const out = [], last = store.get('lastBackup', 0), has = S.hist.length || S.clientes.length;
    const snooze = store.get('bkSnooze', 0);
    if (has && Date.now() - last > 7 * 86400000 && Date.now() > snooze) {
      const dias = last ? Math.floor((Date.now() - last) / 86400000) : null;
      out.push(`<div class="warnbox"><b>Backup:</b> ${dias === null ? 'você ainda não baixou nenhum backup.' : 'faz ' + dias + ' dias que você não baixa o backup.'} Os dados ficam só neste navegador. <button type="button" id="bnBk" class="primary">Baixar backup agora</button> <button type="button" id="bnLater">Lembrar depois</button></div>`);
    }
    if (store.cheio) out.unshift('<div class="warnbox" style="border-color:var(--bad)"><b>Sem espaço no navegador:</b> a última alteração não foi salva. Baixe um backup agora e depois apague stocklists ou pedidos antigos. <button type="button" id="bnBk2" class="primary">Baixar backup agora</button></div>');
    if (!S.catalog.length) out.unshift('<div class="warnbox"><b>Comece por aqui:</b> envie a sua stocklist (.xlsx) em Configurações. <button type="button" id="bnCfg" class="primary">Abrir Configurações</button></div>');
    $('banners').innerHTML = out.join('');
  }
  document.addEventListener('click', e => {
    if (e.target.id === 'bnCfg') { if (PP.cfgTab) PP.cfgTab('stock'); $('btnCfg').click(); }
    if (e.target.id === 'bnBk' || e.target.id === 'bnBk2') $('bkExport').click();
    if (e.target.id === 'bnLater') { store.set('bkSnooze', Date.now() + 2 * 86400000); renderBanners(); }
  });

  /* ---------- geral ---------- */
  function renderAll() { builtIssues = null; renderConf(); renderSum(); renderDoc(); if (window.PP && window.PP.side) window.PP.side.render(); }
  ['inv', 'atNum', 'nf', 'data', 'dia', 'gtaAuto', 'vGta', 'temAt', 'vAt', 'vEmb', 'qEmb2'].forEach(id => $(id).addEventListener('input', () => { builtIssues = null; renderSum(); renderDoc(); if (window.PP && window.PP.side) window.PP.side.render(); }));

  renderConfigForms(); renderNames(); refreshCatInfo(); renderClientes(); initFields(); syncMoedaUI(); bkLabel(); renderBanners(); restoreDraft(); renderAll();
  function reloadState() { // relê tudo do armazenamento (usado depois de puxar dados da nuvem)
    S.catalog = store.get('catalog', []); S.catalogInfo = store.get('catalogInfo', ''); S.catStamp = store.get('catStamp', 0); S.clientes = store.get('clientes', []); S.hist = store.get('hist', []); { const vivos = new Set(S.hist.map(e => e && e.id)); _hsig.forEach((j, id) => { if (!vivos.has(id)) lixo(j, 'removido pela sincronização'); }); } histSnap(); S.embarques = store.get('embarques', []);
    S.cfg = Object.assign(clone(Core.DEFAULT_CFG), store.get('cfg', {}));
    ['apelidos', 'apelidosNota', 'etiquetas'].forEach(k => { S.cfg[k] = Object.assign({}, Core.DEFAULT_CFG[k], S.cfg[k] || {}); });
    ['empresa', 'vet', 'valores', 'numeracao', 'embarque'].forEach(k => { S.cfg[k] = Object.assign({}, Core.DEFAULT_CFG[k], S.cfg[k] || {}); });
    S.cfg.prazoPag = S.cfg.prazoPag || 7; S.cfg.prazoExpCobrar = S.cfg.prazoExpCobrar || 10; S.cfg.prazoExpAtraso = S.cfg.prazoExpAtraso || 15; if (S.cli >= S.clientes.length) S.cli = 0;
    invalidate(); renderConfigForms(); renderNames(); refreshCatInfo(); renderClientes(); if (!S.curId) initNumbers(); renderAll(); renderBanners(); if (PP.exp) PP.exp.reload(); if (PP.frete) PP.frete.reload(); if (S.view === 'exp') { if (PP.exp) PP.exp.render('exp'); } else if (S.view === 'frete') { if (PP.frete) PP.frete.render(); } else if (S.view === 'mapa') { if (PP.mapa) PP.mapa.render(true); } else if (S.view === 'tarefas') { if (PP.kanban) PP.kanban.render(); } else if (S.view === 'clientes') { if (PP.clientes) PP.clientes.render(); } else if (S.view !== 'pedido' && PP.extra) PP.extra.render(S.view);
  }
  const PP = window.PP = { aplicarBackup, syncEmbData, icon, reloadState, printHTML: printEl, S, store, Core, Features, cat, invalidate, saveHist, saveClientes, $, fmt, fmtInt, esc, clone, saveBlob, renderAll, loadEntry, newOrder, currentPlan, order, go, cliente, docs, MIME, slug, up, listeners, bufToB64, renderClientes, renderBanners, bkLabel, snapshot, notaState };
  PP.nav = { heads: NAV_HEADS, def: NAV_DEFAULT, name: navName, order: navOrder, hidden: navHidden, save: navSave, render: () => renderNav(S.view) };
  go('hoje');
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { /* sem modo offline */ });
  window.__app = { S, Core, order, currentPlan, buildFile, renderAll, PP };
})();
