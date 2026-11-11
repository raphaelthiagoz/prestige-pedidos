const {fs,JSZip,TPL,CONS,OUT}=require('./exp_common');
const XD=require('../exportdocs.js');
const mk=XD.make({JSZip,TPL});
const L=[[16,300,'OTOCINCLUS HOPPEI','LIMPA VIDRO',.12],[10,450,'PARACHEIRODON AXELRODI','CARDINAL',.16],[10,200,'HEMIGRAMMUS BLEHERI','RODOSTOMUS',.12],[3,700,'PARACHEIRODON SIMULANS','NEON VERDE',.12],[4,250,'CARNEGIELLA STRIGATA','BORBOLETA LISTRADA',.16],[8,100,'CORYDORAS SCHWARTZI','CORIDORA',.15],[3,250,'CORYDORAS SCHWARTZI','CORIDORA',.12],[3,200,'CORYDORAS ELEGANS','CORIDORA',.12],[3,100,'CORYDORAS SODALIS','CORIDORA',.15],[1,250,'DICROSSUS MACULATUS','XADREZINHO',.16],[3,40,'DIANEMA UROSTRIATUM','DIANEMA',1],[1,30,'BROCHIS SPLENDENS','LIMPA FUNDO VERDE',2]];
const items=L.map(([b,q,s,p,pr])=>({boxes:b,qpb:q,sci:s,pt:p,price:pr,kg:8}));
const base={dest:'MIA',cons:CONS.MIA,invNum:'018',ano:2026,dateISO:'2026-11-06',rate:5.4772,ex:{fee:12},items};
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 const o=Object.assign({},base,{extras:[{label:'DISCOUNT',value:-500},{label:'DOA',value:-150}]});
 const T=mk.totals(o);console.log('goods',T.goods,'grand',T.grand,'net',T.net);
 fs.writeFileSync(OUT+'/INV018_ORIGINAL.xlsx',await mk.invoiceUsd(o));
 const adu=items.map((x,i)=>Object.assign({},x,{price:i>=10?0.9:0.1}));
 const o2=Object.assign({},base,{items:adu,extras:[{label:'PRE-PAID FREIGHT',value:4394}]});
 console.log('adu',mk.totals(o2).goods,mk.totals(o2).net);
 fs.writeFileSync(OUT+'/INV018_ADUANA.xlsx',await mk.invoiceUsd(o2));
 fs.writeFileSync(OUT+'/INV018_PLAIN.xlsx',await mk.invoiceUsd(base));
 fs.writeFileSync(OUT+'/INV018_DISC1.xlsx',await mk.invoiceUsd(Object.assign({},base,{extras:[{label:'DISCOUNT',value:-500},{label:'DOA',value:0}]})));
 console.log('ok');
})().catch(e=>{console.error(e);process.exit(1)});
