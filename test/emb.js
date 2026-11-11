const fs=require('fs'),JSZip=require('jszip'),Docs=require('../docs.js');
const mk=Docs.make({JSZip,tplEmbarqueB64:fs.readFileSync(__dirname+'/tpl_embarque.b64','utf8'),docx:{},ExcelJS:{}});
const L=[['RA BADAUY','GYN',12],['NATALHIA VIEIRA','POA',10],['JULIANA BEZERRA','REC',6],['JOAO VICTOR CRUZ - AQUALIFE','CWB',11],['NACIONAL AQUARIOS','GRU',17],['CEZAR APARECIDO','VCP',6],['RODRIGO HENRIQUE','JPA',4],['HUGO ROGERIO','VCP',15],['UBER PEIXES','UDI',6]].map(([cliente,aero,caixas])=>({cliente,aero,caixas}));
(async()=>{fs.mkdirSync(__dirname+'/../out/emb',{recursive:true});
 fs.writeFileSync(__dirname+'/../out/emb/EMB.docx',Buffer.from(await mk.embarqueDocx({titulo:'EMBARQUES NACIONAIS',saidaISO:'2026-11-04',linhas:L,kg:8,dimPadrao:'30L: 42x42x23'})));
 fs.writeFileSync(__dirname+'/../out/emb/EMB2.docx',Buffer.from(await mk.embarqueDocx({titulo:'EMBARQUES NACIONAIS',saidaISO:'2026-11-05',linhas:L.slice(0,3).concat([{cliente:'TESTE & CIA <1>',aero:'MAO',caixas:3,peso:'20 KG',dim:'3 CXS 40L: 50x50x30'}]),kg:8,dimPadrao:'30L: 42x42x23'})));
 console.log('ok')})();
