/* Prestige Pedidos — Frete: leitura do CT-e (PDF) e regras de cálculo/mensagem. Funciona no navegador e no Node. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.FreteCore = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const r2 = n => Math.round((+n || 0) * 100) / 100;
  const money = n => Number(r2(n)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parseMoney = s => { const t = String(s == null ? '' : s).replace(/[^\d,.-]/g, ''); if (!t) return NaN; const v = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t; return parseFloat(v); };
  const MONEY_RE = /^\d{1,3}(\.\d{3})*,\d{2}$/;
  const up = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

  /* items: [{s, x, y}] (y cresce para cima, como no PDF) */
  function parseCteItems(items) {
    const it = items.map(i => ({ s: String(i.s).trim(), x: i.x, y: i.y })).filter(i => i.s);
    const below = (labelRe, valRe, dx = [-12, 110], dy = [3, 30]) => {
      const lab = it.find(i => labelRe.test(i.s)); if (!lab) return null;
      const c = it.filter(i => valRe.test(i.s) && i.x >= lab.x + dx[0] && i.x <= lab.x + dx[1] && lab.y - i.y >= dy[0] && lab.y - i.y <= dy[1]);
      c.sort((a, b) => (lab.y - a.y) - (lab.y - b.y)); return c[0] || null;
    };
    const out = { ok: false };
    const awb = it.find(i => /^\d{3}-\d{8}$/.test(i.s)); out.awb = awb ? awb.s : '';
    const cte = it.find(i => /^\d{3}\.\d{3}\.\d{3}$/.test(i.s)); out.cte = cte ? cte.s : '';
    const ch = it.find(i => /^\d{44}$/.test(i.s)); out.nfChave = ch ? ch.s : ''; out.nf = ch ? String(parseInt(ch.s.slice(25, 34), 10)) : '';
    if (!out.nf) { const m = it.map(i => i.s).join(' ').match(/\bNF\s?0*(\d{3,9})\b/); if (m) out.nf = m[1]; }
    const rec = below(/VALOR A RECEBER/, MONEY_RE) || below(/VALOR TOTAL DA PRESTA/, MONEY_RE);
    out.total = rec ? parseMoney(rec.s) : NaN;
    const fr = it.find(i => i.s === 'FRETE'); // componente "FRETE"
    if (fr) { const v = it.filter(i => MONEY_RE.test(i.s) && Math.abs(i.y - fr.y) <= 3 && i.x > fr.x).sort((a, b) => a.x - b.x)[0]; out.componenteFrete = v ? parseMoney(v.s) : NaN; }
    if (!(out.total > 0)) { const comp = it.filter(i => MONEY_RE.test(i.s)).map(i => parseMoney(i.s)); out.total = NaN; out.candidatos = comp; }
    const vol = below(/QUANTIDADE DE VOLUMES/, /^\d+$/); out.vol = vol ? +vol.s : 0;
    const peso = below(/PESO BRUTO/, MONEY_RE, [-12, 80]); out.peso = peso ? parseMoney(peso.s) : NaN;
    const all = it.map(i => i.s).join(' ');
    const v = all.match(/VOO\s+(?:[A-Z]{3}\s+)?(\d{2,4})\s+(\d{2})\s+(\d{2})\b/); out.voo = v ? v[1] : ''; out.vooDia = v ? v[2] + '/' + v[3] : ''; // aceita "VOO GRU 3747 12 11" e "VOO 3747 12 11"
    const em = it.find(i => /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(i.s)); out.emissao = em ? em.s : '';
    const lab = it.find(i => i.s === 'DESTINATÁRIO:');
    if (lab) { const nm = it.filter(i => Math.abs(i.y - lab.y) <= 2 && i.x > lab.x + 40).sort((a, b) => a.x - b.x)[0]; out.dest = nm ? nm.s : ''; } else out.dest = '';
    const ent = it.find(i => /^DATA PREVISTA DA ENTREGA/.test(i.s));
    if (ent) { const d = it.filter(i => /^\d{2}\/\d{2}\/\d{4}$/.test(i.s) && Math.abs(i.x - ent.x) <= 80 && ent.y - i.y > 0 && ent.y - i.y <= 40)[0]; out.entrega = d ? d.s : ''; }
    out.ok = !!(out.awb || out.cte) && out.total > 0;
    return out;
  }

  /* acha a linha do embarque: 1) pela NF do pedido; 2) pelo nome do destinatário */
  function matchLinha(cte, linhas, hist) {
    const nfN = String(parseInt(cte.nf, 10) || ''); 
    if (nfN) {
      const hs = (hist || []).filter(h => String(parseInt(h.nf, 10) || '') === nfN);
      for (const h of hs) { const l = linhas.find(x => x.pedidoId === h.id) || linhas.find(x => up(x.cliente) === up(h.cliente && h.cliente.nome)); if (l) return { linha: l, por: 'NF ' + nfN }; }
    }
    const d = up(cte.dest); let best = null, bs = 0;
    linhas.forEach(l => { const c = up(l.cliente); if (!c) return; const toks = c.split(' ').filter(t => t.length > 1); if (!toks.length) return; const hit = toks.every(t => d.split(' ').includes(t)) || d.includes(c); if (hit && c.length > bs) { best = l; bs = c.length; } });
    if (best) return { linha: best, por: 'nome' };
    // plano C: o nome no CT-e é a razão social (ex.: MAEDA PEIXES ORNAMENTAIS LTDA) e na programação é o apelido (MAEDA AQUARIOS):
    // se a PRIMEIRA palavra do cliente aparece no destinatário e só uma linha serve, usa essa
    const ds = d.split(' '), cand = linhas.filter(l => { const t = up(l.cliente).split(' ').filter(x => x.length > 1)[0]; return t && t.length >= 4 && ds.includes(t); });
    return cand.length === 1 ? { linha: cand[0], por: 'nome parcial' } : null;
  }

  const DEF_MODELO_ANTIGO = 'EMBARQUE CHEGARÁ {hora} HORAS\nFRETE: R$ {total}';
  const DEF_MODELO = 'EMBARQUE CHEGARÁ {dia} ÀS {hora} HORAS\nFRETE: R$ {total}';
  // {dia}: HOJE, AMANHÃ ou a data, comparando o dia da chegada com o dia em que você copia a mensagem
  function diaTxt(chegaISO, hojeISO) { if (!chegaISO) return 'HOJE OU AMANHÃ'; if (!hojeISO) { const d = new Date(); hojeISO = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); } const f = x => { const [y, m, d] = x.split('-').map(Number); return Date.UTC(y, m - 1, d); }, n = Math.round((f(chegaISO) - f(hojeISO)) / 864e5); return n === 0 ? 'HOJE' : n === 1 ? 'AMANHÃ' : n === -1 ? 'ONTEM' : 'DIA ' + chegaISO.slice(8) + '/' + chegaISO.slice(5, 7); }
  function totalOf(rec, cfg) { const f = +rec.frete; return f > 0 ? r2(f + (rec.taxa != null && rec.taxa !== '' ? +rec.taxa : +cfg.taxa || 0)) : 0; }
  function msgFor(nome, rec, cfg, hojeISO) {
    if (rec.msg) return rec.msg;
    const tot = totalOf(rec, cfg), taxa = rec.taxa != null && rec.taxa !== '' ? +rec.taxa : +cfg.taxa || 0;
    let t = String(cfg.modelo || DEF_MODELO)
      .replace(/\{cliente\}/g, nome).replace(/\{dia\}/g, diaTxt(rec.chegaDia, hojeISO)).replace(/\{hora\}/g, rec.hora || '__:__').replace(/\{total\}/g, tot ? money(tot) : '—')
      .replace(/\{frete\}/g, +rec.frete > 0 ? money(rec.frete) : '—').replace(/\{taxa\}/g, money(taxa))
      .replace(/\{awb\}/g, rec.awb || '').replace(/\{cte\}/g, rec.cte || '').replace(/\{voo\}/g, rec.voo || '');
    if (cfg.detalhe && +rec.frete > 0) t += `\n(frete R$ ${money(rec.frete)} + taxa do despachante R$ ${money(taxa)})`;
    if (cfg.vooawb && (rec.voo || rec.awb)) t += `\n${[rec.voo ? 'VOO ' + rec.voo : '', rec.awb ? 'AWB ' + rec.awb : ''].filter(Boolean).join(' · ')}`;
    return t;
  }

  /* ---------- e-mail do despachante: tabela com AWB, destino, voo e HORA de chegada prevista ---------- */
  function parseEmail(text) {
    const rows = [];
    String(text || '').split(/\r?\n/).forEach(raw => {
      const line = raw.replace(/\t+/g, '  ').replace(/\s+$/, '');
      const m = line.match(/(?:^|\s)(\d{3}-\d{8})(?=\s|$)/); if (!m) return;
      const awb = m[1], i = line.indexOf(awb), before = line.slice(0, i).trim().replace(/^PRESTIGE\s+/i, ''), after = line.slice(i + awb.length);
      const bm = before.match(/^(.*?)\s*\b([A-Z]{3})$/), nums = after.match(/^\s*([\d.,]+)\s+([\d.,]+)/);
      const voos = []; after.replace(/\b([A-Z][A-Z0-9])\s?(\d{3,4})\/(\d{2})\b/g, (_, cia, num, dia) => { voos.push({ cia, num, dia }); return _; });
      const horas = after.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g) || [], ent = after.match(/\b(\d{1,2}\/[a-zç]{3})\b/i), jan = after.match(/\b(manhã|manha|tarde|noite)\b/i);
      rows.push({ awb, cliente: bm ? bm[1].trim() : before.trim(), dest: bm ? bm[2] : '', qtd: nums ? parseInt(nums[1], 10) || 0 : 0, voos, hora: horas.length ? horas[horas.length - 1].padStart(5, '0') : '', entrega: ent ? ent[1] : '', janela: jan ? jan[1].toLowerCase() : '' });
    });
    return rows;
  }
  /* mesma tabela, mas vinda de um PRINT lido por OCR: letras e números podem vir trocados, então tudo aqui é tolerante */
  function parseEmailOcr(text) {
    const rows = [];
    String(text || '').split(/\r?\n/).forEach(raw => {
      const line = raw.replace(/[|_;!\[\]{}()=~"'‘’“”«»]|—|–/g, ' ').replace(/\s+/g, ' ').trim();
      let hs = line.match(/\b(?:[01]?\d|2[0-3])[:.][0-5]\d\b/g); const fim = line.match(/(?:^|\s)([01]\d|2[0-3])\s?([0-5]\d)$/); // "1625" no fim da linha = 16:25 (o OCR às vezes come os dois-pontos)
      if (fim && !/[:.]\d\d$/.test(line)) hs = (hs || []).concat(fim[1] + ':' + fim[2]); if (!hs) return;
      const am = line.match(/\b(\d{3})\s?-\s?((?:\d ?){7}\d)(?!\d)/); if (!am && !/PREST/i.test(line)) return;
      const awbDig = am ? (am[1] + am[2]).replace(/\D/g, '') : '';
      const all = line.split(' '), iDig = all.findIndex(x => /\d/.test(x)), before = (iDig < 0 ? all : all.slice(0, iDig)).join(' ');
      let tk = before.split(' ').filter(x => /^[A-Za-zÀ-ú]{2,}$/.test(x)); if (tk.length && /^.?PR?E?S?T/i.test(tk[0])) tk.shift();
      let dest = ''; if (tk.length > 1 && /^[A-Za-z]{3}$/.test(tk[tk.length - 1])) dest = tk.pop().toUpperCase();
      tk = tk.filter((x, i) => i === 0 || x.length > 2); // sobras de 1-2 letras são lixo do OCR
      const after = am ? line.slice(am.index + am[0].length) : (iDig < 0 ? '' : all.slice(iDig).join(' ')), nums = after.match(/^\s*(\d{1,3})[.,]\s?\d/);
      const voos = []; after.replace(/\b[LlJ1][A4a]\s?(\d{2})\s?(\d{2})\s?\/\s?(\d{2})\b/g, (_, a, b, dia) => { voos.push({ cia: 'LA', num: a + b, dia }); return _; });
      const jan = after.match(/\b(manh[ãa]|tarde|noite)\b/i);
      if (!voos.length) { const dm = after.match(/\bL[A-Z0-9]{3,8}\s?\/\s?(\d{2})\b/g); if (dm) { const dd = dm[dm.length - 1].match(/(\d{2})$/)[1]; if (+dd >= 1 && +dd <= 31) voos.push({ cia: 'LA', num: '', dia: dd }); } }
      rows.push({ ocr: true, awb: awbDig.length === 11 ? awbDig.slice(0, 3) + '-' + awbDig.slice(3) : '', awbDig, cliente: tk.join(' ').toUpperCase(), dest, qtd: nums ? +nums[1] : 0, voos, hora: hs[hs.length - 1].replace('.', ':').padStart(5, '0'), entrega: '', janela: jan ? jan[1].toLowerCase() : '' });
    });
    return rows;
  }
  const soL = s => String(s || '').normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase();
  function lev(a, b) { const m = a.length, n = b.length; if (!m || !n) return m + n; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
  function matchEmailRowOcr(row, linhas, recOf) {
    // 1) AWB parecido com o do CT-e (até 3 dígitos trocados, e sem empate)
    if (row.awbDig && row.awbDig.length === 11) {
      const ds = linhas.map(l => { const a = String((recOf(l) || {}).awb || '').replace(/\D/g, ''); if (a.length !== 11) return null; let d = 0; for (let i = 0; i < 11; i++) if (a[i] !== row.awbDig[i]) d++; return { l, d }; }).filter(Boolean).sort((x, y) => x.d - y.d);
      if (ds.length && ds[0].d <= 3 && (ds.length === 1 || ds[1].d >= ds[0].d + 2)) return { linha: ds[0].l, por: ds[0].d ? 'AWB (aproximado)' : 'AWB' };
    }
    // 2) nome (o print pode juntar palavras ou trocar uma letra)
    const n = soL(row.cliente);
    if (n.length >= 3) {
      const c = linhas.map(l => { const full = soL(l.cliente), first = soL(String(l.cliente || '').trim().split(/\s+/)[0]); const d = Math.min(lev(n, full), lev(n, first), full.startsWith(n) ? 0 : 99, n.startsWith(first) && first.length >= 4 ? 0 : 99); return { l, d }; }).sort((x, y) => x.d - y.d);
      if (c.length && c[0].d <= (n.length >= 7 ? 2 : 1) && (c.length === 1 || c[1].d > c[0].d)) return { linha: c[0].l, por: 'nome' };
    }
    const k = linhas.filter(l => l.aero && l.aero.toUpperCase() === row.dest && +l.caixas === row.qtd);
    return k.length === 1 ? { linha: k[0], por: 'aeroporto + caixas' } : null;
  }
  // acha a linha do embarque: 1) pelo AWB do CT-e já anexado; 2) pelo nome; 3) pelo aeroporto + nº de caixas (se só uma serve)
  function matchEmailRow(row, linhas, recOf) {
    const a = linhas.find(l => (recOf(l) || {}).awb === row.awb); if (a) return { linha: a, por: 'AWB' };
    const n = row.cliente ? matchLinha({ nf: '', dest: row.cliente }, linhas, []) : null; if (n) return { linha: n.linha, por: 'nome' };
    const c = linhas.filter(l => l.aero && l.aero.toUpperCase() === row.dest && +l.caixas === row.qtd);
    return c.length === 1 ? { linha: c[0], por: 'aeroporto + caixas' } : null;
  }

  /* e-mail do despachante na EXPORTAÇÃO: INV, MAWB, HAWB, LPCO IBAMA/MAPA, DU-E, entrega, voos doméstico e internacional */
  function parseExpMail(text) {
    const t = String(text || '').replace(/\r/g, '').replace(/[–—]/g, '-').replace(/ /g, ' '), o = { dom: [] };
    let m;
    if ((m = /INV\.?\s*:?\s*(\d{1,4})\s*[\/.]\s*(\d{2,4})/i.exec(t))) o.inv = { n: +m[1], ano: +(m[2].length === 2 ? '20' + m[2] : m[2]) };
    if ((m = /MAWB\s*:?\s*(\d{3})\s*-?\s*(\d{8})/i.exec(t))) o.mawb = m[1] + '-' + m[2];
    if ((m = /HAWB\s*:?\s*([A-Z]{0,4}-?\d{4,})/i.exec(t))) o.hawb = m[1].toUpperCase();
    if ((m = /LPCO\s*\(?\s*IBAMA\s*\)?\s*:?\s*-?\s*(E\d{8,})([^\n]*)/i.exec(t))) { o.lpcoIbama = m[1].toUpperCase(); if (/exig[eê]ncia/i.test(m[2])) o.exigIbama = true; }
    if ((m = /LPCO\s*\(?\s*MAPA\s*\)?\s*:?\s*-?\s*(E\d{8,})([^\n]*)/i.exec(t))) { o.lpcoMapa = m[1].toUpperCase(); if (/exig[eê]ncia/i.test(m[2])) o.exigMapa = true; }
    if ((m = /DU-?E\s*:?\s*(\d{2}BR\d{9}-?\d)/i.exec(t))) o.due = m[1].toUpperCase();
    if ((m = /entrega[^\n]*?(\d{2}\/\d{2}\/\d{4})[^\n]*?\b[aà]s\s*(\d{1,2})(?:[:h](\d{2}))?/i.exec(t))) o.entrega = m[1] + ' às ' + String(m[2]).padStart(2, '0') + ':' + (m[3] || '00');
    const ini = t.search(/INTERNACIONAL/i), antes = ini >= 0 ? t.slice(0, ini) : t, depois = ini >= 0 ? t.slice(ini) : '';
    const rd = /^\s*([A-Z0-9]{2}\s?\d{3,5})\s*-\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/gim;
    while ((m = rd.exec(antes))) o.dom.push({ voo: m[1].replace(/\s/g, '').toUpperCase(), sai: m[2], chega: m[3] });
    if ((m = /([A-Z]{3})\s*\/\s*([A-Z]{3})\s*-\s*([A-Z0-9]{2}\s?\d{3,4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/i.exec(depois))) o.intl = { de: m[1].toUpperCase(), para: m[2].toUpperCase(), voo: m[3].replace(/\s/g, '').toUpperCase(), data: m[4] };
    o.ok = !!(o.mawb || o.lpcoIbama || o.lpcoMapa || o.due);
    return o;
  }
  return { parseEmailOcr, matchEmailRowOcr, diaTxt, DEF_MODELO_ANTIGO, parseExpMail, parseEmail, matchEmailRow, parseCteItems, matchLinha, totalOf, msgFor, money, parseMoney, r2, up, DEF_MODELO };
});
