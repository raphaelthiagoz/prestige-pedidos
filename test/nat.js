const fs=require('fs'),ExcelJS=require('exceljs'),docx=require('docx'),JSZip=require('jszip');
const Core=require('/home/claude/prestige-pedidos/core.js'),Docs=require('/home/claude/prestige-pedidos/docs.js');
const D='/home/claude/prestige-pedidos/test/';
const mk=Docs.make({ExcelJS,docx,JSZip,logoPngB64:fs.readFileSync(D+'logo.png.b64','utf8'),logoJpgB64:fs.readFileSync(D+'logo.jpg.b64','utf8'),tplNotinhaB64:fs.readFileSync(D+'tpl_notinha.b64','utf8'),tplEtiquetasB64:fs.readFileSync(D+'tpl_etiquetas.b64','utf8'),tplPackingB64:fs.readFileSync(D+'tpl_packing.b64','utf8'),tplInvoiceB64:fs.readFileSync(D+'tpl_invoice.b64','utf8')});
(async()=>{
 const wb=new ExcelJS.Workbook(); await wb.xlsx.readFile(D+'stocklist.xlsx'); const cat=Core.parseStocklistWorksheet(wb.worksheets[0]).items;
 const txt="2 cx cardinal\n1 cx rodostomus\n1 cx limpa vidro\n1 cx corydoras schwartzi\n0,5 cx neon verde\nmeia caixa borboleta\n1 cx limpa fundo verde\n1 cx bagre";
 const r=Core.parseText(txt,cat); console.log('ignorado',r.ignored);
 r.rows.forEach(x=>console.log(x.mode,x.group,x.frac||'',x.qty,x.boxes,(cat.find(c=>c.id===x.sel)||{}).comum,Core.status(x,cat).txt));
 const sch=cat.find(c=>/SCHWARTZI/.test(c.sci)&&c.caixa===250&&c.estoque!==null); const rw=r.rows.find(x=>x.qty===100&&x.mode==='inteira'); if(sch&&rw){rw.sel=sch.id;rw.qty=250;}
 const P=Core.plan(r.rows,cat); console.log('caixas',P.total,'peixes',P.peixes,Core.groupWarnings(r.rows));
 // pedido por planilha com 0,5
 const wb2=new ExcelJS.Workbook(); await wb2.xlsx.readFile(D+'pedido_cliente.xlsx'); const ws=wb2.worksheets[0];
 const it=Core.parseStocklistWorksheet(ws).items; console.log('parseFrac',Core.parseFrac('1/2'),Core.parseFrac('0,25'),Core.parseFrac('meia'),Core.parseFrac(1.5));
 const cfg=JSON.parse(JSON.stringify(Core.DEFAULT_CFG)); const o={P,cliente:{nome:'NATALIA DA COSTA VIEIRA',end:'RUA MIGUEL TOSTES 229 · VIAMAO = RS'},cfg,dataISO:'2026-10-26',num:{invoice:'417',atestado:72,nf:'000008980'},nota:null};
 const nr=Core.notinhaRows(P,cfg); const ex={gtaAuto:true,gta:0,temAt:false,atestado:80,embalagem:36,qCaixaMaior:0,caixaMaior:80}; o.nota={rows:nr,ex,totals:Core.notinhaTotals(nr,ex,cfg.valores),dia:'QUINTA-FEIRA'};
 fs.mkdirSync('/tmp/nat',{recursive:true});
 fs.writeFileSync('/tmp/nat/INVOICE.xlsx',Buffer.from(await mk.invoiceXlsx(o)));
 fs.writeFileSync('/tmp/nat/PACKINGLIST.docx',Buffer.from(await mk.packingDocx(o)));
 fs.writeFileSync('/tmp/nat/ETIQUETAS.docx',Buffer.from(await mk.etiquetasDocx(o))); cfg.etiquetas.porPagina=8; fs.writeFileSync('/tmp/nat/ETIQUETAS8.docx',Buffer.from(await mk.etiquetasDocx(o)));
})().catch(e=>{console.error(e);process.exit(1)});
