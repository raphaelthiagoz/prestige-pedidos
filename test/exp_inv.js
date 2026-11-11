const {fs,JSZip,TPL,items,CONS,OUT}=require('./exp_common');
const XD=require('../exportdocs.js');
const mk=XD.make({JSZip,TPL});
(async()=>{
 const it=items.map(i=>Object.assign({kg:8},i));
 const o={dest:'MIA',cons:CONS.MIA,invNum:'018',ano:2026,dateISO:'2026-11-04',items:it,rate:5.4772,ex:{fee:12}};
 const T=mk.totals(o);console.log('boxes',T.boxes,'fish',T.fish,'goods',T.goods,'fee',T.feeTotal,'grand',T.grand,'kg',T.kg);
 fs.writeFileSync(OUT+'/INVOICE_018.xlsx',await mk.invoiceUsd(o));
 fs.writeFileSync(OUT+'/INVOICE_018_BRL.xlsx',await mk.invoiceBrl(o));
 const o2=Object.assign({},o,{items:it.slice(0,5)});fs.writeFileSync(OUT+'/INVOICE_018_5.xlsx',await mk.invoiceUsd(o2));
 const o3=Object.assign({},o,{items:it.concat(it.slice(0,4).map(x=>Object.assign({},x,{sci:x.sci+' B'})))});fs.writeFileSync(OUT+'/INVOICE_018_16.xlsx',await mk.invoiceUsd(o3));fs.writeFileSync(OUT+'/INVOICE_018_16_BRL.xlsx',await mk.invoiceBrl(o3));
 console.log('ok');
})().catch(e=>{console.error(e);process.exit(1)});
