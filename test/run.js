const fs=require('fs'), path=require('path');
const ExcelJS=require('exceljs'), docx=require('docx');
const Core=require('../core.js'), Docs=require('../docs.js');
const logoPngB64=fs.readFileSync(__dirname+'/logo.png.b64','utf8'), logoJpgB64=fs.readFileSync(__dirname+'/logo.jpg.b64','utf8');
const JSZip=require('jszip');
const mk=Docs.make({ExcelJS,docx,JSZip,logoPngB64,logoJpgB64,tplNotinhaB64:fs.readFileSync(__dirname+'/tpl_notinha.b64','utf8'),tplEtiquetasB64:fs.readFileSync(__dirname+'/tpl_etiquetas.b64','utf8'),tplPackingB64:fs.readFileSync(__dirname+'/tpl_packing.b64','utf8'),tplInvoiceB64:fs.readFileSync(__dirname+'/tpl_invoice.b64','utf8')});
const EX={
 andrade:{cli:{nome:'PISCICULTURA ANDRADE LTDA',end:'FAZENDA BABILONIA S/N · VIEIRAS = MG'},nf:'000008910',inv:412,at:67,temAt:true,dia:'QUINTA-FEIRA',txt:"250 borboleta listrada\n60  Dianema Urostriatum\n1.600 neon cardinal\n500 rodostumos\n30 baiacu\n30 Cruzeiro do Sul\n300 limpa vidro\n300 peixe lápis",expect:null},
 aquaprime:{cli:{nome:'AQUAPRIME',end:'JOINVILLE - SC'},nf:'000008950',inv:413,at:68,temAt:false,dia:'QUINTA-FEIRA',txt:"300 cardinal @1\n100 neon verde @1\n120 rodostomus @1\n100 limpa vidro @2\n10 banjo @2\n30 corydoras schwartzi @2\n30 corydoras sodalis @2\n30 corydoras incolicana @3\n20 corydoras elegans @3\n10 limpa fundo verde @3\n20 piaba @3",expect:740.5},
 nilvia:{cli:{nome:'NILVIA JANETE',end:''},nf:'000008970',inv:415,at:70,temAt:false,dia:'QUINTA-FEIRA',txt:"1600 neon cardinal\n500 rodostomus\n600 otocinclus\n600 neon verde\n100 corydoras schwartzi",expect:null},
 leni:{cli:{nome:'LENI LUZINETE',end:''},nf:'000008965',inv:416,at:71,temAt:true,dia:'QUINTA-FEIRA',txt:"1600 neon cardinal\n2000 neon cardinal\n500 rodostomus\n600 limpa vidro\n200 corydoras schwartzi\n250 corydoras schwartzi\n80 corydoras sodalis\n30 corydoras robustus\n30 platydoras armutulus",expect:null},
 cezar:{cli:{nome:'CEZAR APARECIDO',end:''},nf:'000008960',inv:414,at:69,temAt:true,dia:'QUARTA-FEIRA',txt:"1000 neon cardinal\n750 rodostomus\n900 limpa vidro\n300 corydoras schwartzi\n100 corydoras sodalis @1\n100 corydoras elegans",expect:2878},
};
(async()=>{
  const wb=new ExcelJS.Workbook(); await wb.xlsx.readFile(__dirname+'/stocklist.xlsx');
  const sl=Core.parseStocklistWorksheet(wb.worksheets[0]); console.log('catálogo',sl.items.length,'erro',sl.error);
  const cfg=JSON.parse(JSON.stringify(Core.DEFAULT_CFG));
  // pedido devolvido pela planilha
  const wb2=new ExcelJS.Workbook(); await wb2.xlsx.readFile(__dirname+'/pedido_cliente.xlsx');
  const ped=Core.parseStocklistWorksheet(wb2.worksheets[0]).items.filter(i=>i.pedido>0);
  const rs=Core.rowsFromStocklistOrder(ped,sl.items); const P0=Core.plan(rs.rows,sl.items);
  console.log('pedido planilha: itens',ped.length,'caixas',P0.total,'peixes',P0.peixes,'valor',P0.valor.toFixed(2),'(esperado 19 / 6022 / 4396.00 da invoice Andrade)');
  for(const [k,e] of Object.entries(EX)){
    const {rows,ignored}=Core.parseText(e.txt,sl.items); const P=Core.plan(rows,sl.items);
    const nrows=Core.notinhaRows(P,cfg);
    const ex={gtaAuto:true,gta:0,temAt:e.temAt,atestado:cfg.valores.atestado,embalagem:cfg.valores.embalagem,qCaixaMaior:0,caixaMaior:cfg.valores.caixaMaior};
    const totals=Core.notinhaTotals(nrows,ex,cfg.valores);
    console.log(k,'| caixas',P.total,'peixes',P.peixes,'peixes R$',P.valor.toFixed(2),'GTA',totals.gta,'TOTAL',totals.total,'esperado',e.expect,'ignoradas',ignored.length);
    const o={P,cliente:e.cli,cfg,num:{invoice:e.inv,atestado:e.at,nf:e.nf},dataISO:'2026-10-21',nota:{rows:nrows,totals,ex,dia:e.dia}};
    fs.mkdirSync(__dirname+'/../out/'+k,{recursive:true});
    const w=(n,b)=>fs.writeFileSync(`${__dirname}/../out/${k}/${n}`,Buffer.from(b));
    w('INVOICE.xlsx',await mk.invoiceXlsx(o)); w('NOTINHA.xlsx',await mk.notinhaXlsx(o));
    w('ATESTADO.docx',await mk.atestadoDocx(o)); w('PACKINGLIST.docx',await mk.packingDocx(o)); w('ETIQUETAS.docx',await mk.etiquetasDocx(o));
  }
})().catch(e=>{console.error(e);process.exit(1)});
