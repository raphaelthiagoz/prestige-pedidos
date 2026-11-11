const fs=require('fs'),ExcelJS=require('exceljs'),docx=require('docx'),JSZip=require('jszip');
const Core=require('../core.js'),Docs=require('../docs.js');const D=__dirname+'/';
const mk=Docs.make({ExcelJS,docx,JSZip,logoPngB64:'',logoJpgB64:'',tplInvoiceB64:fs.readFileSync(D+'tpl_invoice.b64','utf8')});
(async()=>{const w1=new ExcelJS.Workbook();await w1.xlsx.readFile(D+'stocklist.xlsx');const cat=Core.parseStocklistWorksheet(w1.worksheets[0]).items;
const w2=new ExcelJS.Workbook();await w2.xlsx.readFile(D+'pedido_cliente.xlsx');const ped=Core.parseStocklistWorksheet(w2.worksheets[0]).items.filter(i=>i.pedido>0);
const P=Core.plan(Core.rowsFromStocklistOrder(ped,cat).rows,cat);const cfg=JSON.parse(JSON.stringify(Core.DEFAULT_CFG));
const o={P,cliente:{nome:'PISCULTURA ANDRADE LTDA',end:'FAZENDA BABILONIA S/N · VIEIRAS = MG'},cfg,dataISO:'2026-09-23',num:{invoice:'',atestado:0,nf:''}};
fs.writeFileSync('/tmp/inv/andrade_novo.xlsx',Buffer.from(await mk.invoiceXlsx(o)));console.log(P.total,P.peixes,P.valor)})();
