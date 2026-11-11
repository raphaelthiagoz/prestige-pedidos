const {fs,JSZip,TPL,OUT,mkOrder,CONS}=require('./exp_common');const XD=require('../exportdocs.js');const mk=XD.make({JSZip,TPL});
(async()=>{const ex={fee:12,nf:'00008941/8942 S-2',aero:'GRU',dued:'26BR001971465-1',lpcoIbama:'E2600604683',pkDate:'2026-11-03',pkTime:'06:00AM',oxy:'72HRS',temp:'20℃ – 27℃'};
 const o=mkOrder({cons:Object.assign({},CONS.MIA,{addrAt:'19150 SW 248TH STREET HOMESTEAD, FLORIDA 33031',lab1:'19150 SW 248TH STREET',lab2:'HOMESTEAD, FLORIDA 33031 - USA'}),ex});
 let buf=await mk.etiquetasDocx(o);fs.writeFileSync(OUT+'/ETIQ_018.docx',buf);
 const o2=Object.assign({},o,{items:o.items.slice(0,2)});o2.items=o2.items.map((x,i)=>Object.assign({},x,{boxes:i?2:3}));fs.writeFileSync(OUT+'/ETIQ_5.docx',await mk.etiquetasDocx(o2));console.log('ok',buf.length);})().catch(e=>{console.error(e);process.exit(1)});
