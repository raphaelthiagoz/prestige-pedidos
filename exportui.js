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
  const newEx = () => ({ nf: '', aero: 'GRU', dued: '', mawb: '', hawb: '', awb: '', voo: '', dep: '', pkDate: todayISO(), pkTime: '06:00AM', oxy: '72HRS', temp: '20℃ – 27℃', fee: 12, disc: '', doa: '', frete: '', tarifa: '', gta: '', serie: '', lpcoMapa: '', lpcoIbama: '', vooNac: '', vooNacSai: '', vooNacChe: '', vooIntChe: '' });
  const newRot = () => ({ st: {}, nt: {}, no: {}, f: {}, only: false });
  const fresh = d => ({ dest: d || 'MIA', date: todayISO(), cons: consOf(d || 'MIA'), ex: newEx(), conv: { on: true, rate: '', date: todayISO(), msg: '' }, items: [], ordem: 'auto', tab: 'inv', sub: { atest: DEST[d || 'MIA'].atest[0], czi: DEST[d || 'MIA'].czi[0] }, invView: 'usd', allLabels: false, rot: newRot(), curId: null, n: null, msg: '' });
  let S = fresh('MIA');
  try { const r = store.get('expdraft', null); if (r && r.items && r.dest && DEST[r.dest]) { S = Object.assign(fresh(r.dest), r); S.rot = Object.assign(newRot(), r.rot || {}); S.ex = Object.assign(newEx(), r.ex || {}); S.conv = Object.assign({ on: true, rate: '', date: todayISO(), msg: '' }, r.conv || {}); S.cons = Object.assign(consOf(S.dest), r.cons || {}); } } catch (_) { /* rascunho inválido */ }
  const persist = () => { try { store.set('expdraft', S); } catch (_) { /* cheio */ } };
  const curN = () => (S.curId && S.n ? S.n : (S.nOver || CFG.last + 1));
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

  /* ---- pré-visualização ---- */
