const {fs,JSZip,TPL,OUT,mkOrder,CONS}=require('./exp_common');const XD=require('../exportdocs.js');const mk=XD.make({JSZip,TPL});
(async()=>{
 const ex={fee:12,gta:'0601477',serie:'A',mawb:'074-70222390',hawb:'DM-00058834',voo:'KL0792',dep:'2026-11-07T20:59',lpcoMapa:'E2600665213'};
 const AMS=mkOrder({dest:'AMS',cons:Object.assign({},CONS.AMS,{nameAt:'RUINEMANS GROUP',addrAt:'IJSSELVELD 9, 3417 XH MONTFOORT',country:'HOLANDA (PAÍSES BAIXOS) - NL',border:'NLAMS4'}),ex});
 const MIA=mkOrder({cons:Object.assign({},CONS.MIA,{addrAt:'19150 SW 248TH STREET HOMESTEAD, FLORIDA 33031',country:'ESTADOS UNIDOS'}),ex:Object.assign({},ex,{gta:'444186',serie:'C',mawb:'549-42989181'})});
 const JPN=mkOrder({dest:'JPN',cons:{name:'FAR EAST ENTERPRISE INC',nameAt:'FAR EAST ENTERPRISE INC',addr1:'HIKARIGAOKA 1-1322',addr2:'TOKYO - JAPAN',addrAt:'HIKARIGAOKA 1-1322, SANRIZUKA NARITA CHIBA KEN TOKYO, TOKYO - JAPAN',country:'JAPÃO',phone:'+ 81 47 635 8911',border:'ALEMANHA'},ex:Object.assign({},ex,{gta:'446348',serie:'C',mawb:'020-27288575',voo:'LH507+LH8384'})});
 const jobs=[['AMS',AMS,['sisaEU','vigAMS','cziEN']],['MIA',MIA,['sisaUS','vigUS','cziUS']],['JPN',JPN,['sisaJP','sisaEU','vigJP','cziDE','cziJP']]];
 for(const [n,o,ks] of jobs)for(const k of ks){fs.writeFileSync(`${OUT}/${n}_${k}.docx`,await mk.doc(k,o));}
 console.log('ok');
})().catch(e=>{console.error(e);process.exit(1)});
