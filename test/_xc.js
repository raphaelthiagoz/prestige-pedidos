
  /* ============================================================
     lógica da tela
     ============================================================ */
  const yr = () => S.ano || CFG.ano;
  const numStr = () => p3(curN()) + '/' + yr();
  /* ordem nos documentos: do que mais sai (mais peixes) para o que menos sai */
  const rankOf = x => { const i = (CFG.ordem || []).indexOf(String(x.sci || '').trim().toUpperCase()); return i < 0 ? 1e9 : i; };
  function byQty(L) { return L.map((x, i) => [x, i]).sort((a, b) => rankOf(a[0]) - rankOf(b[0]) || ((+b[0].boxes || 0) * (+b[0].qpb || 0)) - ((+a[0].boxes || 0) * (+a[0].qpb || 0)) || (+b[0].boxes || 0) - (+a[0].boxes || 0) || a[1] - b[1]).map(z => z[0]); }
  function SI() { const L = S.items.filter(x => +x.boxes > 0); return S.ordem === 'manual' ? L : byQty(L); }
  function moveItem(from, to) {
    if (from === to || from < 0 || to < 0 || from >= S.items.length || to >= S.items.length) return;
    S.items.splice(to, 0, S.items.splice(from, 1)[0]); S.ordem = 'manual'; renderExp();
  }
  function autoOrder() { S.items = byQty(S.items); S.ordem = 'auto'; renderExp(); }
  function saveOrdem() {
    const cur = []; S.items.forEach(x => { const k = String(x.sci || '').trim().toUpperCase(); if (k && !cur.includes(k)) cur.push(k); });
    if (!cur.length) { S.msg = 'Carregue um pedido primeiro.'; renderExp(); return; }
    CFG.ordem = cur.concat((CFG.ordem || []).filter(k => !cur.includes(k))); saveCfg();
    S.msg = `Ordem guardada (${CFG.ordem.length} espécies). Vale para os próximos pedidos de exportação.`; renderExp();
  }
  function clearOrdem() { CFG.ordem = []; saveCfg(); S.msg = 'Ordem guardada apagada. Volta a valer "mais peixes primeiro".'; if (S.ordem !== 'manual') S.items = byQty(S.items); renderExp(); }
  const unit = x => (x.kg === '' || x.kg == null ? unitKg() : +x.kg);
  const orderObj = () => ({
    dest: S.dest, cons: S.cons, invNum: p3(curN()), ano: yr(), dateISO: S.date,
    items: SI().map(x => ({ sci: x.sci, pt: x.pt, boxes: +x.boxes || 0, qpb: +x.qpb || 0, price: +x.price || 0, kg: unit(x) })),
    rate: +S.conv.rate || 0, ex: S.ex
  });
  const gv = p => p.split('.').reduce((o, k) => (o == null ? o : o[k]), S);
  function setP(path, v) { const ks = path.split('.'); let o = S; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = v; }

  function docList() {
    const D = DEST[S.dest], n = p3(curN()) + '.' + yr(), L = [];
    L.push({ id: 'inv', name: `INVOICE_${n}.xlsx`, label: 'Invoice (US$)', ext: 'xlsx', build: () => ED.invoiceUsd(orderObj()) });
    if (S.conv.on) L.push({ id: 'brl', name: `INVOICE_${n}_EM_REAIS_uso_interno.xlsx`, label: 'Invoice convertida em R$ (uso interno)', ext: 'xlsx', build: () => ED.invoiceBrl(orderObj()), need: +S.conv.rate > 0 ? '' : 'informe a cotação do dólar' });
    L.push({ id: 'pl', name: `PACKINGLIST_${n}.docx`, label: 'Packing List', ext: 'docx', build: () => ED.packingDocx(orderObj()) });
    L.push({ id: 'et', name: `ETIQUETAS_${n}.docx`, label: 'Etiquetas (1 por caixa)', ext: 'docx', build: () => ED.etiquetasDocx(orderObj()) });
    D.atest.forEach(k => L.push({ id: 'at:' + k, name: `${k === 'VIG' ? 'ATESTADO_VIGIAGRO' : 'ATESTADO_SISA_' + { EU: 'EUROPA', US: 'EUA', JP: 'JAPAO' }[k]}_${n}.docx`, label: ATN[k], ext: 'docx', build: () => ED.doc(k === 'VIG' ? D.vig : SISA_KEY[k], orderObj()) }));
    D.czi.forEach(k => L.push({ id: 'cz:' + k, name: `CZI_${{ EN: 'INGLES_AMS', US: 'ESTADOS_UNIDOS', DE: 'ALEMANHA_JAPAO', JP: 'JAPAO' }[k]}_${n}.docx`, label: CZN[k].split(' (')[0], ext: 'docx', build: () => ED.doc(CZI_KEY[k], orderObj()) }));
    return L;
  }
  function missing() {
    const e = S.ex, m = [];
    if (!S.items.length) m.push('nenhuma espécie no pedido');
    S.items.filter(x => +x.boxes > 0 && !x.pt).forEach(x => m.push('nome comum de ' + x.sci));
    S.items.filter(x => +x.boxes > 0 && (!(+x.qpb > 0) || !(+x.price > 0))).forEach(x => m.push('qtd/caixa ou preço de ' + x.sci));
    [['nf', 'Nota Fiscal nº (etiquetas)'], ['dued', 'DU-E (etiquetas)'], ['lpcoIbama', 'LPCO IBAMA (etiquetas)'], ['lpcoMapa', 'LPCO MAPA (CZI)'], ['mawb', 'MAWB (CZI)'], ['dep', 'partida (CZI)'], ['gta', 'GTA (Vigiagro)']].forEach(([k, l]) => { if (!e[k]) m.push(l); });
    return m;
  }
  const rate4 = v => String(v).replace('.', ',');

  /* ---------- ler a stocklist de exportação (.xlsx) ---------- */
  const cellText = c => { let v = c && c.value; if (v == null) return ''; if (typeof v === 'object') { if (v.richText) return v.richText.map(r => r.text).join(''); if ('result' in v) return v.result == null ? '' : String(v.result); if (v.text) return String(v.text); return ''; } return String(v); };
  const cellNum = c => { const v = c && c.value; const x = v && typeof v === 'object' && 'result' in v ? v.result : v; const n = typeof x === 'number' ? x : parseFloat(String(x == null ? '' : x).replace(',', '.')); return isFinite(n) ? n : NaN; };
  async function parseExportStock(buf) {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
    const ws = wb.worksheets[0]; let hdr = 0, cols = {};
    for (let r = 1; r <= Math.min(ws.rowCount, 60) && !hdr; r++) {
      const row = ws.getRow(r), map = {}; let nm = false, pr = false;
      row.eachCell({ includeEmpty: false }, (c, i) => { const t = cellText(c).trim().toLowerCase(); if (t === 'name') { if (!map.name) map.name = i; nm = true; } else if (t.startsWith('city')) map.city = map.city || i; else if (t === 'common name') map.en = map.en || i; else if (t === 'size') map.size = map.size || i; else if (/^(qtd|qty|quant)/.test(t)) map.qpb = i; else if (t.startsWith('price')) { map.price = i; pr = true; } else if (t.startsWith('stock')) map.stock = i; else if (t.startsWith('order') || t.startsWith('seu pedido')) { map.order = i; map.month = cellText(c).trim(); } });
      if (nm && pr) { hdr = r; cols = map; }
    }
    if (!hdr || !cols.order) return { error: 'Não encontrei as colunas Name, Price e "Order …" nesta planilha.' };
    const all = [];
    for (let r = hdr + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r), sci = cellText(row.getCell(cols.name)).replace(/\s+/g, ' ').trim(), price = cellNum(row.getCell(cols.price)), qpb = cols.qpb ? cellNum(row.getCell(cols.qpb)) : NaN;
      if (!sci || !(price >= 0) || !(qpb > 0)) continue;
      const boxes = cellNum(row.getCell(cols.order));
      all.push({ sci: sci.toUpperCase(), en: cols.en ? cellText(row.getCell(cols.en)).trim() : '', size: cols.size ? cellText(row.getCell(cols.size)).trim() : '', qpb, price, stock: cols.stock ? cellText(row.getCell(cols.stock)).trim() : '', boxes: boxes > 0 ? boxes : 0 });
    }
    return { all, month: cols.month || '' };
  }
  const normT = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  function addItem(base) { S.items.push(Object.assign({ sci: '', pt: '', boxes: 1, qpb: '', price: '', kg: '' }, base)); }
  function itemFromStock(x, boxes) { return { sci: x.sci, pt: ptOf(x.sci) || '', boxes, qpb: x.qpb, price: x.price, kg: '' }; }
  async function importFile(file) {
    S.msg = '';
    try {
      const r = await parseExportStock(await file.arrayBuffer());
      if (r.error) { S.msg = r.error; return; }
      store.set('expstock', r.all);
      const ord = r.all.filter(x => x.boxes > 0);
      S.ordem = 'auto'; S.items = byQty(ord.map(x => itemFromStock(x, x.boxes)));
      S.msg = ord.length ? `Li ${ord.length} linhas de "${r.month}" (${S.items.reduce((a, x) => a + (+x.boxes), 0)} caixas). Confira os nomes comuns e as caixas abaixo.` : 'A stocklist foi lida, mas nenhuma linha tem caixas na coluna do pedido.';
    } catch (e) { S.msg = 'Não consegui ler este arquivo (' + (e.message || e) + ').'; }
  }
  function importText(txt) {
    const stock = store.get('expstock', []), out = [], miss = [];
    String(txt || '').split(/\n+/).forEach(line => {
      const m = /^\s*(\d+(?:[.,]\d+)?)\s*(?:cx|caixas?|boxes?|x)?\s*[-–:]?\s*(.+?)\s*$/i.exec(line); if (!m) return;
      const boxes = parseFloat(m[1].replace(',', '.')), q = normT(m[2]).split(' ').filter(Boolean);
      const hit = stock.filter(x => { const h = normT(x.sci + ' ' + x.en + ' ' + ptOf(x.sci)); return q.every(t => h.includes(t)); })[0];
      if (hit) out.push(itemFromStock(hit, boxes)); else { out.push({ sci: String(m[2]).trim().toUpperCase(), pt: ptOf(m[2]) || '', boxes, qpb: '', price: '', kg: '' }); miss.push(m[2].trim()); }
    });
    S.items = S.ordem === 'manual' ? S.items.concat(byQty(out)) : byQty(S.items.concat(out));
    S.msg = out.length ? `${out.length} linhas lidas${miss.length ? '; sem preço/embalagem (preencha na tabela): ' + miss.join(', ') : '.'}` : 'Nenhuma linha reconhecida. Use o formato "8 corydoras schwartzi" (caixas + nome).';
  }

  /* ---------- PTAX (Banco Central) ---------- */
  async function buscaPtax() {
    S.conv.msg = 'Buscando no Banco Central…'; liveMsgs();
    try {
      let d = new Date((S.conv.date || todayISO()) + 'T12:00:00');
      for (let i = 0; i < 7; i++) {
        const q = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
        const r = await fetch(`https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${q}'&$format=json`);
        const j = await r.json();
        if (j.value && j.value.length) { const v = j.value[j.value.length - 1]; S.conv.rate = v.cotacaoCompra; S.conv.date = F.todayISO(d); S.conv.msg = 'PTAX compra de ' + dBR(S.conv.date) + ' = ' + rate4(v.cotacaoCompra) + ' (Banco Central). Você pode editar o valor.'; persist(); renderExp(); return; }
        d.setDate(d.getDate() - 1);
      }
      S.conv.msg = 'O Banco Central não devolveu cotação (hoje ainda sem PTAX?). Digite o valor.';
    } catch (e) { S.conv.msg = 'Não consegui consultar o Banco Central daqui (sem internet ou bloqueio do navegador). Digite a cotação manualmente.'; }
    persist(); renderExp();
  }

  /* ---------- histórico / numeração ---------- */
  function saveEntry() {
    const t = T(), now = Date.now();
    let e = S.curId && HIST.find(x => x.id === S.curId);
    const body = { dest: S.dest, dateISO: S.date, cons: clone(S.cons), items: clone(S.items), ordem: S.ordem, ex: clone(S.ex), conv: clone(S.conv), rot: clone(S.rot), tot: { boxes: t.boxes, fish: t.fish, goods: t.goods, fee: t.fee, total: t.total }, ts: now };
    if (e) Object.assign(e, body);
    else {
      const n = CFG.last + 1; e = Object.assign({ id: 'x' + now.toString(36) + Math.random().toString(36).slice(2, 6), n, ano: yr() }, body);
      HIST.push(e); S.curId = e.id; S.n = n; S.ano = e.ano; CFG.last = n; CFG.used = (CFG.used || []).filter(u => u.n !== n); CFG.used.push({ n, d: S.dest, dt: dBR(S.date) }); saveCfg();
    }
    saveHist(); persist(); return e;
  }
  function openEntry(id) {
    const e = HIST.find(x => x.id === id); if (!e) return;
    S = Object.assign(fresh(e.dest), { dest: e.dest, date: e.dateISO, cons: clone(e.cons), items: clone(e.items), ordem: e.ordem || 'auto', ex: Object.assign(newEx(), clone(e.ex)), conv: Object.assign({ on: true, rate: '', date: todayISO(), msg: '' }, clone(e.conv)), rot: Object.assign(newRot(), clone(e.rot || {})), curId: e.id, n: e.n, ano: e.ano, sub: { atest: DEST[e.dest].atest[0], czi: DEST[e.dest].czi[0] } });
    persist(); PPx.go('exp');
  }
  function newExp(d) { S = fresh(d || S.dest); S.ano = CFG.ano; persist(); }

  /* ---------- baixar ---------- */
  const blobOf = (bytes, ext) => new Blob([bytes], { type: MIME[ext] });
  async function downloadOne(id) {
    const d = docList().find(x => x.id === id); if (!d) return;
    if (d.need) { S.msg = d.label + ': ' + d.need + '.'; renderExp(); return; }
    PPx.saveBlob(d.name, blobOf(await d.build(), d.ext));
  }
  async function downloadAll() {
    const zip = new JSZip(), L = docList().filter(d => !d.need);
    for (const d of L) zip.file(d.name, await d.build());
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    if (!S.curId) saveEntry(); else saveEntry();
    PPx.saveBlob(`EXPORTACAO_${p3(curN())}.${yr()}_${S.dest}.zip`, blob);
    S.msg = `Baixei ${L.length} arquivos e salvei no histórico (exportação ${numStr()}). A próxima será ${p3(CFG.last + 1)}/${CFG.ano}.`;
    persist(); renderExp();
  }