const nU=(v,d=0)=>Number(v||0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const nB=v=>Number(v||0).toLocaleString('pt-BR');
const p3=n=>String(n).padStart(3,'0');
const dBR=iso=>{if(!iso)return'';const[y,m,d]=iso.split('-');return d+'/'+m+'/'+y};
const MES=['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
const dExt=iso=>{const[y,m,d]=iso.split('-');return d+' DE '+MES[+m-1]+' DE '+y};

const ixOf=x=>S.items.indexOf(x);
const xe=(path,raw,ph,disp)=>{raw=raw==null?'':String(raw);return `<span class="xe${raw===''?' blank':''}" contenteditable="true" spellcheck="false" data-xe="${path}" data-raw="${esc(raw)}" data-ph="${esc(ph||'')}">${raw===''?'':esc(disp==null?raw:disp)}</span>`};
const E=(x,k,fmt)=>xe('items.'+ixOf(x)+'.'+k,x[k],k==='sci'?'espécie':k==='pt'?'nome comum':k,fmt&&String(x[k]??'')!==''?fmt(x[k]):null);
const EC=(k,v)=>xe('cons.'+k,S.cons[k],k,v==null||v===''?null:v);
const ed=(path,v,ph)=>xe(path,v,ph);
const bl=(v,ph='a preencher')=>v?esc(v):`<span class="blank">${ph}</span>`;
function T(){const L=S.items,boxes=L.reduce((a,x)=>a+ +x.boxes,0),fish=L.reduce((a,x)=>a+x.boxes*x.qpb,0),goods=L.reduce((a,x)=>a+x.boxes*x.qpb*x.price,0),kg=L.reduce((a,x)=>a+x.boxes*unit(x),0),fee=boxes*(+S.ex.fee||0);let c=0;const rng=L.map(x=>{const a=c+1;c+=+x.boxes;return x.boxes>1?a+'-'+c:''+a});return{boxes,fish,goods,kg,fee,total:goods+fee,rng}}
const cert=k=>{const m=S.ex.lpcoMapa;if(!m)return'';const suf=S.dest==='JPN'?(k==='JP'?'-1':k==='DE'?'-2':''):'';return m+suf+'/SEV-GRU'};
const depStr=()=>{const d=S.ex.dep;if(!d)return'';const[a,b]=d.split('T');return dBR(a)+' – '+(b||'')};

/* ===== preview builders ===== */
function invoice(){const adu=S.invView==='adu'&&aduOn();if(S.invView==='brl'&&S.conv.on)return invoiceBRL();const t=T(),c=S.cons;
 const ac=adu?aduCalc():null,ps=adu?ac.prices:null,ex=adu?aduExtras():origExtras(),adj=ex.reduce((a,e)=>a+e.value,0);
 const goods=adu?ac.sum:t.goods,total=goods+t.fee+adj;
 const rows=SI().map((x,i)=>{const pr=adu?ps[i]:x.price,man=adu&&ac.fixed[i]!=null;return `<tr><td class="c"><i>${E(x,'boxes')}</i></td><td class="c"><i>${E(x,'qpb')}</i></td><td><i>${E(x,'sci')}</i></td><td><i>${E(x,'pt')}</i></td><td class="r"><i>${nU(x.boxes*x.qpb)}</i></td><td class="r"><i>$ ${adu?xe('items.'+ixOf(x)+'.padu',pr,'preço',nU(pr,2)):E(x,'price',v=>nU(v,2))}</i>${man?'<sup title="preço digitado por você">✎</sup>':''}</td><td class="r"><i>$ ${nU(x.boxes*x.qpb*pr,2)}</i></td><td class="c"><i>${x.boxes*unit(x)}</i></td></tr>`}).join('');
 const exr=ex.map(e=>`<tr><td></td><td></td><td class="c"><i>${e.label}</i></td><td></td><td></td><td></td><td class="r">$ ${nU(e.value,2)}</td><td></td></tr>`).join('');
 const bar=adu?`<div class="xaduBar ${Math.abs(ac.diff)<0.005?'ok':'bad'}">${Math.abs(ac.diff)<0.005?'✓ Fecha com a invoice original: peixes + package fee = US$ '+nU(ac.alvo+t.fee,2):'⚠ Não fecha por US$ '+nU(Math.abs(ac.diff),2)+' (ajuste algum preço)'} · os preços foram recalculados sozinhos; se mudar um, os outros se acertam. <button type="button" data-xa="aduReset">↺ Recalcular tudo</button></div>`:'';
 return bar+`<div class="xpaper"><div class="ttl" style="font-size:24px;margin-top:20px">PRESTIGE AQUARIUM LTDA.</div><div class="sub">* EXPORTERS OF TROPICAL FISH *</div>
 <p style="font-size:9px"><b>ADDRESS</b><br>PRESTIGE - MANAUS - AMAZONAS - BRASIL<br>RUA SANTA BARBARA 300 - FLORES</p>
 <table style="margin:10px 0"><tr><td style="width:80px"><b>INVOICE N.º</b></td><td style="border-bottom:1px solid #000;width:200px">${numStr()}</td><td></td><td class="r"><b>Date:</b> ${dBR(S.date) || '__/__/____'}</td></tr>
 <tr><td><b>SOLD TO</b></td><td colspan="3" style="border-bottom:1px solid #000">${EC('name')}</td></tr><tr><td></td><td colspan="3" style="border-bottom:1px solid #000">${EC('addr')}</td></tr><tr><td></td><td colspan="3" style="border-bottom:1px solid #000">${EC('addr2')}</td></tr></table>
 <table class="tl"><tr><th>N.º Boxes</th><th>Qty p/ Box</th><th>Species - Scientific Name</th><th>Common Name</th><th>Total Fish</th><th>Unit. Price US$</th><th>Total US$</th><th>Weight Kgs</th></tr>${rows}
 <tr class="yel"><td class="c">-</td><td class="c">-</td><td class="c"><i>TOTAL</i></td><td></td><td class="c">-</td><td class="c">-</td><td class="r">$ ${nU(goods,2)}</td><td></td></tr>
 <tr><td></td><td></td><td class="c"><i>PACKAGE FEE</i></td><td></td><td class="r">${t.boxes}</td><td class="r">$ ${nU(S.ex.fee,2)}</td><td class="r">$ ${nU(t.fee,2)}</td><td></td></tr>${exr}
 <tr class="yel" style="font-size:12px"><td class="c">${t.boxes}</td><td class="c">-</td><td colspan="2"></td><td class="c">${nU(t.fish)}</td><td class="c">-</td><td class="r">$ ${nU(total,2)}</td><td class="c">${t.kg}</td></tr></table></div>`}

const nR=(v,d=2)=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
function invoiceBRL(){const t=T(),c=S.cons,r=+S.conv.rate||0,adu=aduOn(),ac=adu?aduCalc():null,exs=adu?aduExtras():[],exv=exs.reduce((a,e)=>a+e.value,0),pp=i=>adu?ac.prices[i]:SI()[i].price,gd=adu?SI().reduce((a,x,i)=>a+x.boxes*x.qpb*pp(i),0):t.goods,tot=gd+t.fee+exv;
 const rows=SI().map((x,i)=>{const usd=x.boxes*x.qpb*pp(i);return `<tr><td class="c"><i>${E(x,'boxes')}</i></td><td class="c"><i>${E(x,'qpb')}</i></td><td><i>${E(x,'sci')}</i></td><td><i>${E(x,'pt')}</i></td><td class="r"><i>${nU(x.boxes*x.qpb)}</i></td><td class="r"><i>$ ${adu?nU(pp(i),4):E(x,'price',v=>nU(v,2))}</i></td><td class="r gr1"><i>${nR(pp(i)*r,4)}</i></td><td class="r"><i>$ ${nU(usd,2)}</i></td><td class="r gr1"><i>R$ ${nR(usd*r)}</i></td><td class="c"><i>${x.boxes*unit(x)}</i></td></tr>`}).join('');
 return `<div class="xpaper" style="max-width:900px"><div style="display:flex;justify-content:space-between;align-items:start"><div style="font-size:9px"><b>INVOICE N.º</b> ${numStr()}<br><b>SOLD TO</b> ${EC('name')}<br>${EC('addr')} · ${EC('addr2')}</div><div style="text-align:right"><div class="cotbox"><div>COTAÇÃO DÓLAR (PTAX compra)</div><div style="font-size:14px"><b>US$ 1 = R$ ${nR(r,4)}</b></div><div style="font-size:8.5px">${dBR(S.conv.date)}</div></div></div></div>
 <style>.gr1{background:#8ee08a}.cotbox{background:#8ee08a;border:1px solid #2a7;padding:3px 8px}</style>
 <table class="tl" style="margin-top:10px"><tr><th>N.º Boxes</th><th>Qty p/ Box</th><th>Species - Scientific Name</th><th>Common Name</th><th>Total Fish</th><th>Unit. Price US$</th><th class="gr1">preço unit R$</th><th>Total US$</th><th class="gr1">Total R$</th><th>Weight Kgs</th></tr>${rows}
 <tr class="yel"><td class="c">-</td><td class="c">-</td><td class="c"><i>TOTAL</i></td><td></td><td class="c">-</td><td class="c">-</td><td></td><td class="r">$ ${nU(gd,2)}</td><td class="r">R$ ${nR(gd*r)}</td><td></td></tr>
 <tr><td></td><td></td><td class="c"><i>PACKAGE FEE</i></td><td></td><td class="r">${t.boxes}</td><td class="r">$ ${nU(S.ex.fee,2)}</td><td></td><td class="r">$ ${nU(t.fee,2)}</td><td class="r">R$ ${nR(t.fee*r)}</td><td></td></tr>
 ${exs.map(e=>`<tr><td></td><td></td><td class="c"><i>${esc(e.label)}</i></td><td></td><td></td><td></td><td></td><td class="r">$ ${nU(e.value,2)}</td><td class="r">R$ ${nR(e.value*r)}</td><td></td></tr>`).join('')}
 <tr class="yel" style="font-size:12px"><td class="c">${t.boxes}</td><td class="c">-</td><td colspan="2"></td><td class="c">${nU(t.fish)}</td><td class="c">-</td><td></td><td class="r">$ ${nU(tot,2)}</td><td class="r" style="background:#8ee08a">R$ ${nR(tot*r)}</td><td class="c">${t.kg}</td></tr></table>
 <p style="margin-top:8px;font-size:10px"><b>Uso interno (para emitir a Nota Fiscal) — não enviar ao cliente.</b>${adu?' Valores da invoice ADUANA (preços recalculados + frete pré-pago).':''}</p></div>`}
function packing(){const t=T(),c=S.cons;
 const rows=SI().map((x,i)=>`<tr><td class="c">${t.rng[i]}</td><td class="c">${E(x,'boxes')}</td><td class="c">${E(x,'qpb')}</td><td>${E(x,'sci')}</td><td class="c">${E(x,'pt')}</td><td class="r">${nB(x.boxes*x.qpb)}</td></tr>`).join('');
 return `<div class="xpaper"><div style="display:flex;align-items:center;gap:16px"><img class="logo" src="${LOGO}"><div style="flex:1;text-align:center"><div class="ttl" style="font-style:normal;font-size:20px">PRESTIGE AQUARIUM LTDA</div><div class="sub">* EXPORTERS OF TROPICAL FISH *</div></div></div>
 <h3 style="font-size:18px;font-style:italic;text-decoration:underline;margin:10px 0">Packing List</h3>
 <p style="font-size:8.5px"><b><u>CABLE ADDRESS:</u></b><br>PRESTIGE - MANAUS - AMAZONAS<br>CELLPHONE/WHATSAPP: +55(92)99112-9148<br>RUA SANTA BARBARA 300 - FLORES<br>EMAIL: cirlacarvalho@hotmail.com</p>
 <table style="margin:8px 0"><tr><td style="width:120px"><b>Packing List N.º</b></td><td><u>${numStr()}</u></td><td class="r"><b>DATE: ${dBR(S.date) || '__/__/____'}</b></td></tr><tr><td><b>SOLD TO:</b></td><td colspan="2"><u>${EC('name')}</u><br><u>${EC('addr')}</u><br><u>${EC('addr2')}</u></td></tr></table>
 <table class="grid"><tr><th>N° of Box</th><th>Quantity of Box</th><th>Quantity per box</th><th>Species - Scientific Names</th><th>Common Name</th><th>Total Fishes</th></tr>${rows}
 <tr style="font-weight:700;font-size:13px"><td class="c">-</td><td class="c">${t.boxes}</td><td class="c">-</td><td></td><td></td><td class="r">${nB(t.fish)}</td></tr></table></div>`}
function labels(){const t=T(),c=S.cons,e=S.ex;let out=[],n=0;
 SI().forEach(x=>{for(let i=0;i<x.boxes;i++){n++;out.push({n,x})}});
 const show=S.allLabels?out:out.slice(0,4);
 const html=show.map(({n,x})=>`<div class="xlab"><div class="nt">NOTE: Any problem with this box please call the shipper or the consignee. This box contains live ornamental fish, which cannot be exposed to direct sunlight or high temperatures and put into freezers. Just keep at normal 20ºC - 27ºC temperature</div>
 <div style="display:flex;align-items:center;gap:10px"><img src="${LOGO}" style="height:44px"><div style="flex:1;text-align:center;font-size:21px">LIVE ORNAMENTAL FISH</div></div>
 <div class="g"><div><u>Shipper Name and Address</u><br>PRESTIGE AQUARIUM LTDA<br>ADDRESS: RUA SANTA BARBARA, 300 · MANAUS – AMAZONAS – BRAZIL<br>PHONE: +55 (92) 3654-4746</div><div><u>Consignee's Name and Address</u><br>${EC('name')}<br>ADDRESS: ${EC('lab1',c.lab1||c.addrAt)}<br>${EC('lab2')}<br>PHONE: ${EC('phone')}</div></div>
 <div class="mid"><div class="g" style="grid-template-columns:auto 1fr"><div>Content:</div><div>ORNAMENTAL FISH</div><div>Scientific Name</div><div>${E(x,'sci')}</div><div>Common Name</div><div>${E(x,'pt')}</div><div>Quantity:</div><div>${E(x,'qpb')}</div></div>
 <div class="bn">Box Nº<div style="font-size:28px">${p3(n).slice(1)}</div></div>
 <div style="border:1px solid #c00000;padding:3px;font-size:9px">N.F.: ${ed('ex.nf',e.nf,'NF')}<br>DEPARTURE: ${ed('ex.aero',e.aero,'aero')}<br>KGS: ${nU(t.kg,2)}<br>N°. OF PIECES: ${t.boxes}<br>LPCO: ${ed('ex.lpcoIbama',e.lpcoIbama,'LPCO IBAMA')}<br>DU-E: ${ed('ex.dued',e.dued,'DU-E')}</div></div>
 <div class="mid" style="grid-template-columns:1.5fr 1.4fr"><div class="fr">FRAGILE<div style="font-size:11px;font-weight:400">HANDLE<br>WITH CARE</div></div><div style="border:1px solid #c00000;padding:3px;font-size:9px">DATE, TIME FIRST PACKING:<br>PACKING DATE: ${dBR(e.pkDate)}<br>PACKING TIME: ${ed('ex.pkTime',e.pkTime,'pkTime')}<br>OXYGEN TIME: ${ed('ex.oxy',e.oxy,'oxy')}<br>TEMPERATURE: ${ed('ex.temp',e.temp,'temp')}</div></div></div>`).join('');
 return `<div class="xpaper" style="background:#dfe3e4">${html}<div style="text-align:center;color:#444;margin:6px">${S.allLabels?'':`Mostrando 4 de ${out.length} etiquetas (uma por caixa). `}<button type="button" data-xa="alllab">${S.allLabels?'Mostrar só 4':'Mostrar todas as '+out.length}</button></div></div>`}
function mercad(){const t=T();return `<div class="sec">MERCADORIA</div><p>Identificação: PEIXES VIVOS ORNAMENTAIS</p><p>Quantidade total: ${nB(t.fish)} peixes</p><p>Finalidade: EXPORTAÇÃO ( ) Temporária (X) Definitiva</p>
 <table class="grid" style="margin:4px 0"><tr><th>Nome Específico / Scientific name</th><th>Nome comum / Common Name</th><th>Quantidade / Quantity</th></tr>${SI().map(x=>`<tr><td>${E(x,'sci')}</td><td class="c">${E(x,'pt')}</td><td class="r">${nB(x.boxes*x.qpb)}</td></tr>`).join('')}</table>`}
function expdest(vig){const c=S.cons;return `<div class="sec">EXPORTADOR</div><p>Nome: PRESTIGE AQUARIUM LTDA</p><p>Estabelecimento cadastrado junto ao OESA com o código n°: 13026030787</p><p>Estabelecimento: PRESTIGE AQUARIUM LTDA</p><p>Endereço: RUA SANTA BÁRBARA, 300 – FLORES</p><p>Local de quarentena (quando for o caso): —</p>
 <div class="sec">DESTINO DA MERCADORIA</div><p>País de destino: ${EC('country')}</p><p>Nome do importador: ${EC('nameAt')}</p><p>Estabelecimento importador: ${EC('nameAt')}</p><p>Endereço: ${EC('addrAt')}</p>${vig?'<p>Local de egresso do Brasil – UVAGRO ou SVA: SEV-GRU &nbsp; Meio de transporte: AÉREO</p>':''}`}
function atestado(k){const c=S.cons,D=DEST[S.dest],num=numStr(),head=n=>`<div class="h4" style="text-align:center;font-size:13px">${n}</div>`;
 const eu=`Eu, Jéssica Soares da Silva, CRMV AM 0894, atesto que`;
 const foot=`<div class="sec">LOCAL E DATA DE EMISSÃO:</div><p>MANAUS/AM &nbsp; ${dBR(S.date) || '__/__/____'}</p>`;
 let b='';
 if(k==='VIG'){b=head('ATESTADO VETERINÁRIO PARA EMBARQUE INTERNACIONAL')+`<p style="text-align:center">VINCULADO AO ATESTADO VETERINÁRIO Nº ${num}<br>VINCULADO À GTA Nº ${ed('ex.gta',S.ex.gta,'GTA')} Série: ${ed('ex.serie',S.ex.serie,'série')}</p>`+mercad()+expdest(true)+
  `<p style="margin-top:8px">${eu} a carga descrita atende às exigências do modelo de CZI ${esc(D.modelo)} especialmente:</p><p>Foram submetidos a uma inspeção clínica em conformidade com o artigo 166º do Regulamento Delegado (UE) 2020/692 no período de 72 horas que antecede o carregamento. Durante a inspeção, os animais aquáticos não apresentavam sintomas clínicos de doenças transmissíveis e, de acordo com os registros pertinentes do estabelecimento de aquicultura, não havia indícios de doenças.</p><p>A remessa é identificada por um rótulo legível e visível colocado no exterior do contentor, que associa claramente a remessa ao presente certificado sanitário. […]</p><p>Declaro ainda que os animais são de espécies passíveis de exploração conforme legislação ambiental.</p>`+foot}
 if(k==='EU'){b=head('ATESTADO VETERINÁRIO UNIÃO EUROPEIA')+`<p style="text-align:center">Nº ${num}</p>`+mercad()+expdest(false)+`<p style="margin-top:8px">${eu} os animais aquáticos referidos no campo MERCADORIA acima, satisfazem os seguintes requisitos sanitários:</p><p>A) São originários de um estabelecimento que não está sujeito a medidas de restrição nacionais […]</p><p>B) … C) … D) … E) … F) … G) … H) … I) … J) …</p><div class="std">texto completo A–J do seu modelo "Europa – SISA-MAO" (mantido sem alteração)</div>`+foot}
 if(k==='US'){b=head('ATESTADO VETERINÁRIO ESTADOS UNIDOS')+`<p style="text-align:center">Nº ${num}</p>`+mercad()+expdest(false)+`<p style="margin-top:8px">${eu} a carga descrita atende às exigências do modelo de CZI EXP.US.AQ.ON.MAI.11 especialmente:</p><p>1. Os animais foram examinados em até 72 horas antes do embarque e não apresentaram sinal clínico de doenças transmissíveis e estavam isentos de parasitas externos e aptos para o transporte.<br>2. Os animais foram acondicionados em embalagens novas.<br>3. Os animais originam-se de estabelecimento onde não houve registro da Doença Primaveril da Carpa (SVC).<br>4. Não são membros das seguintes famílias, gêneros e espécies susceptíveis à SVC: Cyprinus carpio, Carassius auratus, Ctenopharyngodon idellus, Hypophthalmichthys molitrix, Aristichthys nobilis, Carassius carassius, Tinca tinca, Silurus glanis</p>`+foot}
 if(k==='JP'){b=head('ATESTADO VETERINÁRIO JAPÃO')+`<p style="text-align:center">Nº ${num}</p>`+mercad()+expdest(false)+`<p style="margin-top:8px">${eu} a carga descrita atende às exigências do modelo de CZI EXP.JP.PE.ON.MAI.11 especialmente:</p><p>1. não estão ou acredita-se que não estejam infectados pelas seguintes doenças: viremia primaveril da carpa; doença por herpesvírus da carpa Koi.<br>2. foram acondicionados em embalagens e containers que não apresentam risco de propagar patógenos de doenças infecciosas de animais aquáticos.</p>`+foot}
 return `<div class="xpaper">${b}</div>`}
function czi(k){const t=T(),c=S.cons,e=S.ex,n=numStr(),num=bl(cert(k),'LPCO MAPA → nº do certificado'),sp=SI().map(x=>`<tr><td>${E(x,'sci')}</td><td>${E(x,'pt')}</td><td class="r">${nB(x.boxes*x.qpb)}</td></tr>`).join('');
 const spB=SI().map((x,i)=>`<tr><td>${E(x,'sci')}</td><td>${E(x,'pt')}</td><td class="c">${E(x,'boxes')}</td></tr>`).join('');
 if(k==='EN'||k==='DE'){const mod=k==='EN'?'CE.UE.AQ.ON.ABR.24.EN':'CE.UE.AQ.ON.ABR.24.DE';
  return `<div class="xpaper czi"><div style="display:flex;justify-content:space-between"><b>${mod}</b><span>Página 1 de 4</span></div><div style="text-align:center;font-weight:700;margin:4px 0">REPÚBLICA FEDERATIVA DO BRASIL · MINISTÉRIO DA AGRICULTURA E PECUÁRIA<br>CERTIFICADO SANITÁRIO PARA A ENTRADA NA UNIÃO DE ANIMAIS AQUÁTICOS (AQUA-ENTRY-ESTAB/RELEASE/OTHER)</div>
  <div class="gr" style="grid-template-columns:1fr 1fr"><div><span class="lb">I.1 Expeditor/Exportador</span>PRESTIGE AQUARIUM LTDA<br>RUA SANTA BARBARA, 300 – FLORES</div><div><span class="lb">I.2 Referência do certificado</span><b>N° ${num}</b></div>
  <div><span class="lb">I.5 Destinatário/Importador</span>${EC('name')}<br>${EC('addrAt')}<br>${EC('country')}</div><div><span class="lb">I.6 Operador responsável pela remessa</span>PRESTIGE AQUARIUM LTDA · BRASIL</div>
  <div><span class="lb">I.7 País de origem / I.9 País de destino</span>BRASIL (BR) → ${EC('country')}</div><div><span class="lb">I.11 Local de expedição / I.12 Local de destino</span>PRESTIGE AQUARIUM LTDA → ${EC('name')}</div>
  <div><span class="lb">I.13 Local de carregamento / I.14 Data e hora de partida</span>AEROPORTO INT DE GUARULHOS<br>${bl(depStr(),'data – hora')}</div><div><span class="lb">I.15 Meio de transporte / I.16 Posto fronteiriço</span>Avião · ${EC('border')}</div>
  <div style="grid-column:1/3"><span class="lb">I.17 Documentos de acompanhamento</span>MAWB: ${ed('ex.mawb',e.mawb,'MAWB')} &nbsp; HAWB: ${ed('ex.hawb',e.hawb,'HAWB')} &nbsp; VOO: ${ed('ex.voo',e.voo,'voo')}</div>
  <div style="grid-column:1/3"><span class="lb">I.24 Nº total de embalagens / I.25 Quantidade total / I.26 Peso</span>${t.boxes} CAIXAS &nbsp;·&nbsp; ${nB(t.fish)} PEIXES &nbsp;·&nbsp; ${nU(t.kg,2)} KG</div></div>
  <div class="h4">I.27 Descrição da remessa</div><table class="grid"><tr><th>Nome científico</th><th>Nome comum</th><th>Quantidade</th></tr>${sp}</table>
  <p>Código NC: 0301.1100 · Espécie: LIVE TROPICAL FISH · Tipo de embalagem: CAIXA DE ISOPOR · Nº de embalagens: ${t.boxes} CAIXAS</p>
  <div class="std">Páginas 3–4 (II. Informações sanitárias, texto oficial) — mantidas sem alteração do seu modelo</div></div>`}
 const jp=k==='JP';
 return `<div class="xpaper czi"><div style="display:flex;justify-content:space-between"><b>${k==='US'?'EXP.US.AQ.ON.MAI.11':'EXP.JP.PE.ON.MAI.11'}</b><span>Nº do certificado: ${num}</span></div><div style="text-align:center;font-weight:700;margin:4px 0">REPÚBLICA FEDERATIVA DO BRASIL<br>CERTIFICADO ZOOSSANITÁRIO PARA EXPORTAÇÃO DE ${jp?'PEIXES ORNAMENTAIS DO BRASIL PARA O JAPÃO':'ANIMAIS AQUÁTICOS ORNAMENTAIS DO BRASIL PARA OS ESTADOS UNIDOS DA AMÉRICA'}</div>
 <div class="sec">I - ORIGEM / DISPATCH</div><p>Exportador: PRESTIGE AQUARIUM LTDA · RUA SANTA BÁRBARA, 300 - FLORES · (92) 3654-4746</p>
 <div class="sec">II - DESTINO / DESTINATION</div><p>Importador: ${EC('name')}<br>Endereço: ${EC('addrAt')}<br>Contato: ${esc([c.phone,c.email].filter(Boolean).join(' - '))}</p>
 <div class="sec">III - TRANSPORTE</div><p>Meio de transporte: Avião · Local de embarque: AEROPORTO INTERNACIONAL DE GUARULHOS · MAWB ${ed('ex.mawb',e.mawb,'MAWB')}</p>
 <div class="sec">IV - IDENTIFICAÇÃO DA MERCADORIA</div><p>PEIXES ORNAMENTAIS VIVOS DE ÁGUA DOCE · Packing List Nº ${n}</p>
 <table class="grid"><tr><th>Nome científico</th><th>Nome comum</th><th>Nº de embalagens</th></tr>${spB}</table>
 <p><b>Observações:</b> ${SI().map(x=>nB(x.boxes*x.qpb)+' '+E(x,'sci')).join(' / ')}.</p><p>Número de embalagens: ${t.boxes} CAIXAS · Identificação: PRESTIGE AQUARIUM LTDA</p>
 <div class="std">V - Informações sanitárias (texto oficial do modelo, sem alteração)</div><p>Informações sanitárias adicionais: Atestado Sanitário Nº ${n} · Médico Veterinário: Jéssica Soares da Silva – CRMV/AM 0894</p><p>Local: São Paulo/SP – Brasil · Data: ${dExt(S.date).replace(/^(\d+) DE (\w+) DE/,(m,d,mo)=>d+' de '+mo.toLowerCase()+' de')}</p></div>`}


  /* ============================================================
     lógica da tela
     ============================================================ */
  const yr = () => S.ano || CFG.ano;
  /* números entre a primeira exportação e a última usada que não estão no histórico (ex.: a 017 pulada) */
  const semRegistro = () => {
    const ns = HIST.filter(x => String(x.ano) === String(yr())).map(x => x.n).filter(Boolean); if (!ns.length) return [];
    const ini = Math.min.apply(null, ns), out = []; for (let n = ini; n <= CFG.last; n++) if (!ns.includes(n)) out.push(n); return out;
  };
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
  /* ---- Invoice ORIGINAL × ADUANA (discount, DOA, frete pré-pago) ---- */
  const n0 = v => +v || 0;
  const freteEf = () => { const f = n0(S.ex.frete); if (f > 0) return f; const t = n0(S.ex.tarifa); return t > 0 ? Math.round(t * T().kg * 100) / 100 : 0; };
  const aduOn = () => n0(S.ex.disc) > 0 || n0(S.ex.doa) > 0 || freteEf() > 0;
  const origExtras = () => [n0(S.ex.disc) > 0 && { label: 'DISCOUNT', value: -n0(S.ex.disc) }, n0(S.ex.doa) > 0 && { label: 'DOA', value: -n0(S.ex.doa) }].filter(Boolean);
  const aduExtras = () => freteEf() > 0 ? [{ label: 'PRE-PAID FREIGHT', value: freteEf() }] : [];
  function aduCalc() {
    const L = SI(), t = T(), alvo = Math.round((t.goods - n0(S.ex.disc) - n0(S.ex.doa)) * 100) / 100, fixed = {};
    L.forEach((x, i) => { if (x.padu !== undefined && x.padu !== '' && x.padu !== null) fixed[i] = +x.padu; });
    const r = ED.aduanaPrices(L.map(x => ({ boxes: +x.boxes || 0, qpb: +x.qpb || 0, price: +x.price || 0 })), alvo, fixed);
    return { L, prices: r.prices, sum: r.sum, diff: r.diff, alvo, fixed };
  }
  const orderObj = opt => {
    const adu = opt && opt.adu, c = adu ? aduCalc() : null;
    return {
      dest: S.dest, cons: S.cons, invNum: p3(curN()), ano: yr(), dateISO: S.date,
      items: SI().map((x, i) => ({ sci: x.sci, pt: x.pt, boxes: +x.boxes || 0, qpb: +x.qpb || 0, price: adu ? c.prices[i] : +x.price || 0, kg: unit(x) })),
      extras: opt ? (adu ? aduExtras() : origExtras()) : [],
      rate: +S.conv.rate || 0, ex: S.ex
    };
  };
  const gv = p => p.split('.').reduce((o, k) => (o == null ? o : o[k]), S);
  function setP(path, v) { const ks = path.split('.'); let o = S; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = v; }

  function docList() {
    const D = DEST[S.dest], n = p3(curN()) + '.' + yr(), L = [];
    const ad = aduOn();
    L.push({ id: 'inv', name: ad ? `INVOICE_${n}_-_ORIGINAL.xlsx` : `INVOICE_${n}.xlsx`, label: ad ? 'Invoice ORIGINAL (US$)' : 'Invoice (US$)', ext: 'xlsx', build: () => ED.invoiceUsd(orderObj({ orig: 1 })) });
    if (ad) L.push({ id: 'adu', name: `INVOICE_${n}_-_ADUANA.xlsx`, label: 'Invoice ADUANA (US$)', ext: 'xlsx', build: () => ED.invoiceUsd(orderObj({ adu: 1 })) });
    if (S.conv.on) L.push({ id: 'brl', name: `INVOICE_${n}_EM_REAIS_uso_interno.xlsx`, label: 'Invoice convertida em R$ (uso interno)', ext: 'xlsx', build: () => ED.invoiceBrl(orderObj(aduOn() ? { adu: 1 } : undefined)), need: +S.conv.rate > 0 ? '' : 'informe a cotação do dólar' });
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
      let n = S.nOver || CFG.last + 1; if (HIST.some(x => x.n === n && String(x.ano) === String(yr()))) n = Math.max(CFG.last, ...HIST.map(x => x.n || 0)) + 1; S.nOver = 0;
      e = Object.assign({ id: 'x' + now.toString(36) + Math.random().toString(36).slice(2, 6), n, ano: yr() }, body);
      HIST.push(e); S.curId = e.id; S.n = n; S.ano = e.ano; CFG.last = Math.max(CFG.last, n); CFG.used = (CFG.used || []).filter(u => u.n !== n); CFG.used.push({ n, d: S.dest, dt: dBR(S.date) }); saveCfg();
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
    if (!semDataOk()) return;
    PPx.saveBlob(d.name, blobOf(await d.build(), d.ext));
  }
  const semDataOk = () => S.date || confirm('Esta exportação está sem data marcada. Os documentos vão sair com a data em branco (__/__/____) para você preencher depois. Gerar mesmo assim?');
  async function downloadAll() {
    if (!semDataOk()) return;
    const zip = new JSZip(), L = docList().filter(d => !d.need);
    for (const d of L) zip.file(d.name, await d.build());
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    if (!S.curId) saveEntry(); else saveEntry();
    PPx.saveBlob(`EXPORTACAO_${p3(curN())}.${yr()}_${S.dest}.zip`, blob);
    S.msg = `Baixei ${L.length} arquivos e salvei no histórico (exportação ${numStr()}). A próxima será ${p3(CFG.last + 1)}/${CFG.ano}.`;
    persist(); renderExp();
  }

  /* ============================================================
     telas
     ============================================================ */
  const fld = (l, path, type = 'text', extra = '', cls = '') => `<div class="field ${cls}"><label>${l}</label><input type="${type}" data-xp="${path}" value="${esc(gv(path))}" ${extra}></div>`;
  const dname = d => d === 'inv' ? 'Invoice (US$)' : d === 'adu' ? 'Invoice ADUANA' : d === 'brl' ? 'Invoice em R$' : d === 'pl' ? 'Packing List' : d === 'et' ? 'Etiquetas' : d.startsWith('at:') ? ATN[d.slice(3)] : CZN[d.slice(3)].split(' (')[0];

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
    if (S.tab === 'inv' && (S.conv.on || aduOn())) { const ad = aduOn(), v = S.invView === 'adu' && !ad ? 'usd' : S.invView; sub = `<div class="tabs sub"><button type="button" data-xiv="usd" aria-selected="${v === 'usd'}">${ad ? 'Invoice ORIGINAL (US$)' : 'Invoice US$ (vai ao cliente)'}</button>${ad ? `<button type="button" data-xiv="adu" aria-selected="${v === 'adu'}">Invoice ADUANA (US$)</button>` : ''}${S.conv.on ? `<button type="button" data-xiv="brl" aria-selected="${v === 'brl'}">Convertida em R$ (para a NF)</button>` : ''}</div>`; }
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
    <section class="step"><div class="row between" style="align-items:center"><h2>Destino e numeração</h2><div class="row"><button type="button" class="primary" data-xa="prev">Ver prévia dos documentos</button><button type="button" data-xa="novo">Nova exportação</button></div></div>
      <div class="row" style="align-items:flex-end">
        <div class="field grow"><label>Destino</label><div class="chips">${Object.entries(DEST).map(([k, v]) => `<button type="button" class="xchip" data-xdest="${k}" aria-pressed="${S.dest === k}">${v.label}</button>`).join('')}</div></div>
        <div class="field" style="flex:0 0 190px"><label>Nº desta exportação</label><div class="xbig">${numStr()}</div><label class="note" style="display:flex;gap:6px;align-items:center;margin-top:4px">Trocar nº: <input type="number" min="1" id="xNumEd" value="${curN()}" style="width:84px" aria-label="Número da exportação"></label>${semRegistro().length ? `<div class="note" style="margin-top:4px">Sem registro no histórico: ${semRegistro().map(n => `<button type="button" class="xchip" data-xa="usarnum" data-n="${n}">${p3(n)}</button>`).join(' ')}</div>` : ''}</div>
        <div class="field" style="flex:0 0 210px"><label>Data</label><input type="date" data-xp="date" value="${esc(S.date || '')}" ${S.date ? '' : 'disabled'}><label style="display:flex;gap:6px;align-items:center;color:var(--fg);margin-top:6px;font-size:.85rem"><input type="checkbox" id="xNoDate" ${S.date ? '' : 'checked'}> Sem data marcada ainda (inserir depois)</label></div>
      </div>
      <p class="note">Escolhendo o destino, o consignee, os atestados e os CZIs mudam sozinhos. O mesmo nº vale para invoice, packing list, atestados e CZI. As exportações já feitas ficam no <b>Histórico</b>.${S.curId ? ' <b>Esta exportação já está salva no histórico.</b>' : ''}</p>
      <details class="xdet" id="xNum" ${S.numOpen ? 'open' : ''}><summary>Numeração das exportações <span class="muted">· última usada ${p3(CFG.last)}/${CFG.ano} — próxima ${p3(CFG.last + 1)}/${CFG.ano}</span></summary>
        <div class="row" style="margin-top:8px"><div class="field" style="flex:0 1 190px"><label for="xLast">Última invoice usada (nº)</label><input type="number" min="0" id="xLast" value="${CFG.last}"></div><div class="field" style="flex:0 1 120px"><label for="xAno">Ano</label><input type="number" id="xAno" value="${CFG.ano}"></div>
        <div class="field grow"><label>Já usados</label><span class="note">${(CFG.used || []).slice().sort((a, b) => b.n - a.n).map(u => `${p3(u.n)} (${esc((DEST[u.d] || {}).label || u.d)} · ${esc(u.dt)})`).join(' · ') || '—'}</span></div></div>
        <p class="note">Ajuste a "última usada" quando quiser (hoje está em ${p3(CFG.last)}, a próxima é ${p3(CFG.last + 1)}). Para usar um número específico (por exemplo, um que foi pulado), troque o "Nº desta exportação" lá em cima ou clique no número em "Sem registro no histórico". Ao baixar o .zip ou salvar, o app avança sozinho. Vale só para exportações.</p></details></section>
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
      <div id="xMapaPanel"></div>
      <details class="step xdet" id="xCons" ${S.consOpen ? 'open' : ''}><summary>Consignee: <b>${esc(S.cons.name)}</b> <span class="muted">· ${esc(S.cons.addrAt)} — clique para editar</span></summary>
        <div class="row">${fld('Nome (invoice, packing, etiquetas, CZI)', 'cons.name', 'text', '', 'grow')}${fld('Nome nos atestados', 'cons.nameAt')}</div>
        <div class="row">${fld('Endereço – linha 1 (invoice/packing)', 'cons.addr')}${fld('Linha 2 (cidade / país)', 'cons.addr2')}</div>
        <div class="row">${fld('Endereço em uma linha (atestados e CZI)', 'cons.addrAt', 'text', '', 'grow')}${fld('País (atestado)', 'cons.country')}</div>
        <div class="row">${fld('Telefone', 'cons.phone')}${fld('E-mail', 'cons.email')}${S.dest !== 'MIA' ? fld('Posto fronteiriço (CZI)', 'cons.border') : ''}</div>
        <div class="row">${fld('Etiqueta – endereço', 'cons.lab1', 'text', '', 'grow')}${fld('Etiqueta – cidade / país', 'cons.lab2', 'text', '', 'grow')}</div>
        <p class="note">Mudou o endereço do cliente? Edite aqui: fica salvo para as próximas exportações deste destino.</p></details>
    </div><div class="xleft">
      <section class="step"><h2>Dados da exportação</h2>
        <details class="frmail" id="xMailBox" ${XM.open ? 'open' : ''}><summary>Colar o e-mail do despachante (preenche MAWB, HAWB, LPCOs, DU-E e voo)</summary>
          <p class="note">Copie o texto do e-mail em que o despachante manda os documentos (INV, MAWB, LPCO IBAMA, LPCO MAPA, DU-E, voos) e cole aqui. Também funciona com Ctrl+V direto nesta tela, fora de qualquer campo.</p>
          <textarea id="xMailIn" rows="6" placeholder="INV.: 016/2026&#10;MAWB: 074-70222390&#10;HAWB: DM-00058834&#10;LPCO IBAMA: E2600604683&#10;LPCO MAPA: E2600665213&#10;DU-E: 26BR001971465-1">${esc(XM.txt)}</textarea>
          <div class="row"><button type="button" class="primary" data-xa="mailin">Ler e-mail e preencher</button></div>${XM.msg ? `<div class="warnbox" style="white-space:pre-line;margin-top:8px">${esc(XM.msg)}</div>` : ''}</details>
        <div class="row">${fld('Nota Fiscal nº', 'ex.nf', 'text', 'placeholder="00008941/8942 S-2"')}${fld('Aeroporto de saída', 'ex.aero')}${fld('DU-E', 'ex.dued', 'text', 'placeholder="26BR001971465-1"')}</div>
        <div class="row">${fld('MAWB', 'ex.mawb', 'text', 'placeholder="074-70222390"')}${fld('HAWB', 'ex.hawb')}${fld('AWB', 'ex.awb')}</div>
        <div class="row">${fld('Voo internacional (nº)', 'ex.voo', 'text', 'placeholder="KL0792"')}${fld('Partida (data/hora)', 'ex.dep', 'datetime-local')}</div>
        <div class="row">${fld('Entrega da carga ao despachante', 'ex.entrega', 'text', 'placeholder="07/11/2026 às 11:00"')}${fld('Voos domésticos (até o aeroporto de saída)', 'ex.dom', 'text', 'placeholder="G31545 01:35-06:30"', 'grow')}</div>
        <div class="row">${fld('GTA nº', 'ex.gta')}${fld('Série da GTA', 'ex.serie')}${fld('Package fee (US$/caixa)', 'ex.fee', 'number', 'step="0.5" min="0"')}</div>
        <h2>Discount, DOA e frete (só se houver nesta exportação)</h2>
        <div class="row">${fld('Discount (US$)', 'ex.disc', 'number', 'step="0.01" min="0" placeholder="0"')}${fld('DOA – mortalidade da exportação anterior (US$)', 'ex.doa', 'number', 'step="0.01" min="0" placeholder="0"')}${fld('Frete pré-pago (US$) – valor da cotação do despachante', 'ex.frete', 'number', 'step="0.01" min="0" placeholder="0"')}${fld('…ou tarifa por kg (US$, só se não tiver o valor)', 'ex.tarifa', 'number', 'step="0.01" min="0" placeholder="0"')}</div>
        <p class="note" id="xAduNote">${aduNote()}</p>
        <div class="row">${fld('Data de embalagem', 'ex.pkDate', 'date')}${fld('Hora de embalagem', 'ex.pkTime')}${fld('Oxigênio', 'ex.oxy')}${fld('Temperatura', 'ex.temp')}</div>
        <h2>LPCO (recebidos por você)</h2>
        <div class="row">${fld('LPCO MAPA → vai no CZI', 'ex.lpcoMapa', 'text', 'placeholder="E2600665213"')}${fld('LPCO IBAMA → vai nas etiquetas', 'ex.lpcoIbama', 'text', 'placeholder="E2600604683"')}</div>
        <p class="note" id="xCert">${certNote()}</p></section>
      <section class="step"><h2>Conversão para real (para a Nota Fiscal)</h2>
        <label style="display:flex;gap:8px;align-items:center;color:var(--fg);font-size:.9rem"><input type="checkbox" data-xp="conv.on" ${S.conv.on ? 'checked' : ''}> Gerar também a invoice convertida em R$ (uso interno, não vai ao cliente)</label>
        ${S.conv.on ? `<div class="row">${fld('Data da cotação', 'conv.date', 'date')}${fld('Dólar PTAX compra (R$)', 'conv.rate', 'number', 'step="0.0001" min="0"')}<div class="field" style="flex:0 0 auto;justify-content:flex-end"><button type="button" data-xa="ptax">⟳ Buscar PTAX do dia (Banco Central)</button></div></div><p class="note" id="xPtmsg" role="status">${esc(S.conv.msg || 'Sem internet ou em fim de semana/feriado, o app usa o último dia útil; você também pode digitar a cotação.')}</p>` : ''}</section>
      <section class="step"><h2>Documentos desta exportação</h2>
        <div class="warnbox" id="xWarn">${warnHTML()}</div><div id="xDocs">${docsCard()}</div>
        <div class="row"><button type="button" class="primary" data-xa="zip">⬇ Baixar todos (.zip) e salvar</button><button type="button" data-xa="prev">Ver prévia</button><button type="button" data-xa="save">Salvar no histórico</button><button type="button" data-xa="rot">✓ Abrir roteiro</button></div></section>
    </div></div>`;
    if (keep) { try { const sel = keep.includes(':') ? `[data-xi="${keep.split(':')[0]}"][data-xk="${keep.split(':')[1]}"]` : `[data-xp="${keep}"]`, n = el.querySelector(sel); if (n) { n.focus(); if (n.setSelectionRange && /text|search/.test(n.type || '')) n.setSelectionRange(n.value.length, n.value.length); } } catch (_) { /* ok */ } }
    if (PPx.mapa && $('xMapaPanel')) PPx.mapa.mountPanel($('xMapaPanel'));
    persist();
  }
  function certNote() {
    const D = DEST[S.dest], c = k => { const m = S.ex.lpcoMapa; if (!m) return '(LPCO MAPA em branco)'; const suf = S.dest === 'JPN' ? (k === 'JP' ? '-1' : k === 'DE' ? '-2' : '') : ''; return m.replace(/\/SEV-GRU$/i, '') + suf + '/SEV-GRU'; };
    return `Nº do certificado no CZI: <b>${D.czi.map(k => esc(c(k))).join('  ·  ')}</b> (o app acrescenta "/SEV-GRU"${S.dest === 'JPN' ? '; no Japão, -1 no CZI do Japão e -2 no da Alemanha' : ''}).`;
  }
  function bigMail(mk) {
    const src = $('xMail_' + mk); if (!src) return;
    const old = document.getElementById('xMailBig'); if (old) old.remove();
    const o = document.createElement('div'); o.id = 'xMailBig'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
    o.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(5,10,12,.92);display:flex;flex-direction:column;padding:22px;gap:12px';
    o.innerHTML = '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b style="font-size:17px;flex:1">Texto do e-mail (pode editar antes de copiar)</b><button type="button" id="xMbCopy" class="primary">Copiar texto</button><button type="button" id="xMbClose">Fechar</button></div><textarea id="xMbTa" spellcheck="false" style="flex:1;width:100%;font-size:16px;line-height:1.5;resize:none"></textarea>';
    document.body.appendChild(o);
    const ta = o.querySelector('#xMbTa'); ta.value = src.value; ta.focus();
    const sync = () => { src.value = ta.value; };
    ta.addEventListener('input', sync);
    const close = () => { sync(); o.remove(); document.removeEventListener('keydown', esc); };
    const esc = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    o.querySelector('#xMbClose').onclick = close;
    o.querySelector('#xMbCopy').onclick = async e => { ta.select(); try { await navigator.clipboard.writeText(ta.value); } catch (_) { document.execCommand('copy'); } e.target.textContent = '✓ Copiado'; };
  }
  function aduNote() {
    if (!aduOn()) return 'Deixe em branco quando não houver. Preenchendo qualquer um deles, o app passa a gerar duas invoices: a <b>ORIGINAL</b> (com Discount e DOA) e a <b>ADUANA</b> (com o Pre-paid freight e os preços recalculados sozinho para fechar o mesmo valor).';
    const t = T(), c = aduCalc(), fr = freteEf(), liq = t.total - n0(S.ex.disc) - n0(S.ex.doa), ok = Math.abs(c.diff) < 0.005;
    const frTxt = n0(S.ex.frete) > 0 ? '' : ` (${nB(t.kg)} kg × US$ ${nU(n0(S.ex.tarifa), 2)})`;
    return `<b>Original:</b> peixes ${nU(t.goods, 2)} + package fee ${nU(t.fee, 2)}${n0(S.ex.disc) ? ' − discount ' + nU(S.ex.disc, 2) : ''}${n0(S.ex.doa) ? ' − DOA ' + nU(S.ex.doa, 2) : ''} = <b>US$ ${nU(liq, 2)}</b>.<br><b>Aduana:</b> peixes ${nU(c.sum, 2)} + package fee ${nU(t.fee, 2)} = US$ ${nU(c.sum + t.fee, 2)} ${ok ? '✓ igual ao líquido da original' : '⚠ diferente do líquido da original'}${fr ? ` + frete ${nU(fr, 2)}${frTxt} = <b>US$ ${nU(c.sum + t.fee + fr, 2)}</b>` : ''}.`;
  }
  // atualiza só o que depende dos valores digitados, sem recriar os campos (o foco não se perde)
  function liveForm() {
    const g = id => $(id); if (g('xTot')) g('xTot').innerHTML = totalsLine(); if (g('xWarn')) g('xWarn').innerHTML = warnHTML(); if (g('xDocs')) g('xDocs').innerHTML = docsCard(); if (g('xCert')) g('xCert').innerHTML = certNote(); if (g('xAduNote')) g('xAduNote').innerHTML = aduNote(); if (g('xMapaPanel') && PPx.mapa) PPx.mapa.mountPanel(g('xMapaPanel'));
    persist();
  }
  function live() { liveForm(); if (prevOpen()) refreshStage(); }
  /* e-mail do despachante (exportação): preenche os campos e conta o que mudou */
  const XM = { open: false, txt: '', msg: '' };
  function importMailExp(text) {
    const FCx = window.FreteCore || (PPx.frete && PPx.frete.FC), o = FCx ? FCx.parseExpMail(text) : { ok: false }, out = [];
    XM.txt = text; XM.open = true;
    if (!o.ok) { XM.msg = 'Não achei MAWB, LPCO nem DU-E neste texto. Copie o corpo do e-mail do despachante (onde aparece "MAWB:", "LPCO IBAMA:", "DU-E:").'; renderExp(); return; }
    const put = (rot, campo, v) => { if (!v) return; const a = String(S.ex[campo] || ''); if (a === v) { out.push(`= ${rot}: ${v} (já estava)`); return; } S.ex[campo] = v; out.push(`✓ ${rot}: ${v}${a ? ' (antes: ' + a + ')' : ''}`); };
    put('MAWB', 'mawb', o.mawb); put('HAWB', 'hawb', o.hawb); put('LPCO IBAMA', 'lpcoIbama', o.lpcoIbama); put('LPCO MAPA', 'lpcoMapa', o.lpcoMapa); put('DU-E', 'dued', o.due);
    put('Entrega da carga', 'entrega', o.entrega);
    if (o.dom.length) put('Voos domésticos', 'dom', o.dom.map(d => `${d.voo} ${d.sai}-${d.chega}`).join(' · '));
    if (o.intl) { put('Voo internacional', 'voo', o.intl.voo); out.push(`! Voo ${o.intl.voo} (${o.intl.de}/${o.intl.para}) em ${o.intl.data}: o e-mail não traz a hora, confira o campo "Partida".`); if (!S.ex.dep) { const [d, mo, y] = o.intl.data.split('/'); out.push(`  (data do voo: ${d}/${mo}/${y})`); } }
    else out.push('! Não achei o voo internacional em texto (às vezes vem como imagem no e-mail): digite o voo e a partida.');
    if (o.exigIbama) out.push('! LPCO IBAMA está "em resposta de exigência".'); if (o.exigMapa) out.push('! LPCO MAPA está "em resposta de exigência".');
    if (o.inv && (o.inv.n !== curN() || String(o.inv.ano) !== String(yr()))) out.push(`ATENÇÃO: o e-mail é da invoice ${p3(o.inv.n)}/${o.inv.ano}, mas a exportação aberta é a ${numStr()}. Confira se colou no lugar certo.`);
    XM.msg = out.join('\n'); persist(); renderExp();
  }
  document.addEventListener('paste', ev => {
    const el = $('vExp'); if (!el || el.hidden || !PPx.S || PPx.S.view !== 'exp') return; const t = ev.target; if (t && t.closest && t.closest('input,textarea,[contenteditable="true"]')) return;
    if (!$('xMailBox')) return; const txt = (ev.clipboardData && ev.clipboardData.getData('text/plain')) || '';
    if (/MAWB|LPCO|DU-?E\s*:/i.test(txt) && /\d{3}-?\d{8}|E\d{8,}|\d{2}BR\d{9}/.test(txt)) { ev.preventDefault(); importMailExp(txt); }
  });
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
      { t: 'Anexar no MAPA', id: 'g2', it: [['m_req', 'REQUERIMENTO PREENCHIDO E ASSINADO'], ['m_pl', 'PACKING LIST ASSINADO'], ['m_at', 'ATESTADOS SISA E VIGIAGRO ASSINADOS NO DIA'], ['m_ent', 'NOTAS DE ENTRADA (PDF ÚNICO, COM AS ESPÉCIES GRIFADAS)'], ['m_czi', 'CZI']].map(([k, l]) => (k === 'm_ent' ? { k, l, pdf: true } : { k, l })) },
      { t: 'Imprimir', id: 'g3', it: [['p_nf', 'NOTA FISCAL'], ['p_pl', 'PACKING LIST'], ['p_gta', 'GTA'], ['p_vig', 'ATESTADO VIGIAGRO'], ['p_laudo', 'LAUDOS DAS CAIXAS']].map(([k, l]) => ({ k, l })) },
      { t: 'Despachante', id: 'g4', it: [
        { k: 'desp', l: '1) PEDIR A LPCO: ENVIAR AO DESPACHANTE', mail: 'lpco', note: 'NF em R$, invoice e packing assinados, notas de entrada, CTF e RGP do pescador' },
        { k: 'desp2', l: '2) DOCUMENTOS DO DIA AO DESPACHANTE', mail: 'dia', note: 'depois que ele mandar voo, AWB, LPCO IBAMA e LPCO MAPA' }] }];
  }
  function mailText(kind) {
    const D = DEST[S.dest], t = T(), cab = `${numStr()} (${S.cons.name}, ${D.label})`, tot = `Caixas: ${t.boxes} · Peso: ${nB(t.kg)} kg · Peixes: ${nB(t.fish)}`;
    if (kind === 'dia') return `Assunto: Exportação ${numStr()} – ${D.label} – documentos do dia\n\nBom dia,\n\nSegue em anexo os documentos da exportação ${cab}, já com os dados do voo, AWB e LPCOs:\n• Atestados SISA e Vigiagro (assinados)\n• CZI\n• Etiquetas\n• GTA\n\nVoo: ${S.ex.voo || '—'} · AWB: ${S.ex.awb || '—'} · MAWB: ${S.ex.mawb || '—'}\nLPCO IBAMA: ${S.ex.lpcoIbama || '—'} · LPCO MAPA: ${S.ex.lpcoMapa || '—'}\n${tot}\n\nAtenciosamente,\nPrestige Aquarium`;
    return `Assunto: Exportação ${numStr()} – ${D.label} – documentos para a LPCO\n\nBom dia,\n\nSegue em anexo a documentação da exportação ${cab} para a emissão da LPCO e andamento do processo:\n• Nota Fiscal\n• Invoice (assinada)\n• Packing List (assinado)\n• Notas de entrada\n• CTF do pescador\n• RGP do pescador\n\n${tot}\n\nFico no aguardo da confirmação do IBAMA e do voo, com AWB e as LPCOs.\n\nAtenciosamente,\nPrestige Aquarium`;
  }
  function rvRow(it) {
    const st = stOf(it.k); let hint = '';
    const need = (it.need || []).concat(it.need2 || []).filter(([, p]) => !gv(p));
    if (need.length && (it.app || it.need2)) hint = `<div class="miss">faltam dados no pedido: ${need.map(x => esc(x[0])).join(', ')}</div>`;
    const mk = it.mail === true ? 'lpco' : it.mail, mail = mk ? `<details style="margin-top:6px"><summary class="muted" style="cursor:pointer">Texto de e-mail pronto (copiar e colar)</summary><textarea id="xMail_${mk}" style="min-height:190px;margin-top:6px">${esc(mailText(mk))}</textarea><button type="button" data-xa="copymail" data-xk="${mk}" style="margin-top:6px">Copiar texto</button> <button type="button" data-xa="bigmail" data-xk="${mk}" style="margin-top:6px">⤢ Abrir em tela cheia</button></details>` : '';
    const pdfb = it.pdf ? `<div style="margin-top:6px"><button type="button" data-xa="pdfnfs">Gerar o PDF das notas de entrada</button></div>` : '';
    const hasN = !!((S.rot.nt || {})[it.k]), open = hasN || (S.rot.no && S.rot.no[it.k]);
    return `<div class="rv s-${st}" id="rv_${it.k}"><div class="rvl"><div class="nm">${esc(it.l)}</div>${it.note ? `<div class="sm">${esc(it.note)}</div>` : ''}${it.calc ? `<div class="sm" style="color:var(--accent)">${esc(it.calc)}</div>` : ''}${hint}${pdfb}${mail}</div>
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
      ${c.o === n ? '<div class="okbox"><b>Tudo conferido.</b> Pode embarcar.</div>' : `<div><div class="muted" style="margin-bottom:4px">O que ainda acusa (clique para ir até o item):</div><div class="chips">${sh.map(i => `<button type="button" class="xchip ${stOf(i.k) === 'r' ? 'rf' : 'pd'}" data-xjump="${i.k}">${stOf(i.k) === 'r' ? '↻' : '✗'} ${esc(i.l.length > 30 ? i.l.slice(0, 28) + '…' : i.l)}</button>`).join('')}${L.length > 8 ? `<span class="muted" style="align-self:center">+ ${L.length - 8} itens abaixo</span>` : ''}</div></div>`}
      <div class="row noprint"><label style="display:flex;gap:6px;align-items:center;color:var(--fg)"><input type="checkbox" id="xRotOnly" ${S.rot.only ? 'checked' : ''}> Mostrar só o que falta</label><button type="button" data-xa="rotprint">Imprimir roteiro</button><button type="button" data-xa="rotclear">Zerar roteiro</button><button type="button" data-xa="save">Salvar roteiro no histórico</button></div></section>
      <div class="rvgrid">${[[G[0]], [G[1], G[2], G[3]]].map(col => `<div class="rvcol">${col.map(g => { const its = S.rot.only ? g.it.filter(i => stOf(i.k) !== 'o') : g.it, ok = g.it.filter(i => stOf(i.k) === 'o').length; return `<section class="step"><h2>${g.t} — ${ok}/${g.it.length}</h2>${its.map(rvRow).join('') || '<p class="note">Tudo OK aqui ✓</p>'}</section>`; }).join('')}</div>`).join('')}</div>`;
  }

  /* ---------- exportações no Histórico ---------- */

  /* ---------- registro rápido: incluir no histórico uma exportação que ficou de fora ---------- */
  const QA = { open: false, n: '', ano: '', date: '', dest: 'MIA', cli: '', fee: 12, rate: '', msg: '', items: [{ sci: '', boxes: '', qpb: '', price: '' }] };
  const qaRender = () => { if (window.PP.extra) window.PP.extra.render('hist'); };
  function qaReset() { Object.assign(QA, { n: '', ano: CFG.ano, date: todayISO(), dest: 'MIA', cli: consOf('MIA').name, fee: 12, rate: '', msg: '', items: [{ sci: '', boxes: '', qpb: '', price: '' }] }); }
  function qaHTML() {
    const tot = qaTot();
    const rows = QA.items.map((x, i) => `<div class="qrow"><input class="qsp" data-qa="it.${i}.sci" list="xqSp" value="${esc(x.sci)}" placeholder="Espécie (nome científico)" aria-label="Espécie"><label>Caixas<input data-qa="it.${i}.boxes" type="number" min="0" step="1" inputmode="numeric" value="${esc(x.boxes)}"></label><label>Peixes/caixa<input data-qa="it.${i}.qpb" type="number" min="0" step="1" inputmode="numeric" value="${esc(x.qpb)}"></label><label>US$/peixe<input data-qa="it.${i}.price" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(x.price)}"></label><span class="qtot">US$ ${nU((+x.boxes || 0) * (+x.qpb || 0) * (+x.price || 0), 2)}</span><button type="button" class="danger" data-xq="del" data-i="${i}" aria-label="Remover">✕</button></div>`).join('');
    const sp = (PPx.S.catalog || []).map(c => `<option value="${esc(c.sci)}">${esc(c.comum || '')}</option>`).join('');
    return `<div class="block" id="xqa" style="margin:8px 0 12px"><p class="note">Use quando uma exportação ficou de fora (ou ainda vai sair). Ela entra no histórico e no relatório de vendas, mas <b>não gera documentos</b>.</p>
    <div class="row" style="margin-bottom:8px"><button type="button" data-xq="file">Importar invoice (Excel ou PDF)</button><input id="xqFile" type="file" accept=".xlsx,.pdf" style="display:none"><span class="muted">O app lê número, data, cliente, espécies, caixas e valores.</span></div>
    <div class="row" style="flex-wrap:wrap;gap:8px">
     <div class="field" style="flex:0 1 90px"><label>Nº</label><input data-qa="n" type="number" min="1" inputmode="numeric" value="${esc(QA.n)}"></div>
     <div class="field" style="flex:0 1 90px"><label>Ano</label><input data-qa="ano" type="number" value="${esc(QA.ano)}"></div>
     <div class="field" style="flex:0 1 160px"><label>Data (saída)</label><input data-qa="date" type="date" value="${esc(QA.date)}"></div>
     <div class="field" style="flex:0 1 150px"><label>Destino</label><select data-qa="dest">${Object.keys(DEST).map(k => `<option value="${k}" ${QA.dest === k ? 'selected' : ''}>${esc(DEST[k].label)}</option>`).join('')}</select></div>
     <div class="field" style="flex:1 1 220px"><label>Cliente</label><input data-qa="cli" value="${esc(QA.cli)}"></div>
     <div class="field" style="flex:0 1 110px"><label>Taxa/caixa US$</label><input data-qa="fee" type="number" step="0.01" inputmode="decimal" value="${esc(QA.fee)}"></div>
     <div class="field" style="flex:0 1 120px"><label>Dólar (R$) <small>opcional</small></label><input data-qa="rate" type="number" step="0.0001" inputmode="decimal" value="${esc(QA.rate)}"></div></div>
    <div class="qrows">${rows}</div><datalist id="xqSp">${sp}</datalist>
    <div class="row between" style="margin-top:8px"><button type="button" data-xq="add">＋ Espécie</button><span class="muted">${tot.boxes} caixa(s) · ${nU(tot.fish)} peixes · <b>US$ ${nU(tot.total, 2)}</b></span></div>
    ${QA.msg ? `<p class="note" style="color:var(--warn,#e9b44c)">${esc(QA.msg)}</p>` : ''}
    <div class="row" style="margin-top:8px"><button type="button" class="primary" data-xq="save">Salvar no histórico</button><button type="button" data-xq="toggle">Cancelar</button></div></div>`;
  }
  function qaTot() { const L = QA.items.filter(x => +x.boxes > 0); const boxes = L.reduce((a, x) => a + +x.boxes, 0), fish = L.reduce((a, x) => a + x.boxes * (+x.qpb || 0), 0), goods = L.reduce((a, x) => a + x.boxes * (+x.qpb || 0) * (+x.price || 0), 0), fee = boxes * (+QA.fee || 0); return { boxes, fish, goods, fee, total: goods + fee }; }
  function qaSave() {
    const n = parseInt(QA.n, 10), ano = parseInt(QA.ano, 10) || CFG.ano;
    if (!(n > 0)) { QA.msg = 'Digite o número da exportação.'; return qaRender(); }
    if (HIST.some(e => e.n === n && (e.ano || CFG.ano) === ano)) { QA.msg = `A exportação ${p3(n)}/${ano} já está no histórico.`; return qaRender(); }
    if (!QA.date) { QA.msg = 'Escolha a data.'; return qaRender(); }
    const items = QA.items.filter(x => +x.boxes > 0).map(x => ({ sci: String(x.sci || '').trim(), pt: ptOf(x.sci) || '', boxes: +x.boxes, qpb: +x.qpb || 0, price: +x.price || 0, kg: '' }));
    if (!items.length) { QA.msg = 'Coloque pelo menos uma espécie com caixas.'; return qaRender(); }
    if (items.some(x => !x.sci || !x.qpb)) { QA.msg = 'Preencha o nome da espécie e quantos peixes por caixa em cada linha.'; return qaRender(); }
    const t = qaTot(), now = Date.now();
    const cons = Object.assign({}, DEST[QA.dest].cons, CFG.cons[QA.dest] || {}, { name: QA.cli || consOf(QA.dest).name });
    const ex = Object.assign(newEx(), { fee: +QA.fee || 0, pkDate: QA.date });
    const e = { id: 'x' + now.toString(36) + Math.random().toString(36).slice(2, 6), n, ano, dest: QA.dest, dateISO: QA.date, cons, items, ordem: 'auto', ex, conv: { on: !!+QA.rate, rate: +QA.rate || '', date: QA.date, msg: '' }, rot: newRot(), tot: { boxes: t.boxes, fish: t.fish, goods: t.goods, fee: t.fee, total: t.total }, ts: now, rapido: true };
    HIST.push(e); saveHist();
    if (n > CFG.last) CFG.last = n;
    CFG.used = (CFG.used || []).filter(u => u.n !== n); CFG.used.push({ n, d: QA.dest, dt: dBR(QA.date) }); saveCfg();
    qaReset(); QA.open = false; QA.msg = ''; qaRender();
    const m = document.createElement('div'); m.className = 'note'; m.textContent = `Exportação ${p3(n)}/${ano} salva no histórico.`; const h = $('xHist'); if (h) h.insertBefore(m, h.children[1]);
  }
  const qaOnInput = e => {
    const t = e.target, k = t.dataset && t.dataset.qa; if (!k || !$('xqa') || !$('xqa').contains(t)) return;
    const m = k.match(/^it\.(\d+)\.(\w+)$/);
    if (m) QA.items[+m[1]][m[2]] = t.value; else QA[k] = t.value;
    if (k === 'dest' && e.type === 'change') { QA.cli = consOf(QA.dest).name; qaRender(); return; }
    if (e.type === 'input' && /^it\.\d+\.(boxes|qpb|price)$/.test(k) || k === 'fee') { const x = $('xqa'); const sp = x.querySelector('.row.between .muted'); const tt = qaTot(); if (sp) sp.innerHTML = `${tt.boxes} caixa(s) · ${nU(tt.fish)} peixes · <b>US$ ${nU(tt.total, 2)}</b>`; if (m) { const tr = t.closest('.qrow'), it = QA.items[+m[1]]; if (tr) tr.querySelector('.qtot').textContent = 'US$ ' + nU((+it.boxes || 0) * (+it.qpb || 0) * (+it.price || 0), 2); } }
  };
  document.addEventListener('input', qaOnInput); document.addEventListener('change', qaOnInput);
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-xq]'); if (!b || !$('vHist') || !$('vHist').contains(b)) return;
    const a = b.dataset.xq;
    if (a === 'toggle') { QA.open = !QA.open; if (QA.open) qaReset(); qaRender(); }
    else if (a === 'add') { QA.items.push({ sci: '', boxes: '', qpb: '', price: '' }); qaRender(); }
    else if (a === 'del') { QA.items.splice(+b.dataset.i, 1); if (!QA.items.length) QA.items.push({ sci: '', boxes: '', qpb: '', price: '' }); qaRender(); }
    else if (a === 'save') qaSave();
    else if (a === 'file') { const f = $('xqFile'); if (f) f.click(); }
  });


  /* ---------- importar invoice (.xlsx ou .pdf) para o registro rápido ---------- */
  const numIn = v => { if (v == null) return NaN; if (typeof v === 'number') return v; if (typeof v === 'object') return numIn(v.result != null ? v.result : v.text); const t = String(v).replace(/[^\d.,-]/g, ''); if (!t) return NaN; return /,\d{1,2}$/.test(t) && !/\.\d{3}/.test(t) ? parseFloat(t.replace(/\./g, '').replace(',', '.')) : parseFloat(t.replace(/,/g, '')); };
  const txtIn = v => { if (v == null) return ''; if (v instanceof Date) return ''; if (typeof v === 'object') return txtIn(v.result != null ? v.result : v.text != null ? v.text : (v.richText ? v.richText.map(r => r.text).join('') : '')); return String(v).trim(); };
  const isoDate = v => { if (v instanceof Date) return v.getUTCFullYear() + '-' + String(v.getUTCMonth() + 1).padStart(2, '0') + '-' + String(v.getUTCDate()).padStart(2, '0'); const m = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(String(v || '')); if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); const m2 = /(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); if (m2) return m2[0]; const MN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'fev', 'abr', 'mai', 'ago', 'set', 'out', 'dez']; const m3 = /(\d{1,2})[/ .-]([A-Za-z]{3})[a-z]*[/ .-](\d{4})/.exec(String(v || '')); if (m3) { const i = MN.indexOf(m3[2].toLowerCase()); if (i >= 0) { const mm = { 12: 2, 13: 4, 14: 5, 15: 8, 16: 9, 17: 10, 18: 12 }[i] || i + 1; return m3[3] + '-' + String(mm).padStart(2, '0') + '-' + m3[1].padStart(2, '0'); } } return ''; };
  function guessDest(name, blob) { const t = normT(name + ' ' + blob); for (const k of Object.keys(DEST)) { const c = consOf(k); if (normT(c.name) && normT(name) && normT(c.name) === normT(name)) return k; } if (/japan|japao|tokyo|narita|chiba/.test(t)) return 'JPN'; if (/\busa\b|florida|united states|estados unidos|miami|homestead/.test(t)) return 'MIA'; return ''; }
  async function parseInvoiceXlsx(buf) {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); const out = { items: [] };
    for (const ws of wb.worksheets) {
      if (ws.state && ws.state !== 'visible') continue;
      const rows = []; ws.eachRow({ includeEmpty: false }, (row, rn) => { const cells = {}; row.eachCell({ includeEmpty: false }, (c, cn) => { cells[cn] = c.value; }); rows.push({ rn, cells }); });
      let H = null;
      for (const r of rows) { const tx = Object.entries(r.cells).map(([c, v]) => [+c, normT(txtIn(v))]); if (tx.some(x => /boxes|caixas/.test(x[1])) && tx.some(x => /scientific|species|especie/.test(x[1]))) { H = { r, col: {} }; tx.forEach(([c, t]) => { if (/boxes|caixas/.test(t) && !H.col.boxes) H.col.boxes = c; else if (/qty|qtd|peixes por|per box/.test(t) && !H.col.qpb) H.col.qpb = c; else if (/scientific|species|especie/.test(t) && !H.col.sci) H.col.sci = c; else if (/common|comum/.test(t) && !H.col.pt) H.col.pt = c; else if (/unit|price|prince|preco/.test(t) && !/total/.test(t) && !H.col.price) H.col.price = c; }); break; } }
      if (!H || !H.col.sci || !H.col.boxes) continue;
      const c = H.col, items = []; let fee = null;
      for (const r of rows) {
        if (r.rn <= H.r.rn) { const t = Object.values(r.cells).map(txtIn).join(' '); if (/invoice/i.test(t) && !out.inv) { const m = /(\d{1,4})\s*\/\s*(\d{4})/.exec(t); if (m) { out.n = +m[1]; out.ano = +m[2]; out.inv = m[0]; } } const ks = Object.keys(r.cells).map(Number).sort((a, b) => a - b); ks.forEach(k => { const tv = normT(txtIn(r.cells[k])); if (/^date/.test(tv)) { const nx = ks.find(z => z > k); if (nx != null) { const d = isoDate(r.cells[nx]); if (d) out.date = d; } } if (/^sold to/.test(tv)) { const nx = ks.find(z => z > k); if (nx != null) out.cli = txtIn(r.cells[nx]); } }); continue; }
        const sci = txtIn(r.cells[c.sci]), b = numIn(r.cells[c.boxes]);
        if (/package fee|taxa/i.test(sci)) { const f = numIn(r.cells[c.price]); if (f >= 0) fee = f; continue; }
        if (/^total/i.test(sci)) continue;
        if (!sci || !(b > 0)) continue;
        const q = numIn(r.cells[c.qpb]), p = numIn(r.cells[c.price]);
        items.push({ sci: sci.charAt(0).toUpperCase() + sci.slice(1).toLowerCase(), boxes: b, qpb: q > 0 ? q : '', price: p >= 0 ? p : '' });
      }
      if (items.length) { out.items = items; if (fee != null) out.fee = fee; break; }
    }
    if (!out.items.length) throw new Error('não achei a tabela de espécies (colunas "N.º Boxes" e "Species") nesta invoice');
    return out;
  }
  let pdfJs = null;
  function loadPdfJs() { if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib); if (!pdfJs) pdfJs = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'vendor/pdf.min.js'; s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; ok(window.pdfjsLib); }; s.onerror = () => no(new Error('não consegui carregar o leitor de PDF')); document.head.appendChild(s); }); return pdfJs; }
  async function parseInvoicePdf(buf) {
    const lib = await loadPdfJs(), pdf = await lib.getDocument({ data: new Uint8Array(buf) }).promise; const lines = [];
    for (let p = 1; p <= pdf.numPages; p++) { const tc = await (await pdf.getPage(p)).getTextContent(); const rows = []; tc.items.forEach(it => { if (!it.str.trim()) return; const y = Math.round(it.transform[5] / 3), x = it.transform[4]; let r = rows.find(z => Math.abs(z.y - y) <= 1); if (!r) rows.push(r = { y, a: [] }); r.a.push({ x, t: it.str.trim() }); }); rows.sort((a, b) => b.y - a.y).forEach(r => lines.push(r.a.sort((a, b) => a.x - b.x).map(z => z.t).join(' '))); }
    const out = { items: [] }; const all = lines.join('\n');
    const mi = /(\d{1,4})\s*\/\s*(\d{4})/.exec(all); if (mi) { out.n = +mi[1]; out.ano = +mi[2]; }
    const md = /date\s*:?\s*(\S+)/i.exec(all); if (md) { const q = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(md[1]); out.date = q && +q[1] <= 12 ? q[3] + '-' + q[1].padStart(2, '0') + '-' + q[2].padStart(2, '0') : isoDate(md[1]); }
    const ms = /sold to\s*:?\s*(.+)/i.exec(all); if (ms) out.cli = ms[1].trim();
    lines.forEach(l => {
      if (/package fee/i.test(l)) { const nums = l.replace(/[^\d.\s]/g, ' ').trim().split(/\s+/).map(Number).filter(z => !isNaN(z)); if (nums.length >= 2) out.fee = nums[1] > 0 && nums.length >= 3 ? nums[1] : nums[nums.length - 2]; return; }
      const m = /^(\d+)\s+(\d+)\s+([A-Za-z]+\s+[A-Za-z.]+(?:\s+[A-Za-z]+)?)\s+(.*?)\s+(\d[\d,]*)\s+\$?\s*([\d.,]+)\s+\$?\s*([\d.,]+)/.exec(l); if (!m) return;
      let sci = m[3].trim(), rest = m[4].trim(); const w = (sci + ' ' + rest).split(/\s+/);
      const sw = /^(sp|spp|sp\.|cf\.?)$/i.test(w[1]) ? 2 : 2; sci = w.slice(0, sw).join(' ');
      out.items.push({ sci: sci.charAt(0).toUpperCase() + sci.slice(1).toLowerCase(), boxes: +m[1], qpb: +m[2], price: numIn(m[6]) });
    });
    if (!out.items.length) throw new Error('não consegui ler a tabela neste PDF (se for foto/escaneado não dá). Use o Excel da invoice');
    return out;
  }
  async function qaImport(file) {
    QA.msg = '';
    try {
      const buf = await file.arrayBuffer(), isPdf = /\.pdf$/i.test(file.name);
      const r = isPdf ? await parseInvoicePdf(buf) : await parseInvoiceXlsx(buf);
      if (r.n) QA.n = String(r.n); if (r.ano) QA.ano = String(r.ano); if (r.date) QA.date = r.date; if (r.fee != null) QA.fee = r.fee;
      const d = guessDest(r.cli || '', ''); if (d) QA.dest = d; if (r.cli) QA.cli = r.cli;
      QA.items = r.items.map(x => ({ sci: x.sci, boxes: String(x.boxes), qpb: String(x.qpb), price: String(x.price) }));
      const tt = qaTot(); QA.msg = `Li a invoice${r.inv ? ' ' + r.inv : ''}: ${r.items.length} espécie(s), ${tt.boxes} caixas, US$ ${nU(tt.total, 2)}. Confira os dados abaixo e clique em Salvar.${r.n ? '' : ' (Não achei o número: digite.)'}`;
    } catch (e) { QA.msg = 'Não consegui ler esta invoice: ' + (e.message || e); }
    qaRender();
  }
  document.addEventListener('change', e => { const t = e.target; if (t.id === 'xqFile' && t.files[0]) { const f = t.files[0]; t.value = ''; qaImport(f); } });


  /* ---------- Programação de voos > Exportações: uma linha por exportação salva, editável ---------- */
  const SIT = { preparo: 'Em preparo', programada: 'Programada', transito: 'Em trânsito', chegou: 'Chegou', problema: 'Problema' };
  const sitOf = e => (e.ex && e.ex.sit) || (e.ex && e.ex.dep ? 'programada' : 'preparo');
  const sKey = e => ((e.ex && e.ex.dep) || '').slice(0, 10) || (e.ex && e.ex.pkDate) || e.dateISO || '';
  const awbOf = e => (e.ex && (e.ex.mawb || e.ex.awb)) || '';
  const DOWS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dowOf = iso => { if (!iso) return ''; const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return DOWS[new Date(y, m - 1, d).getDay()]; };
  function progRow(e) {
    const x = e.ex || {}, k = Object.values((e.rot && e.rot.st) || {}).filter(v => v === 'o').length, kg = (e.tot.boxes || 0) * unitKg(), sit = sitOf(e);
    const inp = (f, type, ph, w, v) => `<input data-xg="${f}" data-id="${e.id}" type="${type}" value="${esc(v != null ? v : x[f] || '')}" ${ph ? `placeholder="${ph}"` : ''} style="width:${w}px" aria-label="${ph || f}">`;
    return `<tr><td style="white-space:nowrap"><button type="button" class="linkb" data-xgo="${e.id}"><b>${p3(e.n)}/${e.ano}</b></button><div class="sm">roteiro ${k}/30</div><div class="pgbar"><i style="width:${Math.round(k / 30 * 100)}%"></i></div></td>
      <td><b>${esc(DEST[e.dest] ? DEST[e.dest].label : e.dest)}</b><div class="sm">${esc(e.cons.name)}</div><div class="sm">US$ ${nU(e.tot.total, 2)}</div></td>
      <td style="white-space:nowrap">${e.tot.boxes} cx<div class="sm">${kg} kg</div></td>
      <td><div class="sm">${dowOf(x.pkDate)}</div>${inp('pkDate', 'date', '', 140)}<br>${inp('pkTime', 'text', 'hora', 90)}</td>
      <td>${inp('dep', 'datetime-local', '', 178)}</td>
      <td>${inp('vooNac', 'text', 'voo nacional', 120)}<br><span class="sm">sai</span> ${inp('vooNacSai', 'datetime-local', '', 168)}<br><span class="sm">chega</span> ${inp('vooNacChe', 'datetime-local', '', 168)}</td>
      <td>${inp('voo', 'text', 'voo (KL0792)', 120)}<br><span class="sm">chega</span> ${inp('vooIntChe', 'datetime-local', '', 168)}</td>
      <td>${inp('mawb', 'text', 'MAWB / AWB', 130, awbOf(e))}<br>${inp('dued', 'text', 'DU-E', 130)}</td>
      <td><select data-xg="sit" data-id="${e.id}" aria-label="Situação" class="sit sit-${sit}">${Object.entries(SIT).map(([a, b]) => `<option value="${a}" ${a === sit ? 'selected' : ''}>${b}</option>`).join('')}</select></td></tr>`;
  }
  function progKpi(L) {
    const cx = L.reduce((a, e) => a + (e.tot.boxes || 0), 0), usd = L.reduce((a, e) => a + (e.tot.total || 0), 0), aw = L.filter(e => awbOf(e)).length;
    return `<div><b>${L.length}</b><span>exportações abertas</span></div><div><b>${cx}</b><span>caixas</span></div><div><b>US$ ${nU(usd, 2)}</b><span>total</span></div><div><b>${aw} de ${L.length}</b><span>com AWB</span></div>`;
  }
  function progSplit() {
    const hoje = todayISO(), cut = F.addDays(hoje, -1), all = HIST.slice();
    const prox = all.filter(e => sKey(e) >= cut && sitOf(e) !== 'chegou').sort((a, b) => sKey(a).localeCompare(sKey(b)) || a.n - b.n);
    const ant = all.filter(e => !prox.includes(e)).sort((a, b) => sKey(b).localeCompare(sKey(a)) || b.n - a.n);
    return { prox, ant };
  }
  const progHead = () => `<thead><tr><th>Nº</th><th>Destino / Cliente</th><th>Caixas</th><th>Saída do aquário</th><th>Saída de GRU</th><th>Voo nacional</th><th>Voo internacional</th><th>AWB / DU-E</th><th>Situação</th></tr></thead>`;
  function progHTML() {
    const { prox, ant } = progSplit();
    return `<section class="step" id="xProg"><div class="row between"><h2>Exportações </h2><button type="button" data-xgnew="1">+ Nova exportação</button></div>
      <div class="kpis" id="xgK">${progKpi(prox)}</div><div class="emYel">EXPORTAÇÕES – PRÓXIMAS SAÍDAS</div>
      ${prox.length ? `<div class="tablewrap"><table class="xprog">${progHead()}<tbody>${prox.map(progRow).join('')}</tbody></table></div>` : '<p class="empty">Nenhuma exportação aberta. As exportações aparecem aqui quando você as salva (ou usa "＋ Adicionar exportação" no Histórico).</p>'}
      ${ant.length ? `<details class="xdet" id="xAnt" style="margin-top:12px" ${PROGOPEN.ant ? 'open' : ''}><summary class="note">Anteriores (${ant.length})</summary><div class="tablewrap"><table class="xprog">${progHead()}<tbody>${ant.map(progRow).join('')}</tbody></table></div></details>` : ''}
      <p class="note">Tudo é editável na própria linha. Clique no número para abrir a exportação completa.</p></section>`;
  }
  const PROGOPEN = { ant: false };
  document.addEventListener('toggle', e => { if (e.target && e.target.id === 'xAnt') PROGOPEN.ant = e.target.open; }, true);
  document.addEventListener('change', e => {
    const t = e.target, f = t.dataset && t.dataset.xg; if (!f || !$('xProg') || !$('xProg').contains(t)) return;
    const h = HIST.find(x => x.id === t.dataset.id); if (!h) return;
    h.ex = h.ex || {}; const v = t.value; if (f === 'mawb') { h.ex.mawb = v; if (h.ex.awb && !v) h.ex.awb = ''; } else h.ex[f] = v;
    if (S.curId === h.id) { S.ex[f] = v; persist(); }
    saveHist();
    if (f === 'sit' || f === 'dep' || f === 'pkDate') { const y = window.scrollY; window.PP.extra.render('embarque'); window.scrollTo(0, y); } else { const k = $('xgK'); if (k) k.innerHTML = progKpi(progSplit().prox); }
  });
  document.addEventListener('click', e => {
    const o = e.target.closest('[data-xgo]'), n = e.target.closest('[data-xgnew]'); if (!(o || n) || !$('xProg') || !$('xProg').contains(e.target)) return;
    if (o) { openEntry(o.dataset.xgo); return; }
    if (n) { if (S.items.length && !S.curId && !confirm('Começar uma nova exportação? O rascunho atual será descartado (ele ainda não foi salvo no histórico).')) return; newExp(S.dest); PPx.go('exp'); }
  });

  function histHTML() {
    const L = HIST.slice().sort((a, b) => b.n - a.n);
    return `<section class="step" id="xHist"><div class="row between"><h2>Exportações </h2><span class="row"><span class="muted">${L.length} salva(s)</span><button type="button" data-xq="toggle">${QA.open ? '✕ Fechar' : '＋ Adicionar exportação'}</button></span></div>${QA.open ? qaHTML() : ''}${L.length ? `<div class="tablewrap"><table class="xit"><thead><tr><th>Nº</th><th>Destino</th><th>Data</th><th>Cliente</th><th class="n">Caixas</th><th class="n">Total US$</th><th>Roteiro</th><th></th></tr></thead><tbody>${L.map(e => { const k = Object.values((e.rot && e.rot.st) || {}).filter(v => v === 'o').length; return `<tr><td>${p3(e.n)}/${e.ano}</td><td>${esc(DEST[e.dest].label)}</td><td>${e.dateISO ? dBR(e.dateISO) : '<span class="muted">sem data</span>'}</td><td>${esc(e.cons.name)}</td><td class="n">${e.tot.boxes}</td><td class="n">${nU(e.tot.total, 2)}</td><td>${k}/30 OK</td><td style="white-space:nowrap"><button type="button" data-xopen="${e.id}">Abrir</button> <button type="button" class="danger" data-xdelh="${e.id}" aria-label="Excluir">✕</button></td></tr>`; }).join('')}</tbody></table></div>` : '<p class="note">Nenhuma exportação salva ainda. Elas entram aqui quando você baixa o .zip ou salva na aba Exportação.</p>'}</section>`;
  }

  function render(v) { if (S.xview === 'rot') renderRot(); else renderExp(); }

  /* ============================================================
     eventos
     ============================================================ */
  const rotSave = () => { if (S.curId) saveEntry(); else persist(); };
  const consKeys = /^cons\./;
  function onInput(e) {
    const t = e.target, el = $('vExp'); if (!el || !el.contains(t)) return;
    if (t.dataset.xp) {
      const p = t.dataset.xp; let v = t.type === 'checkbox' ? t.checked : t.value;
      if (p === 'ex.fee' || /^ex\.(disc|doa|frete|tarifa)$/.test(p)) v = v === '' ? '' : +v;
      if (p === 'conv.rate') v = v === '' ? '' : +v;
      setP(p, v);
      if (consKeys.test(p)) { CFG.cons[S.dest] = Object.assign(CFG.cons[S.dest] || {}, { [p.slice(5)]: v }); saveCfg(); }
      if (p === 'conv.on' && e.type === 'change') { renderExp(); return; }
      if (e.type === 'change' && p === 'date') { S.conv.date = S.conv.date || v; }
      live(); return;
    }
    if (t.dataset.xi != null) {
      const x = S.items[+t.dataset.xi], k = t.dataset.xk; if (!x) return;
      x[k] = t.value;
      if (k === 'sci' && e.type === 'change' && !x.pt) { x.pt = ptOf(x.sci); renderExp(); return; }
      live();
    }
  }
  document.addEventListener('input', onInput);
  document.addEventListener('change', async e => {
    const t = e.target;
    if (t.id === 'xFile' && t.files[0]) { await importFile(t.files[0]); t.value = ''; renderExp(); return; }
    if (t.id === 'xNumEd') {
      const n = parseInt(t.value, 10);
      if (!(n > 0)) { S.msg = 'Digite um número maior que zero.'; renderExp(); return; }
      const dup = HIST.find(x => x.n === n && String(x.ano) === String(yr()) && x.id !== S.curId);
      if (dup) { S.msg = 'A exportação ' + p3(n) + '/' + yr() + ' já existe no histórico (' + ((DEST[dup.dest] || {}).label || dup.dest) + '). Escolha outro número.'; renderExp(); return; }
      if (S.curId) { const e0 = HIST.find(x => x.id === S.curId); if (e0 && e0.n !== n) { CFG.used = (CFG.used || []).filter(u => u.n !== e0.n); e0.n = n; S.n = n; CFG.used.push({ n, d: S.dest, dt: dBR(S.date) }); if (n > CFG.last) CFG.last = n; saveCfg(); saveHist(); } }
      else S.nOver = n === CFG.last + 1 ? 0 : n;
      persist(); S.msg = 'O número desta exportação agora é ' + p3(n) + '/' + yr() + '.'; renderExp(); return;
    }
    if (t.id === 'xLast') { const n = Math.max(0, parseInt(t.value, 10) || 0); if (n === CFG.last) return; CFG.last = n; saveCfg(); S.numOpen = true; renderExp(); return; }
    if (t.id === 'xAno') { const n = parseInt(t.value, 10) || CFG.ano; if (n === CFG.ano) return; CFG.ano = n; saveCfg(); S.numOpen = true; renderExp(); return; }
    if (t.id === 'xNoDate') { if (t.checked) { S.dateBak = S.date || S.dateBak || ''; S.date = ''; } else { S.date = S.dateBak || todayISO(); } persist(); renderExp(); return; }
    if (t.id === 'xRotOnly') { S.rot.only = t.checked; persist(); renderRot(); return; }
    if (t.dataset && (t.dataset.xp === 'conv.on' || (t.dataset.xi != null && t.dataset.xk === 'sci'))) onInput(e);
  });
  document.addEventListener('input', e => {
    const t = e.target; if (t.dataset && t.dataset.xnt) { S.rot.nt = S.rot.nt || {}; S.rot.nt[t.dataset.xnt] = t.value; rotSave(); }
  });

  /* edição direta na prévia */
  const cleanTxt = t => String(t).replace(/\s+/g, ' ').trim();
  document.addEventListener('input', e => {
    const t = e.target; if (!t.dataset || !t.dataset.xe) return;
    const p = t.dataset.xe; let v = cleanTxt(t.textContent);
    if (/^items\.\d+\.(boxes|qpb|price|kg|padu)$/.test(p)) v = v.replace(',', '.').replace(/[^0-9.]/g, '');
    if (p === 'ex.fee') v = +v || 0;
    setP(p, v); t.dataset.raw = v; t.classList.toggle('blank', v === '');
    if (consKeys.test(p)) { CFG.cons[S.dest] = Object.assign(CFG.cons[S.dest] || {}, { [p.slice(5)]: v }); saveCfg(); }
    liveForm();
  });
  document.addEventListener('focusin', e => { const t = e.target; if (t.dataset && t.dataset.xe && t.dataset.raw != null && cleanTxt(t.textContent) !== t.dataset.raw) t.textContent = t.dataset.raw; });
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (e.key === 'Enter' && t.dataset && t.dataset.xe) { e.preventDefault(); t.blur(); }
    if (e.key === 'Escape' && prevOpen()) closePrev();
  });
  document.addEventListener('focusout', e => {
    const t = e.target; if (!t.dataset || !t.dataset.xe) return;
    const r = e.relatedTarget; if (r && r.dataset && r.dataset.xe) return;
    if (r && r.closest && r.closest('#xStage')) setTimeout(refreshStage, 200); else refreshStage();
  });
  document.addEventListener('paste', e => { const t = e.target; if (t.dataset && t.dataset.xe) { e.preventDefault(); document.execCommand('insertText', false, cleanTxt((e.clipboardData || window.clipboardData).getData('text'))); } });
  document.addEventListener('toggle', e => { if (e.target && e.target.id === 'xCons') { S.consOpen = e.target.open; persist(); } if (e.target && e.target.id === 'xNum') { S.numOpen = e.target.open; persist(); } }, true);

  /* arrastar as espécies */
  let dragX = -1;
  document.addEventListener('dragstart', e => { const g = e.target.closest && e.target.closest('[data-xgrip]'); if (!g) return; dragX = +g.dataset.xgrip; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(dragX)); } catch (_) { /* ok */ } g.closest('tr').classList.add('dragging'); });
  document.addEventListener('dragover', e => { if (dragX < 0) return; e.preventDefault(); document.querySelectorAll('tr.dragover').forEach(x => x.classList.remove('dragover')); const tr = e.target.closest && e.target.closest('tr[data-xrow]'); if (tr) tr.classList.add('dragover'); });
  document.addEventListener('drop', e => { if (dragX < 0) return; e.preventDefault(); const tr = e.target.closest && e.target.closest('tr[data-xrow]'); const to = tr ? +tr.dataset.xrow : dragX, f = dragX; dragX = -1; moveItem(f, to); });
  document.addEventListener('dragend', () => { dragX = -1; document.querySelectorAll('tr.dragover,tr.dragging').forEach(x => x.classList.remove('dragover', 'dragging')); });

  async function act(a, b) {
    if (a === 'aduReset') { S.items.forEach(x => { delete x.padu; }); live(); return; }
    if (a === 'ordauto') { autoOrder(); return; }
    if (a === 'ordsave') { saveOrdem(); return; }
    if (a === 'ordclear') { clearOrdem(); return; }
    if (a === 'nac') { PPx.go('pedido'); return; }
    if (a === 'prev') { openPrev(); return; }
    if (a === 'closeprev') { closePrev(); return; }
    if (a === 'usarnum') {
      const n = parseInt(b.dataset.n, 10); if (!(n > 0)) return;
      if (S.items.length && !S.curId && !confirm('Começar a exportação ' + p3(n) + '/' + yr() + '? O rascunho atual será descartado (ele ainda não foi salvo no histórico).')) return;
      newExp(S.dest); S.nOver = n; S.msg = 'Exportação ' + p3(n) + '/' + yr() + ' em branco. Preencha e salve no histórico.'; persist(); renderExp(); return;
    }
    if (a === 'novo') { if (S.items.length && !S.curId && !confirm('Começar uma nova exportação? O rascunho atual será descartado (ele ainda não foi salvo no histórico).')) return; newExp(S.dest); renderExp(); return; }
    if (a === 'addtxt') { importText($('xTxt').value); renderExp(); return; }
    if (a === 'addrow') { addItem({ boxes: 1 }); renderExp(); return; }
    if (a === 'ptax') { await buscaPtax(); return; }
    if (a === 'zip') { b.disabled = true; try { await downloadAll(); } catch (e) { S.msg = 'Erro ao gerar: ' + (e.message || e); renderExp(); } return; }
    if (a === 'save') { saveEntry(); S.msg = `Exportação ${numStr()} salva no histórico.`; persist(); if (S.xview === 'rot') renderRot(); else renderExp(); return; }
    if (a === 'rot' || a === 'vrot') { S.xview = 'rot'; persist(); render(); window.scrollTo(0, 0); return; }
    if (a === 'vped') { S.xview = 'ped'; persist(); render(); return; }
    if (a === 'alllab') { S.allLabels = !S.allLabels; live(); return; }
    if (a === 'pdfnfs') { if (PP.mapa && PP.mapa.pdfExportacao) PP.mapa.pdfExportacao(); return; }
    if (a === 'bigmail') { bigMail(b.dataset.xk || 'lpco'); return; }
    if (a === 'mailin') { importMailExp(($('xMailIn') || {}).value || ''); return; }
    if (a === 'copymail') { const ta = $('xMail_' + (b.dataset.xk || 'lpco')); if (ta) { ta.select(); try { await navigator.clipboard.writeText(ta.value); } catch (_) { document.execCommand('copy'); } b.textContent = '✓ Copiado'; } return; }
    if (a === 'rotprint') { document.body.classList.add('printrot'); window.print(); setTimeout(() => document.body.classList.remove('printrot'), 500); return; }
    if (a === 'rotclear') { if (confirm('Zerar o roteiro desta exportação?')) { S.rot = newRot(); rotSave(); renderRot(); } return; }
  }
  document.addEventListener('click', async e => {
    const t = e.target.closest('button,[data-xjump]'); if (!t) return;
    const d = t.dataset;
    if (t.id === 'modExp') { PPx.go('exp'); return; }
    const inPrev = $('xModal') && $('xModal').contains(t), inExp = $('vExp') && $('vExp').contains(t), inRot = S.xview === 'rot' && $('vExp') && $('vExp').contains(t), inNum = $('vHist') && $('vHist').contains(t);
    if (!inExp && !inRot && !inNum && !inPrev) return;
    if (d.xa) { await act(d.xa, t); return; }
    if (inExp && S.xview !== 'rot') {
      if (d.xmv) { moveItem(+d.xi2, +d.xi2 + +d.xmv); return; }
      if (d.xdest) { S.dest = d.xdest; S.cons = consOf(S.dest); S.sub = { atest: DEST[S.dest].atest[0], czi: DEST[S.dest].czi[0] }; persist(); renderExp(); return; }
      if (d.xdl) { await downloadOne(d.xdl); return; }
      if (d.xdel != null) { S.items.splice(+d.xdel, 1); renderExp(); return; }
    }
    if (inPrev) {
      if (d.xtab) { S.tab = d.xtab; renderPrev(); return; }
      if (d.xsub) { const [k, v] = d.xsub.split(':'); S.sub[k] = v; renderPrev(); return; }
      if (d.xiv) { S.invView = d.xiv; renderPrev(); return; }
    }
    if (inRot) {
      if (d.xst) { const [k, v] = d.xst.split(':'); S.rot.st = S.rot.st || {}; S.rot.st[k] = v; rotSave(); renderRot(); const r = $('rv_' + k); if (r) r.scrollIntoView({ block: 'nearest' }); return; }
      if (d.xnote) { const k = d.xnote; S.rot.no = S.rot.no || {}; S.rot.no[k] = !S.rot.no[k]; persist(); renderRot(); const i = document.querySelector(`[data-xnt="${k}"]`); if (i) i.focus(); return; }
      if (d.xjump) { const r = $('rv_' + d.xjump); if (r) { S.rot.only = false; r.scrollIntoView({ behavior: 'smooth', block: 'center' }); r.classList.add('flash'); setTimeout(() => r.classList.remove('flash'), 1600); } return; }
      if (d.xrotgo) { S.xview = 'ped'; S.tab = d.xrotgo; if (d.xrsub) { if (d.xrotgo === 'at') S.sub.atest = d.xrsub; } persist(); PPx.go('exp'); openPrev(); return; }
    }
    if (inNum) {
      if (d.xopen) { openEntry(d.xopen); return; }
      if (d.xdelh) { if (confirm('Excluir esta exportação do histórico? O número continua marcado como usado.')) { HIST = HIST.filter(x => x.id !== d.xdelh); if (S.curId === d.xdelh) { S.curId = null; S.n = null; } saveHist(); persist(); if (window.PP.extra) window.PP.extra.render('hist'); } return; }
    }
  });

  function reload() { CFG = Object.assign({ last: 17, ano: new Date().getFullYear(), cons: {}, ordem: [], used: SEED_USED.slice() }, store.get('expcfg', {})); HIST = store.get('exphist', []); }
  /* dados para a Conferência de NFs (aba Notas de entrada): nº, cliente, itens e partida da exportação aberta e das salvas */
  const mapaItems = its => (its || []).filter(x => +x.boxes > 0).map(x => ({ esp: String(x.sci || '').trim(), qtd: Math.round((+x.boxes || 0) * (+x.qpb || 0)) })).filter(x => x.esp && x.qtd > 0);
  const mapaInfo = () => ({ id: S.curId || '', num: numStr(), cliente: (S.cons && S.cons.name) || '', dest: (DEST[S.dest] || {}).label || '', dataISO: S.date, dep: (S.ex && S.ex.dep) || '', items: mapaItems(SI()), salva: !!S.curId });
  const mapaAll = () => { const L = HIST.map(e => ({ id: e.id, num: p3(e.n) + '/' + (e.ano || CFG.ano), cliente: (e.cons && e.cons.name) || '', dest: (DEST[e.dest] || {}).label || '', dataISO: e.dateISO, dep: (e.ex && e.ex.dep) || '', items: mapaItems(e.items), salva: true })); const c = mapaInfo(); if (!c.salva && c.items.length) L.push(c); else if (c.salva) { const i = L.findIndex(x => x.id === c.id); if (i >= 0) L[i] = c; } return L; };
  window.PP.exp = { mapaInfo, mapaAll, render, reload, histHTML, openEntry, destLabel: k => (DEST[k] || {}).label, state: () => S, cfg: () => CFG, hist: () => HIST, docList, orderObj, progHTML };
})();
