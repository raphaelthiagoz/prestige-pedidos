/* Prestige Pedidos — Exportação (tela). Usa exportdocs.js para preencher os seus modelos. */
(function () {
  'use strict';
  const PPx = window.PP, $ = PPx.$, esc = PPx.esc, store = PPx.store, F = PPx.Features;
  const ED = ExportDocs.make({ JSZip: window.JSZip, TPL: window.TPL_EXP || {} });
  const clone = o => JSON.parse(JSON.stringify(o));
  const todayISO = () => F.todayISO();
  const LOGO = 'data:image/png;base64,' + (window.LOGO_PNG_B64 || '');
  const MIME = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };

  /* ---------- destinos e consignees (cadastro editável) ---------- */
  const DEST = {
    AMS: {
      label: 'AMS · Holanda',
      cons: { name: 'RUINEMANS GROUP', nameAt: 'RUINEMANS GROUP', addr: 'IJSSELVELD 9', addr2: '3417 XH MONTFOORT - HOLLAND', addrAt: 'IJSSELVELD 9, 3417 XH MONTFOORT', lab1: 'IJSSELVELD 9, 3417 XH MONTFOORT', lab2: 'HOLLAND', phone: '+31 20 316 5090', email: '', country: 'HOLANDA (PAÍSES BAIXOS) - NL', border: 'NLAMS4' },
      atest: ['EU', 'VIG'], czi: ['EN'], modelo: 'CE.UE.AQ.ON.ABR.24.EN', vig: 'vigAMS'
    },
    MIA: {
      label: 'Miami · EUA',
      cons: { name: 'RUINEMANS AQUARIUM INC', nameAt: 'RUINEMANS INC', addr: '19150 SW 248TH STREET', addr2: 'HOMESTEAD = FLORIDA = USA = 33031', addrAt: '19150 SW 248TH STREET HOMESTEAD, FLORIDA 33031', lab1: '19150 SW 248TH STREET', lab2: 'HOMESTEAD, FLORIDA 33031 - USA', phone: '305-279-2349', email: 'miami@ruinemans.com', country: 'ESTADOS UNIDOS', border: '' },
      atest: ['US', 'VIG'], czi: ['US'], modelo: 'EXP.US.AQ.ON.MAI.11', vig: 'vigUS'
    },
    JPN: {
      label: 'Japão',
      cons: { name: 'FAR EAST ENTERPRISE INC', nameAt: 'FAR EAST ENTERPRISE INC', addr: 'HIKARIGAOKA 1-1322, SANRIZUKA', addr2: 'NARITA CHIBA KEN TOKYO, TOKYO - JAPAN', addrAt: 'HIKARIGAOKA 1-1322, SANRIZUKA NARITA CHIBA KEN TOKYO, TOKYO - JAPAN', lab1: 'HIKARIGAOKA 1-1322, SANRIZUKA', lab2: 'NARITA CHIBA KEN TOKYO, TOKYO - JAPAN', phone: '+81 47 635 8911', email: '', country: 'JAPÃO', border: 'ALEMANHA' },
      atest: ['JP', 'EU', 'VIG'], czi: ['DE', 'JP'], modelo: 'CE.UE.AQ.ON.ABR.24.DE e EXP.JP.PE.ON.MAI.11', vig: 'vigJP'
    }
  };
  const ATN = { EU: 'Atestado SISA – Europa', US: 'Atestado SISA – Estados Unidos', JP: 'Atestado SISA – Japão', VIG: 'Atestado VIGIAGRO – Guarulhos' };
  const CZN = { EN: 'CZI Inglês – AMS (CE.UE.AQ.ON.ABR.24.EN)', US: 'CZI Estados Unidos (EXP.US.AQ.ON.MAI.11)', DE: 'CZI Alemanha→Japão (CE.UE.AQ.ON.ABR.24.DE)', JP: 'CZI Japão (EXP.JP.PE.ON.MAI.11)' };
  const SISA_KEY = { EU: 'sisaEU', US: 'sisaUS', JP: 'sisaJP' };
  const CZI_KEY = { EN: 'cziEN', US: 'cziUS', DE: 'cziDE', JP: 'cziJP' };
  const PT = { 'otocinclus hoppei': 'LIMPA VIDRO', 'paracheirodon simulans': 'NEON VERDE', 'hemigrammus bleheri': 'RODOSTOMUS', 'paracheirodon axelrodi': 'CARDINAL', 'carnegiella strigata': 'BORBOLETA LISTRADA', 'poecilocharax weitzmani': 'BRILHANTE', 'symphysodon discus': 'DISCO', 'dianema urostriatum': 'RABO DE CHICOTE', 'heros severus': 'ACARA SEVERO', 'tucanoichthys tucano': 'TUCANO', 'nannostomus marginatus': 'TORPEDINHO', 'brochis splendens': 'BROCHIS' };
  const SEED_USED = [{ n: 13, d: 'MIA', dt: '13/10/2026' }, { n: 15, d: 'JPN', dt: '24/10/2026' }, { n: 16, d: 'AMS', dt: '04/11/2026' }];

  /* ---------- armazenamento ---------- */
  let CFG = Object.assign({ last: 17, ano: new Date().getFullYear(), cons: {}, ordem: [], used: SEED_USED.slice() }, store.get('expcfg', {}));
  let HIST = store.get('exphist', []);
  const saveCfg = () => store.set('expcfg', CFG);
  const saveHist = () => store.set('exphist', HIST);
  const consOf = d => Object.assign({}, DEST[d].cons, CFG.cons[d] || {});
  const newEx = () => ({ nf: '', aero: 'GRU', dued: '', mawb: '', hawb: '', awb: '', voo: '', dep: '', pkDate: todayISO(), pkTime: '06:00AM', oxy: '72HRS', temp: '20℃ – 27℃', fee: 12, gta: '', serie: '', lpcoMapa: '', lpcoIbama: '', vooNac: '', vooNacSai: '', vooNacChe: '', vooIntChe: '' });
  const newRot = () => ({ st: {}, nt: {}, no: {}, f: {}, only: false });
  const fresh = d => ({ dest: d || 'MIA', date: todayISO(), cons: consOf(d || 'MIA'), ex: newEx(), conv: { on: true, rate: '', date: todayISO(), msg: '' }, items: [], ordem: 'auto', tab: 'inv', sub: { atest: DEST[d || 'MIA'].atest[0], czi: DEST[d || 'MIA'].czi[0] }, invView: 'usd', allLabels: false, rot: newRot(), curId: null, n: null, msg: '' });
  let S = fresh('MIA');
  try { const r = store.get('expdraft', null); if (r && r.items && r.dest && DEST[r.dest]) { S = Object.assign(fresh(r.dest), r); S.rot = Object.assign(newRot(), r.rot || {}); S.ex = Object.assign(newEx(), r.ex || {}); S.conv = Object.assign({ on: true, rate: '', date: todayISO(), msg: '' }, r.conv || {}); S.cons = Object.assign(consOf(S.dest), r.cons || {}); } } catch (_) { /* rascunho inválido */ }
  const persist = () => { try { store.set('expdraft', S); } catch (_) { /* cheio */ } };
  const curN = () => (S.curId && S.n ? S.n : CFG.last + 1);
  const unitKg = () => (PPx.S.cfg && PPx.S.cfg.valores && PPx.S.cfg.valores.kgCaixa) || 8;

  /* nome em português: catálogo do app (com os "nomes nos documentos") → lista embutida → Coridora */
  function ptOf(sci) {
    const u = String(sci || '').trim().toUpperCase();
    const it = (PPx.S.catalog || []).find(x => String(x.sci).trim().toUpperCase() === u);
    if (it) { try { return PPx.Core.docName(it, PPx.S.cfg); } catch (_) { return String(it.comum || '').toUpperCase(); } }
    const k = u.toLowerCase();
    if (PT[k]) return PT[k];
    if (k.startsWith('corydoras')) return 'CORIDORA';
    return '';
  }
