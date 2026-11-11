/* Prestige Pedidos — documentos de EXPORTAÇÃO.
   Preenche os modelos originais (xlsx/docx) por edição direta do XML, sem recriar do zero.
   UMD: window.ExportDocs  /  require('./exportdocs.js') */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ExportDocs = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- utilidades ---------- */
  const xe = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const xu = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const b64ToBytes = b64 => {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
    const bin = atob(b64), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
  const pad2 = n => String(n).padStart(2, '0');
  const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  const parseISO = iso => { const [y, m, d] = String(iso).split('-').map(Number); return { y, m, d }; };
  const dataBR = iso => { if (!iso) return '__/__/____'; const p = parseISO(iso); return `${pad2(p.d)}/${pad2(p.m)}/${p.y}`; };
  const dataLonga = iso => { if (!iso) return '__ DE ________ DE ____'; const p = parseISO(iso); return `${pad2(p.d)} DE ${MESES[p.m - 1]} DE ${p.y}`; };
  const serial = iso => { const p = parseISO(iso); return Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(1899, 11, 30)) / 86400000); };
  // 15000 -> "15.000" (PT)   /  "15,000" (US)
  const grp = (n, sep) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const nPT = n => grp(n, '.');
  const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

  /* ---------- totais do pedido ---------- */
  function totals(o) {
    const fee = o.ex && o.ex.fee != null && o.ex.fee !== '' ? Number(o.ex.fee) : 12;
    let boxes = 0, fish = 0, kg = 0, goods = 0;
    const lines = (o.items || []).map(it => {
      const b = Number(it.boxes) || 0, q = Number(it.qpb) || 0, p = Number(it.price) || 0;
      const kgBox = it.kg === undefined || it.kg === '' || it.kg === null ? 8 : Number(it.kg);
      const tf = b * q, tot = tf * p, w = b * kgBox;
      boxes += b; fish += tf; kg += w; goods += tot;
      return Object.assign({}, it, { boxes: b, qpb: q, price: p, kgBox, totalFish: tf, total: tot, weight: w });
    });
    const adj = (o.extras || []).reduce((a, e) => a + (Number(e && e.value) || 0), 0);
    return { lines, boxes, fish, kg, goods, fee, feeTotal: boxes * fee, grand: goods + boxes * fee, adj, net: goods + boxes * fee + adj };
  }


  /* ---------- invoice ADUANA: preços recalculados ----------
     A soma (peixes + package fee) da aduana tem de ser igual ao líquido da original (peixes + fee − discount − DOA).
     Reduz os preços na mesma proporção, em centavos (2 casas), e acerta a sobra de 1 em 1 centavo espalhando entre as linhas.
     lines: [{boxes,qpb,price}]  ·  fixed: {índice: preço} (linhas que você digitou à mão; ficam como estão)  ·  alvo: valor dos peixes */
  function aduanaPrices(lines, alvo, fixed) {
    fixed = fixed || {};
    const q = lines.map(l => (Number(l.boxes) || 0) * (Number(l.qpb) || 0));
    const p = lines.map((l, i) => (fixed[i] != null && fixed[i] !== '' ? Number(fixed[i]) : null));
    const cents = v => Math.round(v * 100);
    const T = cents(alvo);
    let fixedSum = 0, goodsFree = 0;
    lines.forEach((l, i) => { if (p[i] != null) fixedSum += cents(p[i]) * q[i]; else goodsFree += (Number(l.price) || 0) * q[i]; });
    const free = lines.map((l, i) => i).filter(i => p[i] == null && q[i] > 0);
    const rest = T - fixedSum;                      // em centavos·peixe
    const k = goodsFree > 0 ? (rest / 100) / goodsFree : 1;
    const c = {};
    free.forEach(i => { c[i] = Math.max(1, cents((Number(lines[i].price) || 0) * k)); });
    const adj = {}; free.forEach(i => { adj[i] = 0; });
    const total = () => free.reduce((a, i) => a + c[i] * q[i], 0);
    let r = rest - total(), guard = 0;
    while (r !== 0 && free.length && guard++ < 20000) {
      const s = r > 0 ? 1 : -1;
      const cand = free.filter(i => c[i] + s >= 1 && Math.abs(r - s * q[i]) < Math.abs(r));
      if (!cand.length) break;
      cand.sort((a, b) => (Math.abs(adj[a]) - Math.abs(adj[b])) || (q[b] - q[a]));
      const i = cand[0]; c[i] += s; adj[i] += s; r -= s * q[i];
    }
    if (r !== 0 && free.length > 1) {           // sobra que 1 centavo só não resolve: procura combinações pequenas de 2 e 3 linhas
      let best = null;
      const ok = (i, a) => c[i] + a >= 1;
      for (let m = 1; m <= 6 && !best; m++) {   // m = maior ajuste permitido por linha (em centavos)
        for (let x = 0; x < free.length && !best; x++) for (let y = x + 1; y < free.length && !best; y++) {
          const i = free[x], j = free[y];
          for (let a = -m; a <= m; a++) for (let b2 = -m; b2 <= m; b2++) if (a && b2 && a * q[i] + b2 * q[j] === r && ok(i, a) && ok(j, b2)) { const cost = Math.abs(a) + Math.abs(b2); if (!best || cost < best.cost) best = { cost, mv: [[i, a], [j, b2]] }; }
        }
        for (let x = 0; x < free.length && !best; x++) for (let y = x + 1; y < free.length && !best; y++) for (let z = y + 1; z < free.length && !best; z++) {
          const i = free[x], j = free[y], k2 = free[z];
          for (let a = -m; a <= m; a++) for (let b2 = -m; b2 <= m; b2++) for (let c2 = -m; c2 <= m; c2++) if (a && b2 && c2 && a * q[i] + b2 * q[j] + c2 * q[k2] === r && ok(i, a) && ok(j, b2) && ok(k2, c2)) { const cost = Math.abs(a) + Math.abs(b2) + Math.abs(c2); if (!best || cost < best.cost) best = { cost, mv: [[i, a], [j, b2], [k2, c2]] }; }
        }
      }
      if (best) best.mv.forEach(([i, a]) => { c[i] += a; });
    }
    const prices = lines.map((l, i) => (p[i] != null ? p[i] : (c[i] != null ? c[i] / 100 : Number(l.price) || 0)));
    const sum = prices.reduce((a, v, i) => a + Math.round(v * 100) * q[i], 0);
    return { prices, sum: sum / 100, diff: Math.round((T - sum)) / 100 };
  }

  /* ============================================================
     XLSX  (invoice US$ e invoice convertida em R$)
     ============================================================ */
  const stOf = (xml, ref) => { const m = new RegExp(`<c r="${ref}"[^>]*?\\ss="(\\d+)"`).exec(xml); return m ? m[1] : '0'; };
  const istr = (ref, st, t) => `<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${xe(t)}</t></is></c>`;
  const num = (ref, st, v) => `<c r="${ref}" s="${st}" t="n"><v>${v}</v></c>`;
  const fml = (ref, st, f, v) => `<c r="${ref}" s="${st}" t="n"><f aca="false">${f}</f><v>${v}</v></c>`;
  const emp = (ref, st) => `<c r="${ref}" s="${st}"/>`;
  const setCell = (xml, ref, cell) => {
    const re = new RegExp(`<c r="${ref}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
    if (!re.test(xml)) throw new Error('Modelo inesperado (célula ' + ref + ')');
    return xml.replace(re, () => cell);
  };
  const renumber = (rowXml, from, to) =>
    rowXml.replace(new RegExp(`(<row (?:[^>]*?\\s)?r=")${from}(")`), `$1${to}$2`).replace(new RegExp(`(<c r="[A-Z]+)${from}(")`, 'g'), `$1${to}$2`);
  const shiftRef = (ref, d, minRow) => ref.replace(/([A-Z]+)(\d+)/g, (m, c, r) => (Number(r) >= minRow ? c + (Number(r) + d) : m));

  /* layouts das duas invoices (colunas = primeira coluna de cada par mesclado) */
  const LAYOUT = {
    usd: {
      sheet: 'xl/worksheets/sheet2.xml', first: 16, proto: 17, padProto: 26, tplRows: 12, minRows: 12, tail: 28,
      hdr: { inv: 'E9', date: 'O9', name: 'E10', a1: 'E11', a2: 'E12' },
      merges: [['B', 'C'], ['D', 'F'], ['G', 'H'], ['J', 'K'], ['L', 'M'], ['N', 'O'], ['P', 'Q'], ['R', 'S']],
      printArea: /Invoice!\$B\$2:\$S\$33/, printTo: r => `Invoice!$B$2:$S$${33 + r}`
    },
    brl: {
      sheet: 'xl/worksheets/sheet2.xml', first: 19, proto: 20, padProto: 33, tplRows: 17, minRows: 15, tail: 36,
      hdr: { inv: 'E12', date: 'O12', name: 'E13', a1: 'E14', a2: 'E15' },
      merges: [['B', 'C'], ['D', 'F'], ['G', 'H'], ['J', 'K'], ['L', 'M'], ['N', 'O'], ['P', 'Q'], ['R', 'S'], ['T', 'U'], ['V', 'W']],
      printArea: /Invoice!\$B\$11:\$AA\$43/, printTo: r => `Invoice!$B$11:$AA$${43 + r}`
    }
  };

  async function buildInvoice(kind, JSZip, tplB64, o) {
    const L = LAYOUT[kind], T = totals(o);
    const zip = await JSZip.loadAsync(b64ToBytes(tplB64));
    let sheet = await zip.file(L.sheet).async('string');
    const sdStart = sheet.indexOf('<sheetData>') + 11, sdEnd = sheet.indexOf('</sheetData>');
    const pre = sheet.slice(0, sdStart), body = sheet.slice(sdStart, sdEnd), post = sheet.slice(sdEnd);
    const rows = {};
    body.replace(/<row (?:[^>]*?\s)?r="(\d+)"[\s\S]*?<\/row>/g, (m, n) => { rows[n] = m; return m; });
    const region = Math.max(T.lines.length + (kind === 'brl' ? 3 : 1), L.minRows);
    const d = region - L.tplRows;
    const last = L.tail - 1 + d;            // última linha da região de dados
    const f = L.first;
    // linhas extras entre PACKAGE FEE e o total geral (DISCOUNT, DOA, PRE-PAID FREIGHT) — só na invoice em US$
    const ext = kind === 'usd' ? (o.extras || []).filter(e => e && Number(e.value)) : [];
    const fxb = kind === 'brl' ? (o.extras || []).filter(e => e && Number(e.value)).slice(0, 2) : [];   // invoice em R$: até 2 linhas nas linhas em branco do rodapé
    const fxSum = fxb.reduce((a, e) => a + Number(e.value), 0);
    const nx = ext.length, between = nx <= 1 ? 2 : nx + 2, ex = between - 2;

    // 1) cabeçalho
    let head = Object.keys(rows).filter(n => +n < f).map(n => rows[n]).join('');
    const H = L.hdr;
    head = setCell(head, H.inv, istr(H.inv, stOf(head, H.inv), `${o.invNum}/${o.ano}`));
    head = setCell(head, H.date, o.dateISO ? num(H.date, stOf(head, H.date), serial(o.dateISO)) : istr(H.date, stOf(head, H.date), '__/__/____'));
    const c = o.cons;
    head = setCell(head, H.name, istr(H.name, stOf(head, H.name), c.name));
    head = setCell(head, H.a1, istr(H.a1, stOf(head, H.a1), c.addr1));
    head = setCell(head, H.a2, istr(H.a2, stOf(head, H.a2), c.addr2));
    if (kind === 'brl') {
      head = setCell(head, 'G17', istr('G17', stOf(head, 'G17'), 'Species - Scientific Name'));
      head = setCell(head, 'J17', istr('J17', stOf(head, 'J17'), 'Common Name'));
      head = setCell(head, 'AA18', num('AA18', stOf(head, 'AA18'), Number(o.rate)));
    }

    // 2) linhas de dados
    const rate = Number(o.rate) || 0;
    let data = '';
    T.lines.forEach((l, i) => {
      const r = f + i;
      let x = renumber(rows[L.proto], L.proto, r);
      const S = col => stOf(x, col + r);
      const put = (col, cell) => { x = setCell(x, col + r, cell); };
      put('B', num('B' + r, S('B'), l.boxes)); put('D', num('D' + r, S('D'), l.qpb));
      put('G', istr('G' + r, S('G'), String(l.sci).toUpperCase())); put('J', istr('J' + r, S('J'), String(l.pt || '').toUpperCase()));
      put('L', fml('L' + r, S('L'), `SUM(B${r}*D${r})`, l.totalFish));
      put('N', num('N' + r, S('N'), l.price));
      if (kind === 'usd') {
        put('P', fml('P' + r, S('P'), `SUM(L${r}*N${r})`, l.total));
        put('R', num('R' + r, S('R'), l.weight));
      } else {
        put('P', fml('P' + r, S('P'), `N${r}*$AA$18`, l.price * rate));
        put('R', fml('R' + r, S('R'), `SUM(L${r}*N${r})`, l.total));
        put('T', fml('T' + r, S('T'), `R${r}*$AA$18`, l.total * rate));
        put('V', num('V' + r, S('V'), l.weight));
      }
      data += x;
    });
    for (let r = f + T.lines.length; r <= last; r++) data += renumber(rows[L.padProto], L.padProto, r);

    // 3) rodapé (linhas >= tail, deslocadas)
    const shifted = {};
    Object.keys(rows).filter(n => +n >= L.tail).forEach(n => {
      const k = +n - L.tail;                  // 0 total · 1 fee · 2,3 linhas em branco · 4.. total geral e abaixo
      if (kind === 'usd' && (k === 2 || k === 3)) return;
      shifted[+n + d + (kind === 'usd' && k >= 4 ? ex : 0)] = renumber(rows[n], n, +n + d + (kind === 'usd' && k >= 4 ? ex : 0));
    });
    const tl = L.tail + d;                    // total (goods)
    const fr = tl + 1;                        // package fee
    if (kind === 'usd') {
      for (let i = 0; i < between; i++) {
        const r = tl + 2 + i;
        let x = renumber(rows[L.tail + 2], L.tail + 2, r);
        const e = i >= 1 && i <= nx ? ext[i - 1] : null;
        if (e) { x = setCell(x, 'G' + r, istr('G' + r, stOf(x, 'G' + r), e.label)); x = setCell(x, 'P' + r, num('P' + r, stOf(x, 'P' + r), Number(e.value))); }
        shifted[r] = x;
      }
    }
    fxb.forEach((e, i) => {
      const r = tl + 2 + i; let x = shifted[r]; if (!x) return;
      x = setCell(x, 'G' + r, istr('G' + r, stOf(x, 'G' + r), e.label));
      x = setCell(x, 'R' + r, num('R' + r, stOf(x, 'R' + r), Number(e.value)));
      x = setCell(x, 'T' + r, fml('T' + r, stOf(x, 'T' + r), `R${r}*$AA$18`, Number(e.value) * rate));
      shifted[r] = x;
    });
    const gr = tl + 4 + (kind === 'usd' ? ex : 0); // total geral
    const sub = (row, fn) => { shifted[row] = fn(shifted[row]); };
    if (kind === 'usd') {
      sub(tl, x => setCell(x, 'P' + tl, fml('P' + tl, stOf(x, 'P' + tl), `SUM(P${f}:Q${last})`, T.goods)));
      sub(fr, x => { x = setCell(x, 'L' + fr, fml('L' + fr, stOf(x, 'L' + fr), `SUM(B${f}:C${last})`, T.boxes)); x = setCell(x, 'N' + fr, num('N' + fr, stOf(x, 'N' + fr), T.fee)); return setCell(x, 'P' + fr, fml('P' + fr, stOf(x, 'P' + fr), `SUM(L${fr}*N${fr})`, T.feeTotal)); });
      sub(gr, x => {
        x = setCell(x, 'B' + gr, fml('B' + gr, stOf(x, 'B' + gr), `SUM(B${f}:C${gr - 1})`, T.boxes));
        x = setCell(x, 'L' + gr, fml('L' + gr, stOf(x, 'L' + gr), `SUM(L${f}:M${last})`, T.fish));
        x = setCell(x, 'P' + gr, fml('P' + gr, stOf(x, 'P' + gr), `SUM(P${tl}:Q${gr - 1})`, T.net));
        return setCell(x, 'R' + gr, fml('R' + gr, stOf(x, 'R' + gr), `SUM(R${f}:S${gr - 1})`, T.kg));
      });
    } else {
      sub(tl, x => {
        x = setCell(x, 'R' + tl, fml('R' + tl, stOf(x, 'R' + tl), `SUM(R${f}:S${last})`, T.goods));
        return setCell(x, 'T' + tl, fml('T' + tl, stOf(x, 'T' + tl), `SUM(T${f}:U${last})`, T.goods * rate));
      });
      sub(fr, x => {
        x = setCell(x, 'L' + fr, num('L' + fr, stOf(x, 'L' + fr), T.boxes)); x = setCell(x, 'N' + fr, num('N' + fr, stOf(x, 'N' + fr), T.fee));
        x = setCell(x, 'R' + fr, fml('R' + fr, stOf(x, 'R' + fr), `SUM(L${fr}*N${fr})`, T.feeTotal));
        return setCell(x, 'T' + fr, fml('T' + fr, stOf(x, 'T' + fr), `R${fr}*$AA$18`, T.feeTotal * rate));
      });
      sub(gr, x => {
        x = setCell(x, 'B' + gr, fml('B' + gr, stOf(x, 'B' + gr), `SUM(B${f}:C${gr - 1})`, T.boxes));
        x = setCell(x, 'L' + gr, fml('L' + gr, stOf(x, 'L' + gr), `SUM(L${f}:M${last})`, T.fish));
        x = setCell(x, 'R' + gr, fml('R' + gr, stOf(x, 'R' + gr), `SUM(R${tl}:S${gr - 1})`, T.grand + fxSum));
        x = setCell(x, 'T' + gr, fml('T' + gr, stOf(x, 'T' + gr), `SUM(T${tl}:U${gr - 1})`, (T.grand + fxSum) * rate));
        return setCell(x, 'V' + gr, fml('V' + gr, stOf(x, 'V' + gr), `SUM(V${f}:W${gr - 1})`, T.kg));
      });
    }
    const tail = Object.keys(shifted).sort((a, b) => a - b).map(n => shifted[n]).join('');

    // 4) mesclagens
    const merges = [];
    post.replace(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g, (m, c1, r1, c2, r2) => {
      r1 = +r1; r2 = +r2;
      if (r1 >= f && r1 < L.tail) return m;                       // região de dados: refeita abaixo
      if (kind === 'usd' && (r1 === L.tail + 2 || r1 === L.tail + 3)) return m;   // linhas extras: refeitas abaixo
      const dx = kind === 'usd' && r1 >= L.tail + 4 ? ex : 0;
      if (r1 >= L.tail) merges.push(`${c1}${r1 + d + dx}:${c2}${r2 + d + dx}`); else merges.push(`${c1}${r1}:${c2}${r2}`);
      return m;
    });
    if (kind === 'usd') for (let i = 0; i < between; i++) { const r = L.tail + d + 2 + i; merges.push(`G${r}:K${r}`, `P${r}:Q${r}`); }
    for (let r = f; r <= last; r++) L.merges.forEach(([a, b]) => merges.push(`${a}${r}:${b}${r}`));
    let post2 = post.replace(/<mergeCells[\s\S]*?<\/mergeCells>/, `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`);
    post2 = post2.replace(/<dimension ref="[^"]*"\/>/, '');
    let pre2 = pre.replace(/<dimension ref="[^"]*"\/>/, '');
    sheet = pre2 + head + data + tail + post2;
    zip.file(L.sheet, sheet);

    // área de impressão + recálculo ao abrir
    let wb = await zip.file('xl/workbook.xml').async('string');
    wb = wb.replace(L.printArea, L.printTo(d + ex)).replace(/<calcPr /, '<calcPr fullCalcOnLoad="1" ');
    zip.file('xl/workbook.xml', wb);
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }


  /* ============================================================
     DOCX — motor de edição por parágrafo (preserva a formatação)
     ============================================================ */
  const P_RE = /<w:p(?: [^>]*)?>(?:(?!<w:p[ >])[\s\S])*?<\/w:p>/g;            // parágrafo mais interno
  const TBL_RE = /<w:tbl>(?:(?!<w:tbl>)[\s\S])*?<\/w:tbl>/g;                   // tabela mais interna
  const TR_RE = /<w:tr(?: [^>]*)?>(?:(?!<w:tr[ >])[\s\S])*?<\/w:tr>/g;
  const paraText = p => (p.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>|<w:tab\/>/g) || []).map(t => t === '<w:tab/>' ? '\t' : xu(t.replace(/<[^>]+>/g, ''))).join('');
  const stripIds = x => x.replace(/ w14:paraId="[^"]*"/g, '').replace(/ w14:textId="[^"]*"/g, '');

  // troca o texto do parágrafo mantendo as runs: só mexe no trecho que mudou (prefixo/sufixo comuns)
  function setParaText(p, text) {
    const old = paraText(p);
    if (old === text) return p;
    let a = 0; const max = Math.min(old.length, text.length);
    while (a < max && old[a] === text[a]) a++;
    let b = 0;
    while (b < max - a && old[old.length - 1 - b] === text[text.length - 1 - b]) b++;
    const del = [a, old.length - b], ins = text.slice(a, text.length - b);
    // varre as <w:t> com posições no texto
    let pos = 0, done = false;
    const tre = /<w:t(?: [^>]*)?>[^<]*<\/w:t>|<w:tab\/>/g;
    let out = '', last = 0, m, firstTouched = false;
    while ((m = tre.exec(p))) {
      const isTab = m[0] === '<w:tab/>';
      const raw = isTab ? '\t' : xu(m[0].replace(/<[^>]+>/g, ''));
      const s = pos, e = pos + raw.length; pos = e;
      if (isTab) continue;
      const overlaps = e > del[0] && s < del[1];
      const atInsert = del[0] === del[1] && del[0] >= s && del[0] <= e && !done;   // inserção pura
      if (!overlaps && !atInsert) continue;
      let nt;
      if (del[0] === del[1]) { nt = raw.slice(0, del[0] - s) + ins + raw.slice(del[0] - s); done = true; }
      else {
        const ls = Math.max(del[0], s) - s, le = Math.min(del[1], e) - s;
        nt = raw.slice(0, ls) + (!firstTouched ? ins : '') + raw.slice(le); firstTouched = true;
      }
      const open = m[0].match(/^<w:t(?: [^>]*)?>/)[0].replace(/ xml:space="[^"]*"/, '').replace('<w:t', '<w:t xml:space="preserve"');
      out += p.slice(last, m.index) + open + xe(nt) + '</w:t>'; last = m.index + m[0].length;
      if (del[0] === del[1]) break;
    }
    out += p.slice(last);
    if (!firstTouched && del[0] !== del[1]) return p;
    return out;
  }
  // aplica regras [{re|str, to}] a todo parágrafo; to = string | fn(match, text) ; aplica todas as que casarem em sequência
  function patchParas(xml, rules, counters) {
    return xml.replace(P_RE, p => {
      let t = paraText(p); if (!t) return p;
      let nt = t;
      rules.forEach((r, i) => {
        if (r.re) { const re = new RegExp(r.re.source, r.re.flags.replace('g', '')); const m = re.exec(nt); if (m) { const v = typeof r.to === 'function' ? r.to(m, nt) : r.to; nt = typeof v === 'string' ? (r.whole ? v : nt.replace(re, () => v)) : nt; if (counters) counters[i] = (counters[i] || 0) + 1; } }
      });
      return nt === t ? p : setParaText(p, nt);
    });
  }
  const cloneRows = (tbl, rowIdx, n) => {          // repete a linha rowIdx para n linhas
    const rows = tbl.match(TR_RE);
    const proto = stripIds(rows[rowIdx]);
    return { rows, proto };
  };
  async function docxParts(JSZip, b64) {
    const zip = await JSZip.loadAsync(b64ToBytes(b64));
    const names = Object.keys(zip.files).filter(n => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n));
    return { zip, names };
  }
  async function patchDocx(JSZip, b64, fn) {       // fn(xml, partName) -> xml  para cada parte
    const { zip, names } = await docxParts(JSZip, b64);
    for (const n of names) { const x = await zip.file(n).async('string'); zip.file(n, fn(x, n)); }
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }
  async function dumpDocx(JSZip, b64) {            // para desenvolvimento: lista os parágrafos
    const { zip, names } = await docxParts(JSZip, b64); const out = [];
    for (const n of names) { const x = await zip.file(n).async('string'); let i = 0; x.replace(P_RE, p => { const t = paraText(p); if (t) out.push(`${n.replace('word/', '')}#${i} ${JSON.stringify(t)}`); i++; return p; }); }
    return out;
  }


  /* ---------- PACKING LIST ---------- */
  const staticField = pxml => pxml.replace(/<w:r(?: [^>]*)?>(?:(?!<w:r[ >])[\s\S])*?<\/w:r>/g, r => (/<w:fldChar|<w:instrText/.test(r) ? '' : r));
  const boxRange = (a, n) => (n > 1 ? `${a}-${a + n - 1}` : String(a));
  async function packingDocx(JSZip, tpl, o) {
    const T = totals(o), c = o.cons;
    return patchDocx(JSZip, tpl, (xml, part) => {
      if (part !== 'word/document.xml') return xml;
      // tabela principal
      xml = xml.replace(TBL_RE, tbl => {
        if (!/Species - Scientific Names/.test(tbl.replace(/<[^>]+>/g, ''))) return tbl;
        const rows = tbl.match(TR_RE), headRow = rows[0], proto = stripIds(rows[1]), totRow = rows[rows.length - 1];
        const setCells = (row, vals) => { let i = 0; return row.replace(P_RE, p => { const v = vals[i++]; return v === undefined ? p : setParaText(p, v); }); };
        let next = 1, body = '';
        T.lines.forEach(l => {
          body += setCells(proto, [boxRange(next, l.boxes), String(l.boxes), nPT(l.qpb), String(l.sci).toUpperCase(), String(l.pt || '').toUpperCase(), nPT(l.totalFish)]);
          next += l.boxes;
        });
        let tot = stripIds(staticField(totRow));
        tot = tot.replace(P_RE, p => { const t = paraText(p); return t === '118' ? setParaText(p, String(T.boxes)) : t === '35.184' ? setParaText(p, nPT(T.fish)) : p; });
        const i0 = tbl.indexOf(rows[1]), i1 = tbl.lastIndexOf(totRow) + totRow.length;
        return tbl.slice(0, i0) + body + tot + tbl.slice(i1);
      });
      return patchParas(xml, [
        { re: /^\d{3}\/\d{4}$/, to: `${o.invNum}/${o.ano}`, whole: true },
        { re: /^RUINEMANS GROUP$/, to: c.name, whole: true },
        { re: /^IJSSELVELD 09$/, to: c.addr1, whole: true },
        { re: /^MONTFOORT - HOLANDA$/, to: c.addr2, whole: true },
        { re: /^\d{2}\/\d{2}\/\d{4}$/, to: dataBR(o.dateISO), whole: true }
      ]);
    });
  }


  /* ---------- ATESTADOS e CZIs (modelos por destino) ---------- */
  const lower = s => String(s).toLowerCase();
  const MES_LC = MESES.map(lower);
  const dataLongaLc = iso => { if (!iso) return '__ de ________ de ____'; const p = parseISO(iso); return `${pad2(p.d)} de ${MES_LC[p.m - 1]} de ${p.y}`; };
  const depParts = dep => { const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(dep || ''); return m ? { date: dataBR(m[1]), time: m[2] } : { date: '', time: '' }; };
  const kgTxt = kg => (Math.round(kg * 100) / 100).toFixed(2).replace('.', ',');

  // troca a tabela de espécies (cabeçalho + linhas) pelo conteúdo do pedido; mantém uma linha final vazia, se o modelo tiver
  function fillSpecies(xml, headRe, rowVals) {
    return xml.replace(TBL_RE, tbl => {
      if (!headRe.test(tbl.replace(/<[^>]+>/g, ''))) return tbl;
      const rows = tbl.match(TR_RE); if (!rows || rows.length < 2) return tbl;
      const proto = stripIds(rows[1]), lastEmpty = !paraTextRow(rows[rows.length - 1]);
      const setCells = (row, vals) => { let i = 0; return row.replace(P_RE, p => { const v = vals[i++]; return v === undefined ? p : setParaText(p, v); }); };
      const body = rowVals.map(v => setCells(proto, v)).join('');
      const i0 = tbl.indexOf(rows[1]), i1 = tbl.lastIndexOf(rows[rows.length - 1]) + rows[rows.length - 1].length;
      return tbl.slice(0, i0) + body + (lastEmpty ? stripIds(rows[rows.length - 1]) : '') + tbl.slice(i1);
    });
  }
  const paraTextRow = row => (row.match(P_RE) || []).map(paraText).join('').trim();

  function docRules(o, kind, cfg) {
    const T = totals(o), c = o.cons, ex = o.ex || {}, num = `${o.invNum}/${o.ano}`;
    const dep = depParts(ex.dep);
    const lpco = String(ex.lpcoMapa || '').trim().replace(/\/SEV-GRU$/i, '');
    const lpcoFull = lpco + (cfg.lpcoSuffix || '') + '/SEV-GRU';
    const whole = (re, fn) => ({ re, to: fn, whole: true });
    const R = [];
    // número do atestado / invoice (qualquer "Nº 016/2026")
    R.push(whole(/N[º°] ?\d{3}\/\d{4}/, (m, t) => t.replace(/(N[º°] ?)\d{3}\/\d{4}/, `$1${num}`)));
    R.push(whole(/Quantidade total: ?[\d.]+ peixes/i, (m, t) => t.replace(/[\d.]+( peixes)/i, `${nPT(T.fish)}$1`)));
    // GTA
    R.push(whole(/GTA N[º°] ?\d*/, (m, t) => (ex.gta ? t.replace(/GTA (N[º°] ?)\d*( S[ée]rie: ?)?(\w*)?/, (mm, a, b) => `GTA ${a}${ex.gta}${b ? b + (ex.serie || '') : ''}`) : t)));
    // destino (atestados)
    if (cfg.dest) {
      R.push(whole(/^País de destino:/, (m, t) => {
        if (/Nome do importador/.test(t)) return t.replace(/^País de destino:\s*.*?\s+Nome do importador(:?)\s*.*?\s+Estabelecimento importador:\s*.*?\s+Endereço:\s*.*$/, (mm, col) => `País de destino: ${c.country} Nome do importador${col} ${c.nameAt || c.name} Estabelecimento importador: ${c.nameAt || c.name} Endereço: ${c.addrAt}`);
        return `País de destino: ${c.country}${/\s$/.test(t) ? ' ' : ''}`;
      }));
      R.push(whole(/^Nome do importador:/, () => `Nome do importador: ${c.nameAt || c.name}`));
      R.push(whole(/^Estabelecimento importador:/, () => `Estabelecimento importador: ${c.nameAt || c.name}`));
      R.push(whole(/^Endereço: .*(HOMESTEAD|HIKARIGAOKA)/, () => `Endereço: ${c.addrAt}`));
    }
    // datas de emissão
    R.push(whole(/^MANAUS\/AM,? \d{2} DE [A-ZÇ]+ DE \d{4}$/, (m, t) => t.replace(/\d{2} DE [A-ZÇ]+ DE \d{4}/, dataLonga(o.dateISO))));
    R.push(whole(/^MANAUS\/AM \d{2}\/\d{2}\/\d{4}$/, (m, t) => t.replace(/\d{2}\/\d{2}\/\d{4}/, dataBR(o.dateISO))));
    R.push(whole(/^\d{2}\/\d{2}\/\d{4}$/, () => dataBR(o.dateISO)));
    // ----- CZI -----
    if (cfg.czi) {
      R.push(whole(/E26\d{6,}(-\d)?\/SEV-GRU/, (m, t) => t.replace(/E26\d{6,}(-\d)?\/SEV-GRU/, lpcoFull)));
      R.push(whole(/Date: São Paulo, \d{1,2} de [a-zç]+ de \d{4}/, (m, t) => t.replace(/\d{1,2} de [a-zç]+ de \d{4}/, dataLongaLc(o.dateISO))));
      R.push(whole(/\d{2}\/\d{2}\/\d{4} – \d{2}:\d{2}/, (m, t) => (dep.date ? t.replace(/\d{2}\/\d{2}\/\d{4} – \d{2}:\d{2}/, `${dep.date} – ${dep.time}`) : t)));
      R.push(whole(/MAWB/, (m, t) => (ex.mawb ? t.replace(/(MAWB[^\d]*)\d[\d\- ]*\d/, `$1${ex.mawb}`) : t)));
      R.push(whole(/^HAWB:/, (m, t) => (ex.hawb ? t.replace(/(HAWB:\s*).*/, `$1${ex.hawb}`) : t)));
      R.push(whole(/^VOO:/, (m, t) => (ex.voo ? t.replace(/(VOO:\s*).*/, `$1${ex.voo}`) : t)));
      if (cfg.border) R.push(whole(/^\s*(NLAMS4|ALEMANHA)\s*$/, (m, t) => t.replace(/NLAMS4|ALEMANHA/, c.border || '')));
      R.push(whole(/^\s*\d+ CAIXAS$/, (m, t) => t.replace(/\d+ CAIXAS/, `${pad2(T.boxes)} CAIXAS`)));
      R.push(whole(/\d+ CAIXAS/, (m, t) => t.replace(/\d+ CAIXAS/, `${pad2(T.boxes)} CAIXAS`)));
      R.push(whole(/[\d.]+ PEIXES/, (m, t) => t.replace(/[\d.]+ PEIXES/, `${nPT(T.fish)} PEIXES`)));
      R.push(whole(/[\d.,]+ KGS?$/, (m, t) => t.replace(/[\d.,]+( KGS?)$/, `${kgTxt(T.kg)}$1`)));
      // importador
      R.push(whole(/^(Nome|1\. Importador:|Nome\/ Name:)\s*.*(RUINEMANS|FAR EAST)/, (m, t) => t.replace(/(RUINEMANS [A-Z ]+?|FAR EAST ENTERPRISE INC)\s*$/, c.name)));
      R.push(whole(/^(Endereço\s+IJSSELVELD|Endereço\s+HIKARIGAOKA|Endereço: HIKARIGAOKA|1\.1\. Endereço: 19150)/, (m, t) => t.replace(/^(.*?(?:Endereço:?\s*(?:1\.1\. )?)?)(IJSSELVELD.*|HIKARIGAOKA.*|19150.*)$/, `$1${c.addrAt}`)));
      R.push(whole(/^1\.1\. Endereço: (19150|HIKARIGAOKA)/, (m, t) => `1.1. Endereço: ${c.addrAt}`));
      R.push(whole(/^1\.2\. Contato \(tel\/email\):.*(305|\+ ?81)/, () => `1.2. Contato (tel/email): ${[c.phone, c.email].filter(Boolean).join(' - ')}`));
    }
    return R;
  }

  async function docFor(JSZip, tpl, o, cfg) {
    const T = totals(o);
    const sp = T.lines.map(l => [String(l.sci).toUpperCase(), String(l.pt || '').toUpperCase(), cfg.boxesCol ? String(l.boxes) : (cfg.dot ? nPT(l.totalFish) : String(l.totalFish))]);
    const obsItems = T.lines.map(l => `${l.totalFish} ${String(l.sci).toUpperCase()}`);
    const rules = docRules(o, cfg.kind, cfg);
    return patchDocx(JSZip, tpl, (xml, part) => {
      if (part === 'word/document.xml') {
        xml = fillSpecies(xml, cfg.headRe, sp);
        if (cfg.obs) {
          xml = xml.replace(P_RE, p => {
            const t = paraText(p); if (!/^\d+ [A-Z]/.test(t) || !/[A-Z]/.test(t) || !/ \/|\.$/.test(t)) return p;
            let a = '', acc = [], rest = obsItems.slice();
            while (rest.length && (a + rest[0]).length < 118) { a += (a ? ' / ' : '') + rest.shift(); acc.push(1); }
            if (/\/ ?$/.test(t)) return setParaText(p, a + ' / ');
            if (/\.$/.test(t)) return setParaText(p, rest.join(' / ') + '.');
            return setParaText(p, obsItems.join(' /'));
          });
        }
      }
      return patchParas(xml, rules);
    });
  }
  const DOC_CFG = {
    sisaEU: { kind: 'sisa', dest: true, dot: true, headRe: /Nome Específico/ },
    sisaUS: { kind: 'sisa', dest: true, headRe: /Nome Específico/ },
    sisaJP: { kind: 'sisa', dest: true, headRe: /Nome Específico/ },
    vigAMS: { kind: 'vig', dest: true, dot: true, headRe: /Nome Específico/ },
    vigUS: { kind: 'vig', dest: true, headRe: /Nome Específico/ },
    vigJP: { kind: 'vig', dest: true, headRe: /Nome Específico/ },
    cziEN: { kind: 'czi', czi: true, border: true, dot: true, headRe: /Nome científico \(gênero e espécie\)Nome comumQuantidades/ },
    cziDE: { kind: 'czi', czi: true, border: true, dot: true, lpcoSuffix: '-2', headRe: /Nome científico \(gênero e espécie\)Nome comumQuantidades/ },
    cziUS: { kind: 'czi', czi: true, boxesCol: true, obs: true, headRe: /Número de embalagens/ },
    cziJP: { kind: 'czi', czi: true, boxesCol: true, obs: true, lpcoSuffix: '-1', headRe: /Número de embalagens/ }
  };


  /* ---------- ETIQUETAS (2 por página, 1 por caixa) ---------- */
  function splitChildren(body) {
    const out = [], re = /<(\/?)w:(p|tbl|sectPr)(?=[ >\/])[^>]*?(\/?)>/g;
    let m, depth = 0, start = 0, tag = '';
    while ((m = re.exec(body))) {
      const close = m[1] === '/', self = m[3] === '/';
      if (self) { if (!depth) out.push({ tag: m[2], xml: m[0] }); continue; }
      if (!close) { if (!depth) { start = m.index; tag = m[2]; } depth++; }
      else { depth--; if (!depth) out.push({ tag, xml: body.slice(start, m.index + m[0].length) }); }
    }
    return out;
  }
  function fillLabel(xml, L, n, T, o) {
    const c = o.cons, ex = o.ex || {};
    let prev = '', consN = 0;
    xml = xml.replace(P_RE, p => {
      const t = paraText(p); if (!t.trim()) return p;
      let nt = t;
      if (prev === 'Scientific Name') nt = String(L.sci).toUpperCase();
      else if (prev === 'Common Name') nt = String(L.pt || '').toUpperCase();
      else if (prev === 'Quantity :') nt = String(L.qpb);
      else if (/^\d{1,3} ?$/.test(t) && prev === 'Box Nº') nt = pad2(n) + ' ';
      else if (consN > 0 && consN <= 4) { nt = [c.name + ' ', 'ADRESS: ' + (c.lab1 || c.addrAt), c.lab2 || c.countryLabel || '', 'PHONE: ' + (c.phone || '')][consN - 1]; consN++; if (consN > 4) consN = 0; }
      else if (/^N\.F\.:/.test(t)) nt = 'N.F.: ' + (ex.nf || '');
      else if (/^DEPARTURE:/.test(t)) nt = 'DEPARTURE: ' + (ex.aero || 'GRU');
      else if (/^KGS:/.test(t)) nt = 'KGS: ' + kgTxt(T.kg);
      else if (/^N°\. OF PIECES:/.test(t)) nt = 'N°. OF PIECES: ' + T.boxes;
      else if (/^LPCO:/.test(t)) nt = 'LPCO: ' + (ex.lpcoIbama || '');
      else if (/^DU-E:/.test(t)) nt = 'DU-E: ' + (ex.dued || '');
      else if (/^PACKING DATE:/.test(t)) nt = 'PACKING DATE:  ' + (ex.pkDate ? dataBR(ex.pkDate) : '');
      else if (/^PACKING TIME:/.test(t)) nt = 'PACKING TIME: ' + (ex.pkTime || '');
      else if (/^OXYGEN TIME:/.test(t)) nt = 'OXYGEN TIME: ' + (ex.oxy || '');
      else if (/^TEMPERATURE ?:/.test(t)) nt = 'TEMPERATURE : ' + (ex.temp || '');
      if (/^EMERGENCY PH:/.test(t)) consN = 1;
      prev = t;
      return nt === t ? p : setParaText(p, nt);
    });
    return xml;
  }
  async function etiquetasDocx(JSZip, tpl, o) {
    const T = totals(o), zip = await JSZip.loadAsync(b64ToBytes(tpl));
    const xml = await zip.file('word/document.xml').async('string');
    const b0 = xml.indexOf('<w:body>') + 8, b1 = xml.lastIndexOf('</w:body>');
    const ch = splitChildren(xml.slice(b0, b1));
    const A = ch.slice(0, 16).map(x => x.xml).join(''), NOTE = ch[16].xml, B = ch.slice(17, 32).map(x => x.xml).join(''), sect = ch[ch.length - 1].xml;
    const labels = []; T.lines.forEach(l => { for (let i = 0; i < l.boxes; i++) labels.push(l); });
    let body = '';
    for (let i = 0; i < labels.length; i += 2) {
      body += fillLabel(A, labels[i], i + 1, T, o) + NOTE;
      if (labels[i + 1]) body += fillLabel(B, labels[i + 1], i + 2, T, o);
    }
    body = stripIds(body) + sect;
    zip.file('word/document.xml', xml.slice(0, b0) + body + xml.slice(b1));
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }

  /* ============================================================
     API
     ============================================================ */
  function make({ JSZip, TPL }) {
    const need = k => { if (!TPL || !TPL[k]) throw new Error('Modelo de exportação ausente: ' + k); return TPL[k]; };
    return {
      totals, aduanaPrices,
      invoiceUsd: o => buildInvoice('usd', JSZip, need('inv'), o),
      invoiceBrl: o => buildInvoice('brl', JSZip, need('invBrl'), o),
      doc: (k, o) => docFor(JSZip, need(k), o, DOC_CFG[k]),
      etiquetasDocx: o => etiquetasDocx(JSZip, need('etiq'), o),
      packingDocx: o => packingDocx(JSZip, need('packing'), o),
      _dump: k => dumpDocx(JSZip, need(k))
    };
  }

  return { make, totals, aduanaPrices, _x: { paraText, setParaText, patchParas, P_RE, TBL_RE, TR_RE, stripIds, patchDocx }, util: { xe, xu, b64ToBytes, dataBR, dataLonga, serial, nPT, grp, r2, pad2, parseISO } };
});
