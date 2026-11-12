/* Prestige Pedidos — geração dos arquivos (Excel e Word). Usa ExcelJS e docx, no navegador ou no Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Docs = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dataBR = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  const dataLonga = iso => { const [y, m, d] = iso.split('-'); return `${d} de ${MESES[+m - 1]} de ${y}`; };
  const pad = (n, w) => String(n).padStart(w, '0');
  const fmtInt = n => n.toLocaleString('pt-BR');
  const linhasEnd = end => String(end || '').split(/\s*·\s*|\n/).map(s => s.trim()).filter(Boolean);
  const b64ToBytes = b64 => {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
    const bin = atob(b64), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
  const toBytes = async b => (b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b));

  function make({ ExcelJS, docx, JSZip, logoPngB64, logoJpgB64, tplNotinhaB64, tplEtiquetasB64, tplPackingB64, tplInvoiceB64, tplEmbarqueB64 }) {
    const up = s => String(s).trim().toUpperCase();
    const dnOf = cfg => it => ((cfg && cfg.apelidos) || {})[up(it.comum)] || up(it.comum); // nome do peixe nos documentos
    const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const thin = { style: 'thin', color: { argb: 'FF000000' } };
    const box = { top: thin, left: thin, bottom: thin, right: thin };

    /* ============ INVOICE (.xlsx) ============ */
    async function invoiceXlsx(o) {
      // preenche o modelo dele (INVOICE_PISCICULTURA_ANDRADE.xls): tamanho, larguras, cores e área de impressão ficam como no original
      const { P, cliente, cfg } = o, kg = cfg.valores.kgCaixa, dn = dnOf(cfg);
      const usd = !!(o.moeda && o.moeda.usd && o.moeda.taxa > 0), taxa = usd ? o.moeda.taxa : 1, en = usd || !!(o.moeda && o.moeda.en);
      const r4 = n => Math.round(n * 10000) / 10000, r2 = n => Math.round(n * 100) / 100;
      const unitOf = l => (usd ? r4(l.it.preco / taxa) : l.it.preco), valOf = l => (usd ? r2(l.peixes * unitOf(l)) : r2(l.valor));
      const totalValor = P.L.reduce((a, l) => a + valOf(l), 0);
      const zip = await JSZip.loadAsync(tplInvoiceB64, { base64: true });
      let s = await zip.file('xl/worksheets/sheet1.xml').async('string');
      const rowOf = n => { const m = s.match(new RegExp(`<row r="${n}"[\\s\\S]*?</row>`)); if (!m) throw new Error('Modelo da invoice inesperado (linha ' + n + ')'); return m[0]; };
      const styleOf = (rowXml, col) => { const m = rowXml.match(new RegExp(`<c r="${col}\\d+" s="(\\d+)"`)); return m ? m[1] : '0'; };
      const istr = (ref, st, t) => `<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${xe(t)}</t></is></c>`;
      const num = (ref, st, v) => `<c r="${ref}" s="${st}"><v>${v}</v></c>`;
      const fml = (ref, st, f, v) => `<c r="${ref}" s="${st}"><f>${f}</f><v>${v}</v></c>`;
      const emp = (ref, st) => `<c r="${ref}" s="${st}"/>`;
      const setCell = (xml, ref, cell) => { const re = new RegExp(`<c r="${ref}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`); if (!re.test(xml)) throw new Error('Modelo da invoice inesperado (' + ref + ')'); return xml.replace(re, () => cell); };
      const serial = iso => { const [y, m, dd] = iso.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, dd) - Date.UTC(1899, 11, 30)) / 86400000); };
      const stOf = (ref, xml) => (xml.match(new RegExp(`<c r="${ref}" s="(\\d+)"`)) || [0, '0'])[1];

      const iData = s.indexOf('<row r="9"');
      let head = s.slice(0, iData);
      const end = linhasEnd(cliente.end);
      head = setCell(head, 'N2', num('N2', stOf('N2', head), serial(o.dataISO)));
      if (o.num.invoice) head = setCell(head, 'G2', istr('G2', stOf('G2', head), String(o.num.invoice)));
      // valor total da GTA, embaixo da data
      const v = cfg.valores, gtaTot = o.nota && o.nota.totals && typeof o.nota.totals.gta === 'number' ? o.nota.totals.gta : (P.peixes > 0 ? v.gtaBase + v.gtaMilheiro * Math.ceil(P.peixes / 1000) : 0);
      let sty = await zip.file('xl/styles.xml').async('string');
      const cm = sty.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/), xl = cm[2].match(/<xf [^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g);
      const gtaSt = String(xl.length);
      sty = sty.replace(cm[0], `<cellXfs count="${xl.length + 1}">${cm[2]}${xl[10].replace(/numFmtId="\d+"/, 'numFmtId="4"').replace('applyFont="true"', 'applyFont="true" applyNumberFormat="true"')}</cellXfs>`);
      zip.file('xl/styles.xml', sty);
      head = setCell(head, 'N3', istr('N3', stOf('N1', head), usd ? 'GTA (US$)' : 'GTA (R$)'));
      head = setCell(head, 'N4', num('N4', gtaSt, usd ? r2(gtaTot / taxa) : Math.round(gtaTot * 100) / 100));
      if (en) { // fatura em inglês: só troca os textos dos cabeçalhos, o desenho do modelo não muda
        const hd = (ref, t) => { head = setCell(head, ref, istr(ref, stOf(ref, head), t)); };
        hd('C2', 'INVOICE NO.'); hd('N1', 'DATE'); hd('C7', 'N. boxes'); hd('E7', 'Qty per box'); hd('H7', 'SCIENTIFIC NAME'); hd('J7', 'COMMON NAME'); hd('L7', 'Total Fish');
        hd('N7', usd ? 'UNIT PRICE US$' : 'UNIT PRICE R$'); hd('O7', usd ? 'Total US$' : 'Total R$'); hd('Q7', 'Weight KG');
      }
      head = setCell(head, 'G3', istr('G3', stOf('G3', head), cliente.nome));
      head = setCell(head, 'G4', end[0] ? istr('G4', stOf('G4', head), end[0]) : emp('G4', stOf('G4', head)));
      head = setCell(head, 'G5', end[1] ? istr('G5', stOf('G5', head), end[1]) : emp('G5', stOf('G5', head)));

      // linhas de peixes: 1ª, 2ª e as demais seguem o desenho do modelo (linhas 9, 10 e 14)
      const protos = [rowOf(9), rowOf(10), rowOf(14)];
      const att = x => x.match(/^<row ([^>]*)>/)[1].replace(/\br="\d+"/, '').trim();
      const colsOf = x => [...x.matchAll(/<c r="([A-Z]+)\d+" s="(\d+)"/g)].map(m => [m[1], m[2]]);
      const n = P.L.length, first = 9, last = 8 + n;
      if (usd) { // preço unitário em dólar com 4 casas (0,12 R$ vira 0,0222 US$), senão arredondaria para 0,02
        let sy = await zip.file('xl/styles.xml').async('string');
        const cm2 = sy.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/), xl2 = cm2[2].match(/<xf [^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g), add = [], map = {};
        [...new Set(protos.map(pr => colsOf(pr).find(c => c[0] === 'N')[1]))].forEach(sid => { map[sid] = String(xl2.length + add.length); add.push(xl2[+sid].replace(/numFmtId="\d+"/, 'numFmtId="179"').replace(/applyNumberFormat="\w+"/, '').replace(/<xf /, '<xf applyNumberFormat="true" ')); });
        sy = sy.replace(cm2[0], `<cellXfs count="${xl2.length + add.length}">${cm2[2]}${add.join('')}</cellXfs>`).replace(/<numFmts count="(\d+)">/, (m0, c) => `<numFmts count="${+c + 1}"><numFmt numFmtId="179" formatCode="0.0000"/>`);
        zip.file('xl/styles.xml', sy); protos.forEach((pr, i) => { protos[i] = pr.replace(/(<c r="N\d+" s=")(\d+)"/, (m0, a, sid) => a + map[sid] + '"'); });
      }
      let body = '', merges = [];
      P.L.forEach((l, i) => {
        const r = 9 + i, pr = protos[Math.min(i, 2)], st = {}; colsOf(pr).forEach(([c, v]) => { st[c] = v; });
        const cells = [];
        const put = c => cells.push(c);
        put(l.boxesCol ? num(`C${r}`, st.C, l.boxesCol) : emp(`C${r}`, st.C)); put(emp(`D${r}`, st.D));
        put(num(`E${r}`, st.E, l.qtyBox)); put(emp(`F${r}`, st.F)); put(emp(`G${r}`, st.G));
        put(istr(`H${r}`, st.H, l.it.sci)); put(emp(`I${r}`, st.I));
        put(istr(`J${r}`, st.J, dn(l.it))); put(emp(`K${r}`, st.K || st.J));
        put(l.boxesCol ? fml(`L${r}`, st.L, `SUM(C${r}*E${r})`, l.peixes) : fml(`L${r}`, st.L, `E${r}`, l.peixes)); put(emp(`M${r}`, st.M));
        put(num(`N${r}`, st.N, unitOf(l)));
        put(fml(`O${r}`, st.O, `(L${r}*N${r})`, valOf(l))); put(emp(`P${r}`, st.P));
        put(l.boxesCol ? fml(`Q${r}`, st.Q, `(C${r}*${kg})`, l.boxesCol * kg) : emp(`Q${r}`, st.Q)); put(emp(`R${r}`, st.R));
        body += `<row r="${r}" ${att(pr)}>${cells.join('')}</row>`;
        ['C:D', 'E:G', 'H:I', 'L:M', 'O:P', 'Q:R'].forEach(m => { const [a, b] = m.split(':'); merges.push(`${a}${r}:${b}${r}`); });
        merges.push(`J${r}:K${r}`);
      });
      // totais (linhas 16 e 17 do modelo, 2 linhas mescladas)
      const t1 = rowOf(16), t2 = rowOf(17), ts = {}, t2s = {}; colsOf(t1).forEach(([c, v]) => { ts[c] = v; }); colsOf(t2).forEach(([c, v]) => { t2s[c] = v; });
      const a = last + 1, b = last + 2, rng = (c, c2) => `SUM(${c}${first}:${c2}${last})`;
      const mk = (r, S, main) => ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'].map(c => {
        const ref = `${c}${r}`;
        if (!main) return emp(ref, S[c]);
        if (c === 'C') return fml(ref, S.C, rng('C', 'D'), P.total);
        if (c === 'E') return istr(ref, S.E, '------');
        if (c === 'J') return istr(ref, S.J, '--------------');
        if (c === 'L') return fml(ref, S.L, rng('L', 'M'), P.peixes);
        if (c === 'N') return istr(ref, S.N, '---------');
        if (c === 'O') return fml(ref, S.O, rng('O', 'P'), Math.round(totalValor * 100) / 100);
        if (c === 'Q') return fml(ref, S.Q, rng('Q', 'R'), P.total * kg);
        return emp(ref, S[c]);
      }).join('');
      body += `<row r="${a}" ${att(t1)}>${mk(a, ts, true)}</row><row r="${b}" ${att(t2)}>${mk(b, t2s, false)}</row>`;
      ['C:D', 'E:G', 'J:K', 'L:M', 'N:N', 'O:P', 'Q:R'].forEach(m => { const [c1, c2] = m.split(':'); merges.push(`${c1}${a}:${c2}${b}`); });

      const tail = s.slice(s.indexOf('</sheetData>'));
      const oldMerges = (tail.match(/<mergeCell ref="[^"]+"\/>/g) || []).filter(m => { const r = m.match(/ref="[A-Z]+(\d+)/)[1]; return +r < 9; });
      let out = head + body + tail.replace(/<mergeCells[\s\S]*?<\/mergeCells>/, `<mergeCells count="${oldMerges.length + merges.length}">${oldMerges.join('')}${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`);
      out = out.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="C1:R${b}"/>`);
      out = out.replace(/hidden="true"(\s+outlineLevel="0"\s+max="11"\s+min="11")/, 'hidden="false"$1'); // coluna K visível: nomes comuns longos não ficam cortados
      zip.file('xl/worksheets/sheet1.xml', out);
      let wbx = await zip.file('xl/workbook.xml').async('string');
      wbx = wbx.replace(/(_xlnm\.Print_Area"[^>]*>INVOICE!\$C\$1:\$R\$)\d+/, `$1${b}`).replace(/<calcPr /, '<calcPr fullCalcOnLoad="1" ');
      zip.file('xl/workbook.xml', wbx);
      return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    }

    /* ============ NOTINHA FINAL (.xlsx) — preenche o modelo dele (NILVIA_JANETE.xlsx) ============ */
    async function notinhaXlsx(o, orc) {
      const { cliente, nota } = o, rows = nota.rows, T = orc ? o.orcT : nota.totals, ex = nota.ex;
      const zip = await JSZip.loadAsync(tplNotinhaB64, { base64: true });
      let s = await zip.file('xl/worksheets/sheet1.xml').async('string');
      const istr = (ref, st, text) => `<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${xe(text)}</t></is></c>`;
      const num = (ref, st, v) => (v === null || v === undefined || v === '' ? `<c r="${ref}" s="${st}"/>` : `<c r="${ref}" s="${st}"><v>${v}</v></c>`);
      const fml = (ref, st, f, v) => `<c r="${ref}" s="${st}"><f>${f}</f><v>${v}</v></c>`;
      const emp = (ref, st) => `<c r="${ref}" s="${st}"/>`;
      const rowOf = n => { const m = s.match(new RegExp(`<row r="${n}"[\\s\\S]*?</row>`)); if (!m) throw new Error('Modelo da nota do pedido inesperado (linha ' + n + ')'); return m[0]; };
      const setCell = (xml, ref, cell) => { const re = new RegExp(`<c r="${ref}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`); if (!re.test(xml)) throw new Error('Modelo da nota do pedido inesperado (' + ref + ')'); return xml.replace(re, cell); };
      const attrs = n => rowOf(n).match(/^<row ([^>]*)>/)[1].replace(/\br="\d+"/, '').trim();
      const R = (n, a, cells) => `<row r="${n}" ${a}>${cells.join('')}</row>`;
      const serial = iso => { const [y, m, d] = iso.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000); };

      // cabeçalho (linhas 1 a 9 do modelo)
      const iData = s.indexOf('<row r="10"');
      let head = s.slice(0, iData);
      head = setCell(head, 'A7', istr('A7', 53, orc ? 'ORÇAMENTO' : `EMBARQUE CHEGARÁ ${nota.dia}. ENVIAREMOS O CONHECIMENTO QUANDO POSSUIRMOS`));
      head = setCell(head, 'B8', istr('B8', 51, cliente.nome));
      head = setCell(head, 'D8', istr('D8', 33, orc ? 'DATA:' : 'ENTREGA:'));
      if (orc) head = setCell(head, 'G8', istr('G8', 34, 'CPF/CNPJ: ' + (cliente.doc || '')));
      head = setCell(head, 'E8', num('E8', 36, serial(o.dataISO)));

      const n = rows.length, sub = 10 + n, endItems = 9 + n;
      const aItem = attrs(10), aTot = attrs(22), aEmb2 = attrs(21);
      let out = '';
      rows.forEach((r, i) => {
        const rn = 10 + i, last = i === n - 1, total = r.cxs ? r.cxs * r.qtd : r.qtd;
        out += R(rn, aItem, [istr(`A${rn}`, 5, r.nome), emp(`B${rn}`, 4), emp(`C${rn}`, 10), num(`D${rn}`, 13, r.cxs || null), num(`E${rn}`, 13, r.qtd),
          fml(`F${rn}`, 22, r.cxs ? `(D${rn}*E${rn})` : `(E${rn})`, total), num(`G${rn}`, 19, r.unit), fml(`H${rn}`, 23, `(F${rn}*G${rn})`, total * r.unit), emp(`I${rn}`, last ? 25 : 32), emp(`J${rn}`, 2)]);
      });
      const blank = rn => R(rn, aItem, [emp(`A${rn}`, 5), emp(`B${rn}`, 4), emp(`C${rn}`, 10), emp(`D${rn}`, 13), emp(`E${rn}`, 13), emp(`F${rn}`, 13), emp(`G${rn}`, 19), emp(`H${rn}`, 24), emp(`I${rn}`, 25), emp(`J${rn}`, 2)]);
      out += R(sub, aItem, [emp(`A${sub}`, 5), emp(`B${sub}`, 4), emp(`C${sub}`, 10), emp(`D${sub}`, 13), emp(`E${sub}`, 13), emp(`F${sub}`, 13), emp(`G${sub}`, 19), fml(`H${sub}`, 24, `SUM(H10:H${endItems})`, T.fish), emp(`I${sub}`, 25), emp(`J${sub}`, 2)]);
      let tot, e2, firstSum = sub;
      const std = rn => [emp(`B${rn}`, 4), emp(`C${rn}`, 10), emp(`D${rn}`, 13), emp(`E${rn}`, 13), emp(`F${rn}`, 13)];
      if (orc) {
        // ORÇAMENTO: mesmo modelo da notinha; entre o subtotal e o total entram desconto, frete, taxa do despachante, GTA e embalagem
        let rn = sub + 1;
        const lab = (n2, txt) => istr(`A${n2}`, 5, txt);
        const vz = (n2, v, stG, stH, f) => [v > 0 ? num(`G${n2}`, stG, v) : istr(`G${n2}`, 19, '-'), v > 0 ? (f ? fml(`H${n2}`, stH, f, v) : num(`H${n2}`, stH, v)) : istr(`H${n2}`, 31, '-')];
        if (T.desconto > 0) {
          const d = rn++, p = rn++;
          out += R(d, aItem, [emp(`A${d}`, 5), emp(`B${d}`, 4), emp(`C${d}`, 10), emp(`D${d}`, 13), emp(`E${d}`, 13), emp(`F${d}`, 13), istr(`G${d}`, 19, `${String(T.pct).replace('.', ',')}% DESCONTO`), fml(`H${d}`, 24, `-ROUND(H${sub}*${T.pct}/100,2)`, -T.desconto), emp(`I${d}`, 25), emp(`J${d}`, 2)]);
          out += R(p, aItem, [emp(`A${p}`, 5), emp(`B${p}`, 4), emp(`C${p}`, 10), emp(`D${p}`, 13), emp(`E${p}`, 13), emp(`F${p}`, 13), emp(`G${p}`, 19), fml(`H${p}`, 24, `SUM(H${sub}:H${d})`, T.fish - T.desconto), emp(`I${p}`, 25), emp(`J${p}`, 2)]);
          firstSum = p;
        } else { out += blank(rn++); }
        out += blank(rn++);
        const lin = (n2, txt, v) => { out += R(n2, aItem, [lab(n2, txt), ...std(n2), ...vz(n2, v, 29, 17), emp(`I${n2}`, 25), emp(`J${n2}`, 2)]); };
        let k;
        if (ex.temAt) { k = rn++; lin(k, 'ATESTADO', T.atestado); }
        k = rn++; lin(k, 'GTA', T.gta);
        const e1 = ex.qCaixaMaior > 0 ? rn++ : null; e2 = rn++;
        if (e1) out += R(e1, aItem, [istr(`A${e1}`, 5, 'EMBALAGEM'), emp(`B${e1}`, 3), emp(`C${e1}`, 11), num(`D${e1}`, 13, ex.qCaixaMaior > 0 ? ex.qCaixaMaior : null), emp(`E${e1}`, 13), emp(`F${e1}`, 16), num(`G${e1}`, 20, ex.caixaMaior), fml(`H${e1}`, 30, `(D${e1}*G${e1})`, T.emb2), emp(`I${e1}`, 26), emp(`J${e1}`, 2)]);
        out += R(e2, aEmb2, [istr(`A${e2}`, 7, 'EMBALAGEM'), emp(`B${e2}`, 8), emp(`C${e2}`, 12), fml(`D${e2}`, 14, `SUM(D10:D${e2 - 1})`, T.caixas + (ex.qCaixaMaior > 0 ? ex.qCaixaMaior : 0)), emp(`E${e2}`, 15), emp(`F${e2}`, 15), num(`G${e2}`, 21, ex.embalagem), fml(`H${e2}`, 18, `(D${e2}*G${e2})`, T.emb), emp(`I${e2}`, 25), emp(`J${e2}`, 2)]);
        tot = e2 + 1;
        out += R(tot, aTot, [istr(`A${tot}`, 40, 'VALOR TOTAL '), emp(`B${tot}`, 41), emp(`C${tot}`, 41), emp(`D${tot}`, 41), emp(`E${tot}`, 41), emp(`F${tot}`, 41), emp(`G${tot}`, 42), fml(`H${tot}`, 6, `SUM(H${firstSum}:H${e2})`, T.total), emp(`I${tot}`, 2), emp(`J${tot}`, 2)]);
      } else {
        out += blank(sub + 1) + blank(sub + 2);
        const at = sub + 3, gt = sub + 4, e1 = sub + 5; e2 = sub + 6; tot = sub + 7;
        const std = rn => [emp(`B${rn}`, 4), emp(`C${rn}`, 10), emp(`D${rn}`, 13), emp(`E${rn}`, 13), emp(`F${rn}`, 13)];
        out += R(at, aItem, [istr(`A${at}`, 5, 'ATESTADO'), ...std(at), ex.temAt ? num(`G${at}`, 29, T.atestado) : istr(`G${at}`, 19, '-'), ex.temAt ? num(`H${at}`, 17, T.atestado) : istr(`H${at}`, 31, '-'), emp(`I${at}`, 25), emp(`J${at}`, 2)]);
        out += R(gt, aItem, [istr(`A${gt}`, 5, 'GTA'), ...std(gt), num(`G${gt}`, 29, T.gta), num(`H${gt}`, 17, T.gta), emp(`I${gt}`, 25), emp(`J${gt}`, 2)]);
        out += R(e1, aItem, [istr(`A${e1}`, 5, 'EMBALAGEM'), emp(`B${e1}`, 3), emp(`C${e1}`, 11), num(`D${e1}`, 13, ex.qCaixaMaior > 0 ? ex.qCaixaMaior : null), emp(`E${e1}`, 13), emp(`F${e1}`, 16), num(`G${e1}`, 20, ex.caixaMaior), fml(`H${e1}`, 30, `(D${e1}*G${e1})`, T.emb2), emp(`I${e1}`, 26), emp(`J${e1}`, 2)]);
        out += R(e2, aEmb2, [istr(`A${e2}`, 7, 'EMBALAGEM'), emp(`B${e2}`, 8), emp(`C${e2}`, 12), fml(`D${e2}`, 14, `SUM(D10:D${e1})`, T.caixas + (ex.qCaixaMaior > 0 ? ex.qCaixaMaior : 0)), emp(`E${e2}`, 15), emp(`F${e2}`, 15), num(`G${e2}`, 21, ex.embalagem), fml(`H${e2}`, 18, `(D${e2}*G${e2})`, T.emb), emp(`I${e2}`, 25), emp(`J${e2}`, 2)]);
        out += R(tot, aTot, [istr(`A${tot}`, 40, 'VALOR TOTAL '), emp(`B${tot}`, 41), emp(`C${tot}`, 41), emp(`D${tot}`, 41), emp(`E${tot}`, 41), emp(`F${tot}`, 41), emp(`G${tot}`, 42), fml(`H${tot}`, 6, `SUM(H${sub}:H${e2})`, T.total), emp(`I${tot}`, 2), emp(`J${tot}`, 2)]);
      }
      // linhas finais do modelo (23 em diante), renumeradas
      const iEnd = s.indexOf('</sheetData>');
      let rest = s.slice(s.indexOf('<row r="23"'), iEnd);
      const delta = tot + 1 - 23;
      rest = rest.replace(/<row r="(\d+)"/g, (_, r) => `<row r="${+r + delta}"`).replace(/<c r="([A-Z]+)(\d+)"/g, (_, c, r) => `<c r="${c}${+r + delta}"`);
      s = head + out + rest + s.slice(iEnd);
      s = s.replace('<mergeCell ref="A22:G22"/>', `<mergeCell ref="A${tot}:G${tot}"/>` + (orc ? '<mergeCell ref="E8:F8"/><mergeCell ref="G8:H8"/>' : '')).replace(/<mergeCells count="\d+">/, m => orc ? '<mergeCells count="7">' : m).replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:J${tot + 3}"/>`);
      zip.file('xl/worksheets/sheet1.xml', s);
      // recálculo ao abrir e sem cadeia de cálculo antiga
      let wbx = await zip.file('xl/workbook.xml').async('string');
      wbx = wbx.replace(/(Plan1!\$A\$1:\$I\$)22/, `$1${tot}`).replace('<calcPr calcId="191029"/>', '<calcPr calcId="191029" fullCalcOnLoad="1"/>');
      zip.file('xl/workbook.xml', wbx);
      zip.remove('xl/calcChain.xml');
      let ct = await zip.file('[Content_Types].xml').async('string');
      zip.file('[Content_Types].xml', ct.replace(/<Override PartName="\/xl\/calcChain\.xml"[^>]*\/>/, ''));
      let rl = await zip.file('xl/_rels/workbook.xml.rels').async('string');
      zip.file('xl/_rels/workbook.xml.rels', rl.replace(/<Relationship [^>]*calcChain[^>]*\/>/, ''));
      return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    }

    /* ============ WORD ============ */
    const D = docx;
    const jpg = () => b64ToBytes(logoJpgB64);
    const run = (text, o2 = {}) => new D.TextRun({ text, font: o2.font || 'Arial', size: o2.size || 18, bold: o2.bold, italics: o2.italics, underline: o2.underline ? {} : undefined });
    const para = (children, o2 = {}) => new D.Paragraph({ children: Array.isArray(children) ? children : [children], alignment: o2.align, spacing: { before: o2.before || 0, after: o2.after ?? 0, line: o2.line }, indent: o2.indent });
    const cellBorders = (st = 'single', sz = 4) => { const b = { style: D.BorderStyle[st === 'none' ? 'NONE' : 'SINGLE'], size: sz, color: '000000' }; return { top: b, bottom: b, left: b, right: b }; };
    const A4 = { size: { width: 11906, height: 16838 } };

    async function pack(doc) { return toBytes(await D.Packer.toArrayBuffer(doc)); }

    async function atestadoDocx(o) {
      const { P, cfg } = o, e = cfg.empresa, vet = cfg.vet, dn = dnOf(cfg);
      const nAt = `${pad(o.num.atestado, 3)}/${o.dataISO.slice(0, 4)}`;
      const logo = new D.ImageRun({ type: 'jpg', data: jpg(), transformation: { width: 92, height: 95 } });
      const cellP = (t, op = {}) => para(run(t, { size: op.size || 18, bold: op.bold }), { align: op.align || D.AlignmentType.CENTER });
      const hcell = t => new D.TableCell({ children: [cellP(t, { size: 22, bold: false })], borders: cellBorders(), verticalAlign: D.VerticalAlign.CENTER, width: { size: 25, type: D.WidthType.PERCENTAGE } });
      const rowsT = P.L.map(l => new D.TableRow({ children: [
        new D.TableCell({ children: [cellP(l.boxesCol ? String(l.boxesCol) : '')], borders: cellBorders() }),
        new D.TableCell({ children: [cellP(l.it.sci, { align: D.AlignmentType.LEFT })], borders: cellBorders() }),
        new D.TableCell({ children: [cellP(dn(l.it), { align: D.AlignmentType.LEFT })], borders: cellBorders() }),
        new D.TableCell({ children: [cellP(fmtInt(l.peixes), { size: 20 })], borders: cellBorders() }),
      ] }));
      const totalRow = new D.TableRow({ children: [
        new D.TableCell({ children: [cellP(String(P.total), { size: 28, bold: true })], borders: cellBorders() }),
        new D.TableCell({ children: [cellP('')], borders: cellBorders() }), new D.TableCell({ children: [cellP('')], borders: cellBorders() }),
        new D.TableCell({ children: [cellP(fmtInt(P.peixes), { size: 28, bold: true })], borders: cellBorders() }),
      ] });
      const table = new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, columnWidths: [1700, 3200, 2600, 1900], rows: [
        new D.TableRow({ children: ['QUANTIDADE DE CAIXAS', 'NOME CIENTÍFICO', 'NOME COMUM', 'QUANT. PEIXES'].map(hcell) }), ...rowsT, totalRow] });
      const txt = `O Médico Veterinário abaixo assinado atesta para os devidos fins, que os animais (peixes ornamentais), procedentes da Prestige Aquarium Ltda., CNPJ: ${e.cnpj}, Insc. Estadual ${e.ie}, localizada sito a ${e.enderecoAtestado}, abaixo relacionados, foram por mim inspecionados e submetidos a exames clínicos de acordo com o que dispõe o Decreto Federal n. 5.741 de 30 de março de 2006, encontram-se em boas condições sanitárias para trânsito de animais e não apresentaram sintomas de doenças infectocontagiosas e parasitárias, próprias da espécie, na data da emissão deste documento.`;
      const right = D.AlignmentType.RIGHT;
      const doc = new D.Document({ sections: [{ properties: { page: { ...A4, margin: { top: 700, bottom: 700, left: 1000, right: 1000 } } }, children: [
        para(logo, { after: 0 }),
        para(run(`ATESTADO   N. ${nAt}`, { size: 28, bold: true, underline: true }), { align: D.AlignmentType.CENTER, before: 0, after: 360 }),
        para(run(txt, { size: 18 }), { align: D.AlignmentType.JUSTIFIED, after: 300 }),
        table,
        para(run('Para animais obtidos por meio da pesca ou extrativismo, os animais procedem. De um estado brasileiro onde não houve registro de ocorrência de doenças da lista do código sanitário para animais Aquáticos da OIE nos 60 dias anteriores a saída dos animais.', { size: 18 }), { align: D.AlignmentType.JUSTIFIED, before: 300, after: 300 }),
        para(run('Conforme em Anexo,', { size: 18, bold: true }), { before: 200 }),
        para(run(`Nota Fiscal Nº.: ${o.num.nf} - SÉRIE 2`, { size: 18, bold: true })),
        para(run(`Manaus/AM, ${dataLonga(o.dataISO)}`, { size: 18, bold: true }), { after: 900 }),
        para(run('Médica Veterinária Emitente', { size: 16, bold: true }), { align: right }),
        para(run(vet.nome, { size: 16, bold: true }), { align: right }),
        para(run(vet.crmv, { size: 16, bold: true }), { align: right }),
        para(run(`Celular: ${vet.celular}`, { size: 16, bold: true }), { align: right }),
      ] }] });
      return pack(doc);
    }

    async function packingDocx(o) {
      // preenche o modelo dele (PACKINGLIST_NILVIA.doc): cabeçalho, logo, marca d'água e tabela ficam como estão
      const { P, cfg } = o, dn = dnOf(cfg);
      const zip = await JSZip.loadAsync(tplPackingB64, { base64: true });
      const d = await zip.file('word/document.xml').async('string');
      const t0 = d.indexOf('<w:tbl>'), tEnd = d.indexOf('</w:tbl>') + 8, tb = d.slice(t0, tEnd);
      const rows = tb.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g);
      if (!rows || rows.length < 2) throw new Error('Modelo de packing list inesperado');
      const rg = l => (l.ini === l.fim ? String(l.ini) : `${l.ini}-${l.fim}`);
      const proto = rows[1];
      const body = P.L.map(l => { const txt = [`${l.it.sci} – ${dn(l.it)}`, rg(l)]; let k = 0; return proto.replace(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g, () => `<w:t xml:space="preserve">${xe(txt[k++] || '')}</w:t>`); }).join('');
      const head = tb.slice(0, tb.indexOf(rows[0]) + rows[0].length);
      zip.file('word/document.xml', d.slice(0, t0) + head + body + '</w:tbl>' + d.slice(tEnd));
      return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    }

    /* ============ ETIQUETAS (.docx) — preenche o modelo dele (ETIQUETAS_NILVIA.docx: 6 caixas de texto por página, separadas) ============ */
    async function etiquetasDocx(o) {
      const { P, cliente, cfg } = o, dn = dnOf(cfg);
      const zip = await JSZip.loadAsync(tplEtiquetasB64, { base64: true });
      const d = await zip.file('word/document.xml').async('string');
      const b0 = d.indexOf('<w:body>') + 8, sIdx = d.lastIndexOf('<w:sectPr');
      const head = d.slice(0, b0), tail = d.slice(sIdx), body = d.slice(b0, sIdx);
      // parágrafos de nível superior do corpo (a página-modelo)
      const paras = []; { let dp = 0, st = 0; const re = /<w:p[ >]|<\/w:p>/g; let m; while ((m = re.exec(body))) { if (m[0] !== '</w:p>') { if (!dp) st = m.index; dp++; } else { dp--; if (!dp) paras.push(body.slice(st, m.index + 6)); } } }
      if (paras.length < 13) throw new Error('Modelo de etiquetas inesperado');
      const strip = x => x.replace(/\sw14:paraId="[^"]*"/g, '').replace(/\sw14:textId="[^"]*"/g, '').replace(/\swp14:anchorId="[^"]*"/g, '').replace(/\swp14:editId="[^"]*"/g, '');
      const setT = (p, text) => { let k = 0; return p.replace(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g, () => (k++ === 0 ? `<w:t xml:space="preserve">${xe(text)}</w:t>` : '<w:t></w:t>')); };
      const slotOf = (ac, pIdx) => { const h = +(ac.match(/<wp:positionH[^>]*><wp:posOffset>(-?\d+)/) || [0, 0])[1], v = +(ac.match(/<wp:positionV[^>]*><wp:posOffset>(-?\d+)/) || [0, 0])[1]; const row = pIdx === 3 ? 0 : (v < 2000000 ? 1 : 2); return row * 2 + (h < 0 ? 0 : 1); };
      const nf = String(o.num.nf);
      // geometria: todas as etiquetas do mesmo tamanho, com espaço entre elas (mesmas fontes e mesmo desenho do modelo)
      const CW = 3545404, CH = 2872635, GAP = 200000, XS = [-183721, 3491683], YS = [128492, 930000 + GAP + 76200, 3802635 + 2 * GAP + 76200];
      const fillBox = (ac, lab, slot) => {
        const choice = ac.match(/<mc:Choice[\s\S]*?<\/mc:Choice>/)[0]
          .replace(/<wp:extent cx="\d+" cy="\d+"\/>/, `<wp:extent cx="${CW}" cy="${CH}"/>`).replace(/<a:ext cx="\d+" cy="\d+"\/>/, `<a:ext cx="${CW}" cy="${CH}"/>`)
          .replace(/(<wp:positionH[^>]*><wp:posOffset>)-?\d+/, `$1${XS[slot % 2]}`).replace(/(<wp:positionV[^>]*><wp:posOffset>)-?\d+/, `$1${YS[Math.floor(slot / 2)]}`);
        return '<mc:AlternateContent>' + choice.replace(/<w:txbxContent>([\s\S]*?)<\/w:txbxContent>/, (m0, inner) => {
          const ps = inner.match(/<w:p\b(?:[^>]*\/>|[^>]*>[\s\S]*?<\/w:p>)/g).map(strip);
          const iSp = ps.findIndex(p => /AXELRODI|–/.test(p) && /w:line="276"/.test(p)), iNum = ps.findIndex(p => /\/0?\d+/.test(p.replace(/<[^>]+>/g, '')) && /w:sz w:val="36"/.test(p));
          const linhas = lab.items.reduce((a, x) => a + Math.ceil(`${x.it.sci} – ${dn(x.it)} – ${x.q}`.length / 42), 0), k = linhas - 1, nDrop = Math.round(k * 16 / 25), drop = new Set([8, 7, 6].slice(0, nDrop));
          const out = [];
          ps.forEach((p, i) => {
            if (drop.has(i) && i > iSp && i < iNum) return;
            if (i === 0) out.push(p);
            else if (i === 1) out.push(setT(p, cliente.nome));
            else if (i === iSp) lab.items.forEach(x => out.push(setT(p, `${x.it.sci} – ${dn(x.it)} – ${String(x.q)}`)));
            else if (i === iSp + 1) out.push(setT(p, nf));
            else if (i === iNum) out.push(setT(p, `${String(lab.no).padStart(2, '0')}/${String(lab.total).padStart(2, '0')}`));
            else out.push(p);
          });
          return '<w:txbxContent>' + out.join('') + '</w:txbxContent>';
        }) + '</mc:AlternateContent>';
      };
      const pages = Math.max(1, Math.ceil(P.boxes.length / 6)); let docId = 1000, out = '';
      for (let pg = 0; pg < pages; pg++) {
        const cl = paras.map((p, idx) => {
          let x = strip(p);
          if (idx === 6 || idx === 7 || idx === 11) x = x.replace(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g, '<w:t xml:space="preserve"> </w:t>'); // texto solto do modelo (fica escondido atrás da 1ª etiqueta)
          if (idx === 0 && pg > 0) x = x.replace(/<w:pPr>/, '<w:pPr><w:pageBreakBefore/>');
          x = x.replace(/<mc:AlternateContent>[\s\S]*?<\/mc:AlternateContent>/g, ac => {
            const slot = slotOf(ac, idx), lab = P.boxes[pg * 6 + slot];
            if (!lab) return '';
            return fillBox(ac, lab, slot).replace(/<wp:docPr id="\d+" name="[^"]*"/, () => `<wp:docPr id="${docId}" name="Etiqueta ${docId++}"`);
          });
          return x;
        });
        out += cl.join('');
      }
      zip.file('word/document.xml', head + out + tail);
      return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    }

    /* ============ PROGRAMAÇÃO DE EMBARQUES (.docx) — preenche o modelo dele (PROGRAMAÇÃO DE EMBARQUES.docx) ============ */
    async function embarqueDocx(o) {
      const zip = await JSZip.loadAsync(tplEmbarqueB64, { base64: true });
      const d = await zip.file('word/document.xml').async('string');
      const t0 = d.indexOf('<w:tbl>'), tEnd = d.indexOf('</w:tbl>') + 8, tb = d.slice(t0, tEnd);
      const rows = tb.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g);
      if (!rows || rows.length < 4) throw new Error('Modelo da programação de embarques inesperado');
      // põe o texto na 1ª "run" da célula e apaga as outras (o modelo quebra o texto em pedaços)
      const setCell = (tc, text) => {
        const runs = tc.match(/<w:r[ >][\s\S]*?<\/w:r>/g);
        if (runs) { let first = true; return tc.replace(/<w:r[ >][\s\S]*?<\/w:r>/g, r => { if (!first) return ''; first = false; return r.replace(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/, `<w:t xml:space="preserve">${xe(text)}</w:t>`).replace(/(<w:t xml:space="preserve">[^<]*<\/w:t>)[\s\S]*?(?=<\/w:r>)/, '$1'); }); }
        const rp = (tc.match(/<w:pPr>[\s\S]*?(<w:rPr>[\s\S]*?<\/w:rPr>)<\/w:pPr>/) || [0, ''])[1];
        return tc.replace(/<\/w:p>(?![\s\S]*<\/w:p>)/, `<w:r>${rp}<w:t xml:space="preserve">${xe(text)}</w:t></w:r></w:p>`);
      };
      const noIds = x => x.replace(/\sw14:paraId="[^"]*"/g, '').replace(/\sw14:textId="[^"]*"/g, ''); // ids repetidos nas linhas copiadas
      const fillRow = (row, texts) => { let k = 0; return noIds(row).replace(/<w:tc>[\s\S]*?<\/w:tc>/g, tc => { const t = texts[k++]; return t === undefined || t === null ? tc : setCell(tc, t); }); };
      const dias = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
      const [y, m, dd] = o.saidaISO.split('-').map(Number), dia = dias[new Date(y, m - 1, dd).getDay()];
      const title = fillRow(rows[0], [`${o.titulo} – ${dia}  (${pad(dd, 2)}/${pad(m, 2)}) `]);
      const kg = o.kg || 8, cxTxt = n => pad(n, 2), total = o.linhas.reduce((a, l) => a + (l.caixas || 0), 0);
      const body = o.linhas.map(l => fillRow(rows[2], [l.cliente, l.aero, cxTxt(l.caixas || 0), l.peso || `${(l.caixas || 0) * kg} KG`, l.dim || `${cxTxt(l.caixas || 0)} CXS DE ${o.dimPadrao}`])).join('');
      const last = noIds(rows[rows.length - 1]).replace(/(<w:t>)[^<]*(<\/w:t>)(?=(?:(?!<w:t>)[\s\S])*?<w:fldChar w:fldCharType="end")/, `$1${total}$2`); // célula de soma do Word: só troca o valor guardado
      zip.file('word/document.xml', d.slice(0, t0) + tb.slice(0, tb.indexOf(rows[0])) + title + rows[1] + body + last + '</w:tbl>' + d.slice(tEnd));
      return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    }

    const orcamentoXlsx = o => notinhaXlsx(o, true);
    return { invoiceXlsx, notinhaXlsx, orcamentoXlsx, atestadoDocx, packingDocx, etiquetasDocx, embarqueDocx };
  }

  return { make, dataBR, dataLonga, b64ToBytes };
});
