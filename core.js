/* Prestige Pedidos — lógica pura (sem tela). Funciona no navegador (window.Core) e no Node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_CFG = {
    empresa: {
      nome: 'PRESTIGE AQUARIUM LTDA',
      cnpj: '04.463.469/0001-18',
      ie: '04.159.563-0',
      endereco: 'Rua Santa Barbara, 310, Bairro Flores',
      cep: 'CEP: 69058-815',
      cidade: 'Manaus - Amazonas - Brasil',
      email: '',
      enderecoAtestado: 'Travessa Palestina n.º 300 – Bairro da União',
    },
    vet: { nome: 'Jéssica Soares da Silva', crmv: 'CRMV-AM 0894', celular: '(84) 99125-0044' },
    valores: { gtaBase: 20, gtaMilheiro: 2.5, embalagem: 36, caixaMaior: 80, atestado: 80, kgCaixa: 8 },
    numeracao: { ultimaInvoice: 0, ultimoAtestado: 0 },
    embarque: { dim: '30L: 42x42x23' },
    ordem: [],
    etiquetas: { porPagina: 6 },
    // nome na stocklist = nome que sai nos documentos (invoice, atestado, packing list e etiquetas)
    apelidos: { 'NEON CARDINAL': 'CARDINAL', 'PIABA RABO DE FOGO': 'PIABA' },
    // nome que sai na notinha final
    apelidosNota: { 'LIMPA VIDRO': 'OTOCINCLUS', 'LIMPA FUNDO VERDE': 'BROCHIS', 'PIABA RABO DE FOGO': 'PIABA STICTUS' },
  };

  /* ---------- texto ---------- */
  function norm(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  }
  function ratio(a, b) { // similaridade por distância de edição (tolera erro de digitação)
    if (a === b) return 1;
    const m = a.length, n = b.length;
    if (!m || !n) return 0;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return 1 - prev[n] / Math.max(m, n);
  }
  const STOP = new Set(['peixe', 'peixes', 'de', 'do', 'da', 'x', 'cx', 'caixa', 'caixas', 'unidades', 'und']);
  function score(q, it) {
    const qt = norm(q).filter(t => !STOP.has(t));
    if (!qt.length) return 0;
    let best = 0;
    const cm = /^CORYDORAS\s+(.+)$/i.exec(it.sci);
    for (const f of [it.sci, it.comum, cm ? 'cory ' + cm[1] : '']) {
      const ft = norm(f);
      if (!ft.length) continue;
      let s = 0;
      for (const t of qt) s += Math.max(...ft.map(x => ratio(t, x)));
      best = Math.max(best, s / qt.length);
    }
    return best;
  }
  function parseQty(s) { return parseInt(String(s).replace(/[.\s]/g, '').replace(',', '.'), 10); }

  // fração de caixa: 0,5 · 1/2 · meia · ½ · 1,5 · 2
  function parseFrac(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return v > 0 ? Math.round(v * 10000) / 10000 : 0;
    let s = String(v).trim().toLowerCase();
    if (/^(meia|meio|½)$/.test(s)) return 0.5;
    if (s === '¼') return 0.25;
    let m = s.match(/^(\d+)\s*\/\s*(\d+)$/); if (m) return +m[2] ? Math.round(+m[1] / +m[2] * 10000) / 10000 : 0;
    m = s.match(/^(\d+)\s+e\s+meia$/); if (m) return +m[1] + 0.5;
    s = s.replace(',', '.'); const n = parseFloat(s);
    return /^\d*\.?\d+$/.test(s) && n > 0 ? Math.round(n * 10000) / 10000 : 0;
  }
  // linhas de pedido em caixas: parte inteira vira caixas cheias, a fração vira caixa mista
  function boxRows(it, cands, p, raw, perBox) {
    const out = [], whole = Math.floor(p + 1e-9), frac = Math.round((p - whole) * 10000) / 10000;
    const custom = it && perBox > 0 && perBox !== it.caixa ? perBox : 0;
    const cx = custom || (it ? it.caixa : 0);
    if (whole > 0 || !(frac > 0)) out.push({ qty: whole * cx, raw, cands, sel: it ? it.id : null, use: true, mode: 'inteira', boxes: whole, group: 0, ...(custom ? { perBox: custom } : {}) });
    if (frac > 0) out.push({ qty: Math.round(frac * cx), raw: frac < 1 && whole === 0 ? raw : raw + ' (fração)', cands, sel: it ? it.id : null, use: true, mode: 'mista', boxes: 1, group: 0, frac });
    return out;
  }
  // junta frações na mesma caixa (soma até 1), na ordem do pedido; o usuário pode trocar o número da caixa
  function groupFractions(rows) {
    const bins = []; let next = Math.max(0, ...rows.map(r => r.group)) + 1;
    rows.forEach(r => {
      if (!r.frac || r.group) return;
      let b = bins.find(x => x.sum + r.frac <= 1 + 1e-6);
      if (!b) { b = { g: next++, sum: 0 }; bins.push(b); }
      b.sum += r.frac; r.group = b.g;
    });
  }
  // avisos: caixa de frações que não soma uma caixa
  function groupWarnings(rows) {
    const g = {};
    rows.filter(r => r.use && r.mode === 'mista').forEach(r => { (g[r.group] = g[r.group] || []).push(r); });
    return Object.entries(g).filter(([, rs]) => rs.every(r => r.frac)).map(([k, rs]) => [k, rs.reduce((a, r) => a + r.frac, 0)])
      .filter(([, s]) => Math.abs(s - 1) > 0.01).map(([k, s]) => 'Caixa mista ' + k + ': as frações somam ' + (Math.round(s * 100) / 100).toString().replace('.', ',') + ' de caixa (o normal é 1)');
  }

  // tira do nome o que o cliente escreveu a mais ("com 500 un", "cada caixa 250", "(250)") e guarda como dica de tamanho de caixa
  function cleanName(name) {
    let hint = 0, s = ' ' + name + ' ';
    s = s.replace(/\s(?:com|c\/|de|cada|c|\(|-)?\s*(\d[\d.]*)\s*(?:un|uns|und|unid|unids|unidades?|peixes|p\/\s*cx|por\s+caixa|\))\b\.?\)?/ig, (m0, n) => { hint = parseQty(n) || hint; return ' '; });
    s = s.replace(/\((\d[\d.]*)\)/g, (m0, n) => { hint = parseQty(n) || hint; return ' '; });
    s = s.replace(/\b(?:com|aprox|aproximadamente|mais|pra|para|favor|por favor|obrigad[oa])\b/ig, ' ').replace(/\s+/g, ' ').trim();
    return { name: s || name, hint };
  }
  function pickCands(name, catalog, hint) {
    const ranked = catalog.map(it => ({ it, s: score(name, it) })).sort((a, b) => b.s - a.s);
    const top = ranked.length ? ranked.filter(r => r.s >= ranked[0].s - 0.06 && r.s > 0.72) : [];
    let cands = top.map(r => r.it);
    if (hint) { const h = cands.filter(it => it.caixa === hint); if (h.length) cands = h.concat(cands.filter(it => it.caixa !== hint)); }
    return cands;
  }

  // linhas lidas de um print/foto: tabelas "NOME | N. CXS | QTD P/ CX | TOTAL | valores" viram "N cx NOME com Q un";
  // o resto (endereço, título, totais, taxas) é descartado sem reclamar
  function ocrRows(lines, catalog) {
    const keep = [], dropped = [], suspect = [];
    for (let raw of lines) {
      let line = String(raw).replace(/[|\[\]{}_~—–=<>]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (line.length < 3) continue;
      // dinheiro fora: R$ 0,60 · RS 160000 · 1.234,56
      let t = line.replace(/\b(?:R\$|RS|R5|Rs)\s*[\d.,]+/g, ' ').replace(/\b\d[\d.]*,\d{2}\b/g, ' ').replace(/\s+/g, ' ').trim();
      const m = t.match(/^([^\d]*?[A-Za-zÀ-ú][^\d]*?)\s+(\d[\d.]*)\s+(\d[\d.]*)(?:\s+(\d[\d.]*))?(?:\s|$)/);
      let out = null;
      if (m) {
        const name = m[1].replace(/[^A-Za-zÀ-ú ]/g, ' ').replace(/\s+/g, ' ').trim();
        const a = parseQty(m[2]), b = parseQty(m[3]), tot = m[4] ? parseQty(m[4]) : 0;
        let n = a, q = b;
        if (tot && a !== tot && b !== tot && a * b !== tot) { // total não bate: confia no par que fecha com o total
          if (tot % a === 0) { n = a; q = tot / a; } else if (tot % b === 0) { n = b; q = tot / b; }
        }
        if (name.length >= 3 && n > 0 && n <= 60 && q >= 5) out = `${n} cx ${name} com ${q} un`;
      }
      if (!out) {
        const only = line.replace(/\s+/g, ' ');
        const one = parseText(only, catalog);
        if (one.rows.length && one.rows.some(r => r.sel !== null)) out = only;
      }
      if (out) keep.push(out);
      else {
        dropped.push(line);
        if (/(?:(?:R\$|RS|R5)\s*[\d.,]+|\d[.,]\d{2}\b)/.test(line) && /[A-Za-zÀ-ú]{3}/.test(line) && !/valor|total|embalagem|gta|atestado|taxa|despach|subtotal|frete|desconto/i.test(line)) suspect.push(line);
      }
    }
    return { text: keep.join('\n'), keep, dropped, suspect };
  }

  /* ---------- leitura do pedido em texto ---------- */
  function parseText(text, catalog) {
    const out = [], ignored = [];
    for (const raw of String(text).split(/\n/)) {
      const line = raw.trim().replace(/^[-•*·●▪]+\s*/, '');
      if (!line) continue;
      let qty, name, group = null;
      const bx = line.match(/^(meia|meio|½|\d+\s*\/\s*\d+|\d+\s+e\s+meia|\d+(?:[.,]\d+)?)\s*(?:caixas?|cxs?)\.?\s+(?:de\s+|do\s+|da\s+)?(.+?)$/i);
      if (bx && parseFrac(bx[1]) > 0) {
        let nm = bx[2], gg = 0; const g0 = nm.match(/\s*@(\d+)\s*$/); if (g0) { gg = +g0[1]; nm = nm.replace(/\s*@\d+\s*$/, ''); }
        const cn = cleanName(nm), cd = pickCands(cn.name, catalog, cn.hint);
        const it0 = (cn.hint && cd.find(it => it.caixa === cn.hint && it.estoque !== null)) || cd.find(it => it.estoque !== null) || cd[0] || null;
        boxRows(it0, cd, parseFrac(bx[1]), line, cn.hint).forEach(r => { if (gg && r.mode === 'mista') r.group = gg; r.use = !!it0 && status(r, catalog).kind !== 'bad'; out.push(r); });
        continue;
      }
      let m = line.match(/^([\d][\d.,]*)\s*(?:x|un\.?|und\.?|unidades)?\s+(.+?)$/i);
      if (m) { qty = parseQty(m[1]); name = m[2]; }
      else {
        m = line.match(/^(.+?)\s*[-–:=]?\s+([\d][\d.,]*)\s*(?:x|un\.?|und\.?|unidades)?$/i);
        if (m) { qty = parseQty(m[2]); name = m[1]; }
      }
      if (!m || !qty || qty <= 0) { ignored.push(line); continue; }
      const g = name.match(/\s*@(\d+)\s*$/);
      if (g) { group = +g[1]; name = name.replace(/\s*@\d+\s*$/, ''); }
      const cn = cleanName(name), cands = pickCands(cn.name, catalog, cn.hint);
      const fits = it => it.estoque !== null && qty % it.caixa === 0;
      const sel = (group ? cands.find(it => it.estoque !== null) : null) || cands.find(fits) || cands.find(it => it.estoque !== null) || cands[0] || null;
      const mista = group !== null || (sel && qty < sel.caixa);
      const row = { qty, raw: line, cands, sel: sel ? sel.id : null, use: true, mode: mista ? 'mista' : 'inteira', boxes: sel ? Math.ceil(qty / sel.caixa) : 0, group: group || 0 };
      row.use = !!sel && status(row, catalog).kind !== 'bad';
      out.push(row);
    }
    groupFractions(out); assignGroups(out);
    return { rows: out, ignored };
  }
  // ordem padrão das espécies (nome científico): as listadas vêm primeiro, na ordem guardada
  function applyOrder(rows, ordem, catalog) {
    if (!ordem || !ordem.length) return rows;
    const idx = r => { const it = catalog.find(c => c.id === r.sel); const k = it ? ordem.indexOf(it.sci) : -1; return k < 0 ? 1e6 : k; };
    return rows.map((r, i) => ({ r, i, k: idx(r) })).sort((a, b) => a.k - b.k || a.i - b.i).map(x => x.r);
  }
  function assignGroups(rows) {
    let next = Math.max(0, ...rows.map(r => r.group)) + 1;
    rows.forEach(r => { if (r.mode === 'mista' && !r.group) r.group = next++; });
  }

  /* ---------- pedido vindo da stocklist devolvida (em caixas) ---------- */
  function rowsFromStocklistOrder(orderItems, catalog) {
    const out = [];
    for (const o of orderItems) {
      const key = x => norm(x.sci).join(' ') + '|' + x.caixa + '|' + norm(x.comum).join(' ');
      const same = catalog.filter(c => key(c) === key(o));
      const sameRio = same.filter(c => norm(c.rio).join(' ') === norm(o.rio).join(' '));
      let it = sameRio.find(c => c.estoque !== null) || sameRio[0] || same.find(c => c.estoque !== null) || same[0] ||
        catalog.find(c => norm(c.sci).join(' ') === norm(o.sci).join(' ') && c.caixa === o.caixa);
      const cands = it ? [it] : [];
      boxRows(it, cands, o.pedido, `${o.pedido.toString().replace('.', ',')} cx · ${o.sci} (${o.comum})`).forEach(r => { r.use = !!it && status(r, catalog).kind !== 'bad'; out.push(r); });
    }
    groupFractions(out); assignGroups(out);
    return { rows: out, ignored: [] };
  }

  /* ---------- leitura da planilha stocklist (ExcelJS) ---------- */
  function cellVal(c) {
    let v = c ? c.value : null;
    if (v && typeof v === 'object') {
      if ('result' in v) v = v.result;
      else if (v.richText) v = v.richText.map(t => t.text).join('');
      else if (v.text) v = v.text;
    }
    return v === undefined ? null : v;
  }
  function parseStocklistWorksheet(ws) {
    // acha a linha de cabeçalho e as colunas pelos nomes
    let hdr = null; const cols = {};
    ws.eachRow({ includeEmpty: false }, (row, rn) => {
      if (hdr) return;
      row.eachCell({ includeEmpty: false }, (cell, cn) => {
        const t = norm(cellVal(cell) || '').join(' ');
        if (t === 'nome cientifico') { hdr = rn; if (!cols.sci) cols.sci = cn; }
      });
      if (hdr) row.eachCell({ includeEmpty: false }, (cell, cn) => {
        const t = norm(cellVal(cell) || '').join(' ');
        const put = k => { if (!cols[k]) cols[k] = cn; }; // células mescladas repetem o título: vale a primeira coluna
        if (t === 'rio') put('rio');
        else if (t === 'nome comum') put('comum');
        else if (t.startsWith('qtd p caixa')) put('caixa');
        else if (t === 'preco') put('preco');
        else if (t === 'estoque') put('estoque');
        else if (t.startsWith('seu pedido')) put('pedido');
      });
    });
    if (!hdr || !cols.comum || !cols.caixa || !cols.preco) return { items: [], error: 'Não encontrei as colunas NOME CIENTÍFICO, NOME COMUM, QTD P/ CAIXA e PREÇO.' };
    const items = [];
    for (let r = hdr + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const sci = cellVal(row.getCell(cols.sci)), comum = cellVal(row.getCell(cols.comum));
      const caixa = Number(cellVal(row.getCell(cols.caixa))), preco = Number(cellVal(row.getCell(cols.preco)));
      if (!sci || !comum || !(caixa > 0) || isNaN(preco)) continue;
      const est = cols.estoque ? cellVal(row.getCell(cols.estoque)) : null;
      const ped = cols.pedido ? parseFrac(cellVal(row.getCell(cols.pedido))) : 0;
      items.push({ id: r, row: r, sci: String(sci).trim().toUpperCase(), comum: String(comum).trim(), rio: cols.rio ? (cellVal(row.getCell(cols.rio)) || '') : '',
        caixa, preco, estoque: typeof est === 'number' ? est : null, pedido: ped > 0 ? ped : 0 });
    }
    return { items, cols, sheetRows: ws.rowCount };
  }

  /* ---------- situação de cada linha ---------- */
  const byId = (catalog, id) => catalog.find(c => c.id === id);
  const itemKey = it => [it.sci, it.comum, it.caixa, it.rio || ''].join('|');
  function status(r, catalog) {
    const it = byId(catalog, r.sel);
    if (!it) return { kind: 'bad', txt: 'Sem correspondência' };
    if (it.estoque === null) return { kind: 'bad', txt: 'SEM ESTOQUE' };
    if (r.mode === 'inteira' && r.boxes > it.estoque) return { kind: 'bad', txt: 'Pede ' + r.boxes + ' cx, há ' + it.estoque };
    if (r.mode === 'mista' && r.qty > it.estoque * it.caixa) return { kind: 'bad', txt: 'Pede ' + r.qty.toLocaleString('pt-BR') + ', há ' + (it.estoque * it.caixa).toLocaleString('pt-BR') };
    if (r.mode === 'inteira' && r.perBox > 0 && r.perBox !== it.caixa) return { kind: 'ok', txt: 'OK · ' + r.perBox.toLocaleString('pt-BR') + '/cx (stocklist ' + it.caixa.toLocaleString('pt-BR') + ')' };
    if (r.mode === 'inteira' && r.qty % it.caixa !== 0) return { kind: 'warn', txt: 'Não fecha caixa (' + r.qty.toLocaleString('pt-BR') + ' ÷ ' + it.caixa + ')' };
    if (r.cands.length > 1) return { kind: 'warn', txt: 'Confirmar variação' };
    return { kind: 'ok', txt: r.mode === 'mista' ? 'OK · caixa mista' : 'OK' };
  }
  const perBoxOf = (r, it) => (r.perBox > 0 ? r.perBox : it.caixa); // peixes por caixa: o da stocklist ou o que ele digitou
  const fishOf = (r, catalog) => { const it = byId(catalog, r.sel); return !it ? 0 : (r.mode === 'mista' ? r.qty : r.boxes * perBoxOf(r, it)); };

  /* ---------- plano: numeração das caixas na ordem do pedido ---------- */
  function plan(rows, catalog) {
    let n = 1; const alloc = {}; const L = []; const boxes = [];
    rows.filter(r => r.use && byId(catalog, r.sel) && (r.mode === 'mista' ? r.qty > 0 : r.boxes > 0)).forEach(r => {
      const it0 = byId(catalog, r.sel), it = r.preco > 0 ? Object.assign({}, it0, { preco: r.preco }) : it0, p = fishOf(r, catalog), v = p * it.preco; // r.preco = preço combinado só para este pedido
      if (r.mode === 'inteira') {
        const l = { it, peixes: p, valor: v, ini: n, fim: n + r.boxes - 1, boxesCol: r.boxes, qtyBox: perBoxOf(r, it), first: true, mista: false };
        for (let b = n; b <= l.fim; b++) boxes.push({ no: b, items: [{ it, q: perBoxOf(r, it) }] });
        n += r.boxes; L.push(l);
      } else {
        const first = !(r.group in alloc);
        if (first) { alloc[r.group] = n; boxes.push({ no: n, items: [] }); n++; }
        const no = alloc[r.group];
        boxes.find(b => b.no === no).items.push({ it, q: r.qty });
        L.push({ it, peixes: p, valor: v, ini: no, fim: no, boxesCol: first ? 1 : null, qtyBox: r.qty, first, mista: true });
      }
    });
    const total = n - 1; boxes.forEach(b => { b.total = total; });
    return { L, boxes, total, peixes: L.reduce((a, l) => a + l.peixes, 0), valor: L.reduce((a, l) => a + l.valor, 0), mixed: L.some(l => l.mista) };
  }

  const gta = (peixes, v) => (peixes > 0 ? v.gtaBase + v.gtaMilheiro * Math.ceil(peixes / 1000) : 0);

  /* ---------- notinha final (linhas editáveis) ---------- */
  const up = s => String(s).trim().toUpperCase();
  // nome do peixe nos documentos (CARDINAL em vez de NEON CARDINAL etc.)
  function docName(it, cfg) {
    const ap = (cfg && cfg.apelidos) || DEFAULT_CFG.apelidos;
    return ap[up(it.comum)] || up(it.comum);
  }
  function shortName(it, cfg) {
    const ap = (cfg && cfg.apelidosNota) || DEFAULT_CFG.apelidosNota;
    if (ap[up(it.comum)]) return ap[up(it.comum)];
    const w = it.sci.split(' ');
    if (w[0] === 'CORYDORAS' && w[1]) return ('CORY ' + (w[1] === 'SUPER' ? 'SUPER ' + (w[2] || '') : w[1])).trim();
    return up(it.comum);
  }
  function notinhaRows(P, cfg) {
    return P.L.map(l => ({ nome: shortName(l.it, cfg), cxs: l.boxesCol, qtd: l.qtyBox, unit: l.it.preco }));
  }
  // "NOME = OUTRO NOME" por linha <-> objeto
  function parseApelidos(text) {
    const o = {};
    String(text).split(/\n/).forEach(l => { const m = l.split('='); if (m.length >= 2 && up(m[0]) && up(m.slice(1).join('='))) o[up(m[0])] = up(m.slice(1).join('=')); });
    return o;
  }
  const apelidosToText = o => Object.entries(o || {}).map(([k, v]) => `${k} = ${v}`).join('\n');
  const notinhaLineTotal = r => (r.cxs ? r.cxs * r.qtd : r.qtd) * r.unit;
  const notinhaFish = r => (r.aplicado ? 0 : (r.cxs ? r.cxs * r.qtd : r.qtd)); // linha de crédito aplicado não conta como peixe (não mexe na GTA)
  function notinhaTotals(rows, ex, v) {
    const peixes = rows.reduce((a, r) => a + notinhaFish(r), 0);
    const fish = rows.reduce((a, r) => a + notinhaLineTotal(r), 0);
    const caixas = rows.reduce((a, r) => a + (r.cxs || 0), 0);
    const gtaV = ex.gtaAuto ? gta(peixes, v) : ex.gta;
    const at = ex.temAt ? ex.atestado : 0;
    const emb = caixas * ex.embalagem, emb2 = ex.qCaixaMaior * ex.caixaMaior;
    return { peixes, fish, caixas, gta: gtaV, atestado: at, emb, emb2, total: fish + gtaV + at + emb + emb2 };
  }

  // ORÇAMENTO: mesmos itens da notinha + desconto (% sobre o valor dos peixes). Sem frete nem taxa do despachante; atestado só p/ VCP e CNF (Azul)
  function orcTotals(rows, ex, v, orc) {
    const T = notinhaTotals(rows, ex, v), pct = Math.max(0, Math.min(100, +(orc && orc.pct) || 0));
    const desconto = Math.round(T.fish * pct) / 100;
    const aposDesc = T.fish - desconto;
    return { ...T, pct, desconto, aposDesc, total: aposDesc + T.gta + T.atestado + T.emb + T.emb2 };
  }

  return { DEFAULT_CFG, orcTotals, norm, ratio, score, parseQty, parseText, assignGroups, rowsFromStocklistOrder, parseStocklistWorksheet, cellVal,
    status, fishOf, perBoxOf, plan, ocrRows, applyOrder, cleanName, parseFrac, groupFractions, groupWarnings, gta, docName, shortName, parseApelidos, apelidosToText, notinhaRows, notinhaFish, notinhaLineTotal, notinhaTotals, byId, itemKey };
});
