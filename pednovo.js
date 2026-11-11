/* Prestige Pedidos — Histórico > "＋ Adicionar pedido": registra um pedido nacional que ficou de fora (feito antes, em outro aparelho...).
   Dá para importar a invoice (.xlsx, ou o .zip que o app baixou). Entra no histórico, no painel e no relatório de vendas. Não mexe no estoque. */
(function () {
  'use strict';
  const PP = window.PP, S = PP.S, F = PP.Features, Core = PP.Core, store = PP.store, esc = PP.esc, fmt = PP.fmt, fmtInt = PP.fmtInt, $ = PP.$;
  const UP = s => String(s || '').trim().toUpperCase();
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const r2 = F.r2, dBR = iso => (iso ? iso.split('-').reverse().join('/') : '');
  const blank = () => ({ sci: '', comum: '', boxes: '', qpb: '', price: '' });
  const PN = { open: false, link: null, editId: null, cli: '', data: '', inv: '', atNum: '', nf: '', gta: '', atest: '', emb: '', sit: 'aguardando', itens: [blank()], msg: '' };
  const rerender = () => { if (PP.extra) PP.extra.render('hist'); };
  function reset() { Object.assign(PN, { link: null, editId: null, cli: '', data: F.todayISO(), inv: '', atNum: '', nf: '', gta: '', atest: '', emb: '', sit: 'aguardando', itens: [blank()], msg: '' }); }

  /* ---------- cálculo igual ao de um pedido normal ---------- */
  function calc() {
    const kg = (S.cfg && S.cfg.valores && S.cfg.valores.kgCaixa) || 8, L = [], B = []; let n = 1, cur = null;
    const its = PN.itens.filter(x => String(x.sci).trim() && (+x.qpb > 0));
    its.forEach(x => {
      const bx = +x.boxes > 0 ? Math.round(+x.boxes) : 0, q = +x.qpb || 0, p = +x.price || 0, peixes = bx > 0 ? bx * q : q;
      if (bx > 0 || !cur) { cur = { ini: n, items: [], rows: [] }; const k = Math.max(bx, 1); cur.fim = n + k - 1; n += k; }
      const l = { sci: String(x.sci).trim().toUpperCase(), comum: String(x.comum || '').trim(), preco: p, peixes, boxes: bx, qtyBox: q, ini: cur.ini, fim: bx > 0 ? cur.fim : cur.ini, g: cur };
      cur.rows.push(l); L.push(l);
    });
    L.forEach(l => { l.mista = l.g.rows.length > 1; });
    const caixas = n - 1, peixes = L.reduce((a, l) => a + l.peixes, 0), valor = r2(L.reduce((a, l) => a + l.peixes * l.preco, 0));
    const gta = r2(+PN.gta || 0), atestado = r2(+PN.atest || 0), emb = r2(+PN.emb || 0);
    return { L, caixas: Math.max(0, caixas), peixes, valor, gta, atestado, emb, total: r2(valor + gta + atestado + emb), kg: Math.max(0, caixas) * kg };
  }
  const catFind = sci => (PP.cat() || []).find(c => UP(c.sci) === UP(sci));
  function buildEntry(prev) {
    const t = calc(), c = (S.clientes || []).find(c => UP(c.nome) === UP(PN.cli)) || {}, id = prev ? prev.id : 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), now = Date.now();
    const lines = t.L.map(l => { const it = catFind(l.sci) || {}, comum = l.comum || it.comum || ''; return { key: [l.sci, comum, it.caixa || l.qtyBox, it.rio || ''].join('|'), sci: l.sci, comum, nome: comum || l.sci, preco: l.preco, peixes: l.peixes, boxes: l.boxes, qtyBox: l.qtyBox, ini: l.ini, fim: l.fim, mista: l.mista }; });
    const boxMap = {}; t.L.forEach(l => { const k = l.g.ini; (boxMap[k] = boxMap[k] || { no: k, items: [] }).items.push({ sci: l.sci, q: l.boxes > 0 && !l.mista ? l.qtyBox : l.peixes }); });
    const boxes = []; t.L.forEach(l => { if (l.boxes > 0) for (let b = l.ini; b <= l.fim; b++) boxes.push({ no: b, items: boxMap[l.g.ini].items.map(i => Object.assign({}, i)) }); });
    const rows = lines.map((l, i) => { const g = t.L[i].g.ini; return { sci: l.sci, comum: l.comum, caixa: (catFind(l.sci) || {}).caixa || l.qtyBox, rio: (catFind(l.sci) || {}).rio || '', qty: l.peixes, raw: l.boxes > 0 && !l.mista ? `${l.boxes} cx ${l.comum || l.sci}` : `${l.peixes} ${l.comum || l.sci}`, use: true, mode: l.mista ? 'mista' : 'inteira', boxes: l.boxes, group: l.mista ? g : 0, perBox: l.qtyBox, preco: l.preco }; });
    const pago = PN.sit === 'pago';
    return {
      id, ts: prev ? prev.ts : now, upd: now, dataISO: PN.data, cliente: { nome: String(PN.cli).trim(), end: c.end || (prev && prev.cliente.end) || '' },
      inv: String(PN.inv || '').trim(), atNum: parseInt(PN.atNum, 10) || 0, nf: String(PN.nf || '').trim(), temAt: t.atestado > 0, dia: '', stamp: 0,
      rows, uso: {}, lines, boxes, nota: { rows: [], ex: { temAt: t.atestado > 0 }, dia: '' },
      totais: { caixas: t.caixas, peixes: t.peixes, valor: t.valor, fish: t.valor, gta: t.gta, atestado: t.atestado, emb: t.emb, total: t.total, kg: t.kg },
      creditoAplicado: 0, pay: pago ? { status: 'pago', pago: t.total, dataPago: PN.data, obs: '' } : (prev && prev.pay && prev.pay.status !== 'pago' ? prev.pay : { status: 'aguardando', pago: 0, dataPago: '', obs: '' }),
      mort: prev ? prev.mort : null, moeda: null, rapido: true,
    };
  }

  /* ---------- tela ---------- */
  function formHTML() {
    if (!PN.open) return '';
    const t = calc();
    const rows = PN.itens.map((x, i) => `<div class="qrow pnrow"><input class="qsp" data-pn="it.${i}.sci" list="pnSp" value="${esc(x.sci)}" placeholder="Espécie (nome científico)" aria-label="Espécie"><label>Caixas<input data-pn="it.${i}.boxes" type="number" min="0" step="1" inputmode="numeric" value="${esc(x.boxes)}" placeholder="—"></label><label>Peixes (por caixa)<input data-pn="it.${i}.qpb" type="number" min="0" step="1" inputmode="numeric" value="${esc(x.qpb)}"></label><label>R$ por peixe<input data-pn="it.${i}.price" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(x.price)}"></label><span class="qtot">R$ ${fmt(((+x.boxes > 0 ? +x.boxes * (+x.qpb || 0) : (+x.qpb || 0))) * (+x.price || 0))}</span><button type="button" class="danger" data-pnb="del" data-i="${i}" aria-label="Remover">✕</button></div>`).join('');
    const sp = (PP.cat() || []).map(c => `<option value="${esc(c.sci)}">${esc(c.comum || '')}</option>`).join('');
    const cl = (S.clientes || []).map(c => `<option value="${esc(c.nome)}"></option>`).join('');
    return `<div class="block" id="pnForm" style="margin:8px 0 12px"><p class="note"><b>${PN.editId ? 'Editando um pedido registrado à mão.' : 'Use quando um pedido ficou de fora do histórico.'}</b> Ele entra no histórico, no painel e no relatório de vendas, mas <b>não mexe no estoque</b> e não gera documentos.</p>
    <div class="row" style="margin-bottom:8px;align-items:center"><button type="button" data-pnb="file">📄 Importar invoice (.xlsx ou o .zip baixado)</button><input id="pnFile" type="file" accept=".xlsx,.zip" style="display:none"><span class="muted">O app lê cliente, data, invoice, espécies, caixas e valores.</span></div>
    <div class="row" style="flex-wrap:wrap;gap:8px">
     <div class="field" style="flex:1 1 240px"><label>Cliente</label><input data-pn="cli" list="pnCl" value="${esc(PN.cli)}"><datalist id="pnCl">${cl}</datalist></div>
     <div class="field" style="flex:0 1 160px"><label>Data</label><input data-pn="data" type="date" value="${esc(PN.data)}"></div>
     <div class="field" style="flex:0 1 100px"><label>Invoice nº</label><input data-pn="inv" type="number" min="0" inputmode="numeric" value="${esc(PN.inv)}"></div>
     <div class="field" style="flex:0 1 100px"><label>Atestado nº</label><input data-pn="atNum" type="number" min="0" inputmode="numeric" value="${esc(PN.atNum)}"></div>
     <div class="field" style="flex:0 1 150px"><label>Nota Fiscal nº</label><input data-pn="nf" value="${esc(PN.nf)}"></div></div>
    <div class="qrows">${rows}</div><datalist id="pnSp">${sp}</datalist>
    <div class="row between" style="margin:6px 0"><button type="button" data-pnb="add">＋ Espécie</button><span class="muted">Para espécies que dividem a mesma caixa, deixe <b>Caixas</b> vazio nas seguintes e informe só a quantidade de peixes.</span></div>
    <div class="row" style="flex-wrap:wrap;gap:8px;align-items:flex-end">
     <div class="field" style="flex:0 1 130px"><label>GTA (R$)</label><input data-pn="gta" type="number" step="0.01" inputmode="decimal" value="${esc(PN.gta)}"></div>
     <div class="field" style="flex:0 1 130px"><label>Atestado (R$)</label><input data-pn="atest" type="number" step="0.01" inputmode="decimal" value="${esc(PN.atest)}"></div>
     <div class="field" style="flex:0 1 130px"><label>Embalagem (R$)</label><input data-pn="emb" type="number" step="0.01" inputmode="decimal" value="${esc(PN.emb)}"></div>
     <div class="field" style="flex:0 1 210px"><label>Situação</label><select data-pn="sit"><option value="aguardando" ${PN.sit === 'aguardando' ? 'selected' : ''}>Aguardando pagamento</option><option value="pago" ${PN.sit === 'pago' ? 'selected' : ''}>Já foi pago</option></select></div></div>
    <p class="muted" id="pnSum" style="margin:8px 0 0">${t.caixas} caixa(s) · ${fmtInt(t.peixes)} peixes · peixes R$ ${fmt(t.valor)} · <b>total R$ ${fmt(t.total)}</b></p>
    ${PN.msg ? `<p class="note" style="color:var(--warn,#e9b44c)">${esc(PN.msg)}</p>` : ''}
    <div class="row" style="margin-top:8px"><button type="button" class="primary" data-pnb="save">${PN.editId ? 'Salvar alterações' : 'Salvar no histórico'}</button><button type="button" data-pnb="close">Cancelar</button></div></div>`;
  }

  /* ---------- importar invoice (.xlsx / .zip) ---------- */
  const tx = v => { if (v == null) return ''; if (v instanceof Date) return ''; if (typeof v === 'object') return tx(v.result != null ? v.result : v.text != null ? v.text : (v.richText ? v.richText.map(r => r.text).join('') : '')); return String(v).trim(); };
  const nm = v => { if (v == null) return NaN; if (typeof v === 'number') return v; if (typeof v === 'object') return nm(v.result != null ? v.result : v.text); const t = String(v).replace(/[^\d.,-]/g, ''); if (!t) return NaN; return /,\d{1,2}$/.test(t) && !/\.\d{3}/.test(t) ? parseFloat(t.replace(/\./g, '').replace(',', '.')) : parseFloat(t.replace(/,/g, '')); };
  const dISO = v => v instanceof Date ? v.getUTCFullYear() + '-' + String(v.getUTCMonth() + 1).padStart(2, '0') + '-' + String(v.getUTCDate()).padStart(2, '0') : '';
  async function parseNac(buf) {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); const out = { itens: [] };
    for (const ws of wb.worksheets) {
      if (ws.state && ws.state !== 'visible') continue;
      const rows = []; ws.eachRow({ includeEmpty: false }, (row, rn) => { const cells = {}; row.eachCell({ includeEmpty: false }, (c, cn) => { cells[cn] = c.value; }); rows.push({ rn, cells }); });
      let H = null;
      for (const r of rows) { const tt = Object.entries(r.cells).map(([c, v]) => [+c, norm(tx(v))]); if (tt.some(x => /boxes|caixas/.test(x[1])) && tt.some(x => /cientifico|scientific|species|especie/.test(x[1]))) { H = { rn: r.rn, col: {} }; tt.forEach(([c, t]) => { if (/boxes|caixas/.test(t) && !H.col.boxes) H.col.boxes = c; else if (/qty|qtd|per box/.test(t) && !H.col.qpb) H.col.qpb = c; else if (/cientifico|scientific|species|especie/.test(t) && !H.col.sci) H.col.sci = c; else if (/comum|common/.test(t) && !H.col.pt) H.col.pt = c; else if (/unit|preco|price/.test(t) && !/total/.test(t) && !H.col.price) H.col.price = c; }); break; } }
      if (!H || !H.col.sci || !H.col.qpb) continue;
      const c = H.col, head = rows.filter(r => r.rn < H.rn);
      head.forEach(r => { const ks = Object.keys(r.cells).map(Number).sort((a, b) => a - b); ks.forEach(k => { const v = r.cells[k], t = norm(tx(v)); if (v instanceof Date && !out.data) out.data = dISO(v); if (/^invoice/.test(t) && !out.inv) { const nx = ks.find(z => z > k); if (nx != null) { const n = nm(r.cells[nx]); if (n >= 0) out.inv = String(Math.round(n)); } } if (/^sold to/.test(t) && !out.cli) { const nx = ks.find(z => z > k); if (nx != null) out.cli = tx(r.cells[nx]); } if (/^gta/.test(t)) { const nr = head.find(z => z.rn === r.rn + 1) || rows.find(z => z.rn === r.rn + 1); if (nr && nr.cells[k] != null) { const g = nm(nr.cells[k]); if (g >= 0) out.gta = g; } } }); });
      for (const r of rows) {
        if (r.rn <= H.rn) continue;
        const sci = tx(r.cells[c.sci]), q = nm(r.cells[c.qpb]); if (!sci || !(q > 0) || /^-+$/.test(sci)) continue;
        const b = c.boxes ? nm(r.cells[c.boxes]) : NaN, p = c.price ? nm(r.cells[c.price]) : NaN;
        out.itens.push({ sci: sci.toUpperCase(), comum: c.pt ? tx(r.cells[c.pt]) : '', boxes: b > 0 ? String(b) : '', qpb: String(q), price: p >= 0 ? String(p) : '' });
      }
      if (out.itens.length) break;
    }
    if (!out.itens.length) throw new Error('não achei a tabela de espécies (colunas "N. boxes" e "NOME CIENTÍFICO") nesta invoice');
    return out;
  }
  async function importFile(file) {
    PN.msg = '';
    try {
      let buf = await file.arrayBuffer(), nome = file.name;
      if (/\.zip$/i.test(file.name)) {
        const z = await JSZip.loadAsync(buf), f = Object.keys(z.files).filter(n => /invoice.*\.xlsx$/i.test(n) && !/reais|uso_interno/i.test(n) && !z.files[n].dir);
        if (!f.length) throw new Error('não achei uma invoice (.xlsx) dentro deste zip');
        buf = await z.files[f[0]].async('arraybuffer'); nome = f[0];
      }
      const r = await parseNac(buf);
      if (r.cli) { const hit = (S.clientes || []).find(c => UP(c.nome) === UP(r.cli) || norm(c.nome) === norm(r.cli)); PN.cli = hit ? hit.nome : r.cli; }
      if (r.data) PN.data = r.data; if (r.inv) PN.inv = r.inv; if (r.gta != null) PN.gta = String(r.gta);
      PN.itens = r.itens; const t = calc();
      PN.msg = `Li a invoice (${nome}): ${r.itens.length} linha(s), ${t.caixas} caixa(s), peixes R$ ${fmt(t.valor)}. Confira os dados abaixo. Atestado e embalagem não vêm na invoice: preencha se quiser que o total bata com a notinha.`;
    } catch (e) { PN.msg = 'Não consegui ler esta invoice: ' + (e.message || e); }
    rerender();
  }

  /* ---------- salvar ---------- */
  function save() {
    if (!String(PN.cli).trim()) { PN.msg = 'Escolha ou digite o cliente.'; return rerender(); }
    if (!PN.data) { PN.msg = 'Escolha a data.'; return rerender(); }
    if (!(parseInt(PN.inv, 10) > 0)) { PN.msg = 'Digite o número da invoice.'; return rerender(); }
    const t = calc(); if (!t.L.length) { PN.msg = 'Coloque pelo menos uma espécie com a quantidade de peixes.'; return rerender(); }
    if (t.L.some(l => !(l.preco >= 0)) || PN.itens.some(x => String(x.sci).trim() && !(+x.qpb > 0))) { PN.msg = 'Confira as espécies: cada uma precisa de nome e quantidade de peixes.'; return rerender(); }
    const prev = PN.editId ? S.hist.find(e => e.id === PN.editId) : null;
    if (S.hist.some(e => e.id !== (prev && prev.id) && String(e.inv) === String(parseInt(PN.inv, 10)) && UP(e.cliente.nome) === UP(PN.cli))) { PN.msg = `Já existe a invoice ${PN.inv} de ${PN.cli} no histórico.`; return rerender(); }
    const e = buildEntry(prev); e.inv = String(parseInt(PN.inv, 10));
    if (prev) S.hist[S.hist.indexOf(prev)] = e; else S.hist.push(e);
    const inv = parseInt(e.inv, 10), at = e.atNum; let mudou = false;
    if (S.cfg && S.cfg.numeracao) { if (inv > (S.cfg.numeracao.ultimaInvoice || 0)) { S.cfg.numeracao.ultimaInvoice = inv; mudou = true; } if (at > (S.cfg.numeracao.ultimoAtestado || 0)) { S.cfg.numeracao.ultimoAtestado = at; mudou = true; } if (mudou) store.set('cfg', S.cfg); }
    if (!(S.clientes || []).some(c => UP(c.nome) === UP(e.cliente.nome))) { S.clientes.push({ nome: e.cliente.nome, end: '' }); if (PP.saveClientes) PP.saveClientes(); }
    if (PN.link) { const em = (S.embarques || []).find(x => x.id === PN.link.eid), ln = em && em.linhas.find(z => z.id === PN.link.lid); if (ln) { ln.pedidoId = e.id; ln.caixas = e.totais.caixas; store.set('embarques', S.embarques); } PN.link = null; }
    PP.saveHist(); if (PP.renderClientes) PP.renderClientes();
    const msgTxt = `Pedido ${e.inv} de ${e.cliente.nome} ${prev ? 'atualizado' : 'salvo'} no histórico (R$ ${fmt(e.totais.total)}).`;
    PN.open = false; PN.editId = null; PN.msg = ''; rerender();
    const h = document.querySelector('#vHist .step'); if (h) { const m = document.createElement('p'); m.className = 'note'; m.textContent = msgTxt; h.insertBefore(m, h.children[1]); }
    if (PP.side) PP.side.render(); if (PP.assist) PP.assist.refresh();
  }
  function edit(id) {
    const e = S.hist.find(x => x.id === id); if (!e) return;
    Object.assign(PN, { open: true, editId: id, cli: e.cliente.nome, data: e.dataISO, inv: e.inv, atNum: e.atNum || '', nf: e.nf || '', gta: String(e.totais.gta || ''), atest: String(e.totais.atestado || ''), emb: String(e.totais.emb || ''), sit: e.pay && e.pay.status === 'pago' ? 'pago' : 'aguardando', msg: '',
      itens: e.lines.map(l => ({ sci: l.sci, comum: l.comum || '', boxes: l.boxes > 0 ? String(l.boxes) : '', qpb: String(l.qtyBox), price: String(l.preco) })) });
    rerender(); const f = $('pnForm'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* abre o formulário já preenchido (vindo da conferência Programação × Histórico) */
  function prefill(o) {
    reset(); PN.open = true; PN.cli = o.cli || ''; PN.data = o.data || F.todayISO(); PN.link = o.link || null;
    const n = (S.cfg && S.cfg.numeracao) || {}; PN.inv = String((n.ultimaInvoice || 0) + 1);
    const e = o.from;
    if (e) { PN.itens = e.lines.map(l => ({ sci: l.sci, comum: l.comum || '', boxes: l.boxes > 0 ? String(l.boxes) : '', qpb: String(l.qtyBox), price: String(l.preco) })); PN.gta = String(e.totais.gta || ''); PN.atest = String(e.totais.atestado || ''); PN.emb = String(e.totais.emb || ''); if (e.totais.atestado) PN.atNum = String((n.ultimoAtestado || 0) + 1); PN.msg = 'Copiado do último pedido deste cliente. Confira espécies, caixas e preços antes de salvar.'; }
    rerender(); const f = $('pnForm'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- eventos ---------- */
  function onInput(ev) {
    const t = ev.target, k = t.dataset && t.dataset.pn; if (!k || !$('pnForm') || !$('pnForm').contains(t)) return;
    const m = k.match(/^it\.(\d+)\.(\w+)$/);
    if (m) { PN.itens[+m[1]][m[2]] = t.value; if (m[2] === 'sci') { const it = catFind(t.value); if (it && !PN.itens[+m[1]].comum) PN.itens[+m[1]].comum = it.comum || ''; } } else PN[k] = t.value;
    if (k === 'cli' && ev.type === 'change') { /* sem ação extra */ }
    const tt = calc(), el = $('pnSum'); if (el) el.innerHTML = `${tt.caixas} caixa(s) · ${fmtInt(tt.peixes)} peixes · peixes R$ ${fmt(tt.valor)} · <b>total R$ ${fmt(tt.total)}</b>`;
    if (m) { const row = t.closest('.pnrow'), it = PN.itens[+m[1]]; if (row) row.querySelector('.qtot').textContent = 'R$ ' + fmt(((+it.boxes > 0 ? +it.boxes * (+it.qpb || 0) : (+it.qpb || 0))) * (+it.price || 0)); }
  }
  document.addEventListener('input', onInput); document.addEventListener('change', onInput);
  document.addEventListener('change', ev => { if (ev.target.id === 'pnFile' && ev.target.files[0]) { const f = ev.target.files[0]; ev.target.value = ''; importFile(f); } });
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-pnb],[data-pn="toggle"]'); if (!b || !$('vHist') || !$('vHist').contains(b)) return;
    if (b.dataset.pn === 'toggle') { PN.open = !PN.open; if (PN.open) reset(); rerender(); return; }
    const a = b.dataset.pnb;
    if (a === 'close') { PN.open = false; PN.editId = null; rerender(); }
    else if (a === 'add') { PN.itens.push(blank()); rerender(); }
    else if (a === 'del') { PN.itens.splice(+b.dataset.i, 1); if (!PN.itens.length) PN.itens.push(blank()); rerender(); }
    else if (a === 'file') { const f = $('pnFile'); if (f) f.click(); }
    else if (a === 'save') save();
  });
  reset();
  PP.pn = { formHTML, isOpen: () => PN.open, edit, prefill, calc, state: PN };
})();
