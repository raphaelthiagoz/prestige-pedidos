/* Notas de entrada — PDF único para anexar no SEI do MAPA.
   - Guarda o PDF original de cada NF (neste aparelho, e na nuvem na tabela pp_files, para abrir em qualquer PC).
   - Junta só as páginas das NFs usadas no pack, na ordem da folha de grifos, e grifa em amarelo a espécie + quantidade
     (mesmo estilo do arquivo modelo). Sem capa. */
(function () {
  'use strict';
  const PP = window.PP;
  const pend = {}; // PDFs lidos nesta sessão, ainda não guardados {arq: {bytes, name}}
  const ST = { nuvem: '', fila: [] };

  /* ---------- armazenamento local (IndexedDB) ---------- */
  function idb() { return new Promise((res, rej) => { const r = indexedDB.open('pp-files', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function dbOp(mode, fn) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('f', mode), rq = fn(t.objectStore('f')); t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); }
  const dbGet = k => dbOp('readonly', s => s.get(k));
  const dbPut = (k, v) => dbOp('readwrite', s => s.put(v, k));
  const dbKeys = () => dbOp('readonly', s => s.getAllKeys());

  async function hash(bytes) {
    try { if (crypto && crypto.subtle) { const d = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(d)).slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join(''); } } catch (_) { /* cai no simples */ }
    let h1 = 0x811c9dc5, h2 = 5381; for (let i = 0; i < bytes.length; i++) { h1 = Math.imul(h1 ^ bytes[i], 16777619) >>> 0; h2 = ((h2 << 5) + h2 + bytes[i]) >>> 0; }
    return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0') + bytes.length.toString(16).padStart(8, '0');
  }
  const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = t => { const s = atob(t); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };

  /* ---------- nuvem (tabela pp_files) ---------- */
  async function req(method, query, body) {
    const cfg = PP.cloudCfg && PP.cloudCfg(); if (!cfg) throw new Error('off');
    if (!(PP.auth && PP.auth.hasSession())) throw new Error('sem login');
    const tk = await PP.auth.token();
    const h = { apikey: cfg.key, Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' };
    if (method === 'POST') h.Prefer = 'resolution=merge-duplicates,return=minimal';
    const r = await fetch(cfg.url.replace(/\/+$/, '') + '/rest/v1/pp_files' + (query || ''), { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) { const e = new Error('nuvem ' + r.status); e.status = r.status; throw e; }
    return method === 'GET' ? r.json() : null;
  }
  const fila = () => { try { return JSON.parse(localStorage.getItem('pp.filesUp') || '[]'); } catch (_) { return []; } };
  const salvaFila = a => { try { localStorage.setItem('pp.filesUp', JSON.stringify(a)); } catch (_) { /* ok */ } };
  function falhou(e) {
    if (e && e.message === 'off') { ST.nuvem = ''; return; }
    ST.nuvem = (e && (e.status === 404 || e.status === 400)) ? 'A tabela pp_files ainda não existe no Supabase: os PDFs ficam só neste aparelho. Rode o SQL que o Claude passou para ativar a nuvem dos PDFs.' : 'Não consegui falar com a nuvem agora; os PDFs ficam neste aparelho e sobem depois.';
  }
  async function subir(arq) {
    try {
      const f = await dbGet(arq); if (!f) return;
      await req('POST', '', { id: arq, name: f.name || '', data: b64(f.bytes), updated_at: new Date().toISOString() });
      salvaFila(fila().filter(x => x !== arq)); ST.nuvem = 'ok';
    } catch (e) { const q = fila(); if (!q.includes(arq)) { q.push(arq); salvaFila(q); } falhou(e); }
  }
  async function baixar(arq) {
    try { const rows = await req('GET', '?id=eq.' + encodeURIComponent(arq) + '&select=name,data'); if (!rows.length) return null; const f = { bytes: unb64(rows[0].data), name: rows[0].name || '' }; await dbPut(arq, f); ST.nuvem = 'ok'; return f; }
    catch (e) { falhou(e); return null; }
  }
  async function sync() { // sobe o que ficou na fila
    try { for (const a of fila()) await subir(a); } catch (_) { /* ok */ }
  }

  async function guardar(arq) {
    const p = pend[arq]; if (!p) return;
    try { await dbPut(arq, { bytes: p.bytes, name: p.name }); delete pend[arq]; } catch (_) { return; }
    subir(arq);
  }
  async function obter(arq) {
    if (!arq) return null;
    if (pend[arq]) { await guardar(arq); }
    let f = null; try { f = await dbGet(arq); } catch (_) { /* ok */ }
    if (f && f.bytes) return f.bytes;
    const n = await baixar(arq); return n ? n.bytes : null;
  }

  /* ---------- onde grifar ---------- */
  const core = () => PP.mapa.core;
  const rxQtd = /^\d[\d.]*,\d{2}$/;
  function boxNFe(row, h) {
    const its = row.its.slice().sort((a, b) => a.x - b.x), fs = h || 7, y = row.y;
    const ncm = its.findIndex((it, k) => k > 0 && /^\d{8}$/.test(String(it.str).trim()));
    const lim = ncm > 0 ? its[ncm].x : Infinity;
    const desc = its.filter(it => it.x < lim && /[A-Za-zÀ-ÿ]/.test(it.str));
    if (!desc.length) return [];
    const und = its.findIndex(it => /^und$/i.test(String(it.str).trim()));
    let q = null; if (und >= 0) q = its.slice(und + 1).find(it => rxQtd.test(String(it.str).trim()));
    const x0 = Math.min.apply(null, desc.map(d => d.x));
    const x1 = q ? q.x + (q.w || 0) : Math.max.apply(null, desc.map(d => d.x + (d.w || 0)));
    const out = [{ x: x0 - 0.4, y: y - fs * 0.29, w: x1 - x0 + 0.8, h: fs * 1.04 }];
    (row.ext || []).forEach(l => { const a = Math.min.apply(null, l.map(i => i.x)), b = Math.max.apply(null, l.map(i => i.x + (i.w || 0))); out.push({ x: a - 0.4, y: l[0].y - fs * 0.29, w: b - a + 0.8, h: fs * 1.04 }); });
    return out;
  }
  let _cv = null; // largura proporcional dos caracteres (fonte sem espaçamento fixo)
  function larg(s) { try { if (!_cv) { _cv = document.createElement('canvas').getContext('2d'); _cv.font = '100px Arial, Helvetica, sans-serif'; } return _cv.measureText(s).width; } catch (_) { return s.length; } }
  function boxesNFSe(its, esp, fs) { // texto corrido "ESPÉCIE - NOME - 5.000 - R$0,06;"
    const c = core(); let ini = its.findIndex(i => /REFERENTE A/i.test(i.str)); if (ini < 0) return [];
    let fim = its.findIndex((i, k) => k > ini && /TRIBUTA[ÇC][ÃA]O MUNICIPAL/i.test(i.str)); if (fim < 0) fim = its.length;
    const reg = its.slice(ini, fim).filter(i => i.str && i.str.trim());
    let txt = '', map = [];
    reg.forEach(i => { map.push({ it: i, a: txt.length, b: txt.length + i.str.length }); txt += i.str + ' '; });
    const re = /([A-Za-zÀ-ÿ]{3,})\s+([A-Za-zÀ-ÿ]{3,})\s*-\s*([^;]*?)\s*-\s*([\d.]+)\s*-\s*R\$\s*[\d.,]+/g; let m; const out = [];
    while ((m = re.exec(txt))) {
      const e = c.espDeTexto(m[1] + ' ' + m[2] + ' - ' + m[3], c.generosDe(PP.mapa.estado())); if (!e || !c.mesmaEsp(e, esp)) continue;
      const s0 = m.index, s1 = m.index + m[0].lastIndexOf(m[4]) + m[4].length; // vai até a quantidade (sem o preço)
      map.forEach(p => { const a = Math.max(s0, p.a), b = Math.min(s1, p.b); if (b <= a) return; const w = p.it.w || 0, str = p.it.str, tot = larg(str) || 1, xa = p.it.x + larg(str.slice(0, a - p.a)) / tot * w, xb = p.it.x + larg(str.slice(0, b - p.a)) / tot * w; out.push({ x: xa - 0.4, y: p.it.y - fs * 0.29, w: xb - xa + 0.8, h: fs * 1.04 }); });
    }
    return out;
  }

  async function lerPagina(lib, doc, n) {
    const pg = await doc.getPage(n), tc = await pg.getTextContent();
    return tc.items.map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height || Math.abs(i.transform[3]) || 7 }));
  }
  function jaGrifado(page, b) { // não dobra um grifo que você já tinha feito no PDF
    try {
      const A = page.node.Annots(); if (!A) return false;
      for (let i = 0; i < A.size(); i++) {
        const d = page.doc.context.lookup(A.get(i)); if (!d || !d.get) continue;
        const st = d.get(PDFLib.PDFName.of('Subtype')); if (!st || String(st) !== '/Highlight') continue;
        const r = d.lookup(PDFLib.PDFName.of('Rect'), PDFLib.PDFArray); if (!r) continue;
        const v = [0, 1, 2, 3].map(k => r.lookup(k, PDFLib.PDFNumber).asNumber());
        const ox = Math.min(v[2], b.x + b.w) - Math.max(v[0], b.x), oy = Math.min(v[3], b.y + b.h) - Math.max(v[1], b.y);
        if (ox > 0 && oy > 0 && ox * oy > 0.5 * b.w * b.h) return true;
      }
    } catch (_) { /* ok */ }
    return false;
  }

  let _lib = null;
  function carregarLib() {
    if (window.PDFLib) return Promise.resolve();
    if (_lib) return _lib;
    _lib = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/pdf-lib.min.js'; s.onload = () => res(); s.onerror = () => { _lib = null; rej(new Error('offline')); }; document.head.appendChild(s); });
    return _lib;
  }

  /* itens: [{esp,nfId,qtd}] (alocações do pack). Retorna {pdf,faltam,semLinha,nNFs,nPag,nGrifos} */
  async function montar(S, itens) {
    const c = core(), grupos = c.folhaGrifos(S, itens, false);
    const r = { pdf: null, faltam: [], semLinha: [], nNFs: 0, nPag: 0, nGrifos: 0, boxes: [] };
    const lib = await c.carregarPdfJs(); await carregarLib();
    const dados = [];
    for (const g of grupos) {
      const nf = g.nf, bytes = nf.arq && nf.pags && nf.pags.length ? await obter(nf.arq) : null;
      if (!bytes) { r.faltam.push(nf); continue; }
      dados.push({ g, nf, bytes });
    }
    if (r.faltam.length) return r;
    const out = await PDFLib.PDFDocument.create(), cache = {};
    for (const d of dados) {
      const { g, nf, bytes } = d;
      const src = cache[nf.arq] || (cache[nf.arq] = await PDFLib.PDFDocument.load(bytes.slice(), { ignoreEncryption: true }));
      const doc = await lib.getDocument({ data: bytes.slice() }).promise;
      const pgs = await out.copyPages(src, nf.pags.map(p => p - 1));
      const extra = c.generosDe(S);
      for (let k = 0; k < nf.pags.length; k++) {
        const page = out.addPage(pgs[k]), its = await lerPagina(lib, doc, nf.pags[k]);
        const linhas = c.agruparLinhas(its), pr = c.parsePaginaNF(linhas, extra), fs = (its.find(i => /\bund\b/i.test(i.str)) || its[0] || {}).h || 7;
        r.nPag++;
        g.usados.forEach(u => {
          let boxes = [];
          if (pr.tipo === 'nfe') pr.itens.filter(i => c.mesmaEsp(i.esp, u.esp)).forEach(i => { boxes = boxes.concat(boxNFe(i, fs)); });
          else if (pr.tipo === 'nfse') boxes = boxesNFSe(its, u.esp, Math.max(6, Math.min(fs, 9)));
          boxes.forEach(b => {
            r.boxes.push({ pg: r.nPag, nf: nf.numero, esp: u.esp, x: b.x, y: b.y, w: b.w, h: b.h });
            if (jaGrifado(page, b)) { r.nGrifos++; u._ok = true; return; }
            page.drawRectangle({ x: b.x, y: b.y, width: b.w, height: b.h, color: PDFLib.rgb(1, 0.93, 0), blendMode: PDFLib.BlendMode.Multiply });
            r.nGrifos++; u._ok = true;
          });
        });
      }
      g.usados.forEach(u => { if (!u._ok) r.semLinha.push({ nf, esp: u.esp }); else delete u._ok; });
      r.nNFs++;
    }
    r.pdf = await out.save();
    return r;
  }

  PP.nfpdf = { hash, pend, guardar, obter, sync, montar, st: ST, _x: { boxNFe, boxesNFSe, b64, unb64, dbKeys, dbGet, dbPut } };
  setTimeout(sync, 4000);
})();
