const ExcelJS=require('exceljs'),Core=require('../core.js');
(async()=>{const wb=new ExcelJS.Workbook();await wb.xlsx.readFile(__dirname+'/stocklist.xlsx');const cat=Core.parseStocklistWorksheet(wb.worksheets[0]).items;
const txt=process.argv[2].replace(/\\n/g,'\n');const r=Core.parseText(txt,cat);
r.rows.forEach(x=>{const it=cat.find(c=>c.id===x.sel);console.log(JSON.stringify(x.raw),'→',it?`${it.sci}|${it.comum}|${it.caixa}|est ${it.estoque}`:'—',x.mode,'qty',x.qty,'cx',x.boxes,'cands',x.cands.length)});console.log('ign',r.ignored);
for(const n of ['coridora schwartz','platidora armutulus','limpa vidro verde','rodostromos','borboleta','cardinal'])console.log(n,Core.norm(n),cat.map(it=>[Core.score(n,it),it.sci,it.comum,it.caixa]).sort((a,b)=>b[0]-a[0]).slice(0,3).map(x=>x[0].toFixed(2)+' '+x[1]+'/'+x[2]+'/'+x[3]).join(' ; '))})();
