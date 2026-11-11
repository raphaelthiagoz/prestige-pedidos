const fs=require('fs'),ExcelJS=require('exceljs'),docx=require('docx'),JSZip=require('jszip');
const Core=require('../core.js'),F=require('../features.js'),Docs=require('../docs.js');
const T=n=>fs.readFileSync(__dirname+'/'+n,'utf8');
const mk=Docs.make({ExcelJS,docx,JSZip,logoPngB64:T('logo.png.b64'),logoJpgB64:T('logo.jpg.b64'),tplNotinhaB64:T('tpl_notinha.b64'),tplEtiquetasB64:T('tpl_etiquetas.b64'),tplPackingB64:T('tpl_packing.b64'),tplInvoiceB64:T('tpl_invoice.b64')});
let fail=0; const ok=(c,m)=>{console.log((c?'  ok  ':' FALHA ')+m); if(!c) fail++;};
(async()=>{
 const wb=new ExcelJS.Workbook(); await wb.xlsx.readFile(__dirname+'/stocklist.xlsx'); const sl=Core.parseStocklistWorksheet(wb.worksheets[0]); console.log('cols',JSON.stringify(sl.cols));
 const cfg=JSON.parse(JSON.stringify(Core.DEFAULT_CFG));
 // voz
 ok(F.spokenToDigits('duzentos e cinquenta borboleta listrada')==='250 borboleta listrada','voz 250');
 ok(F.spokenToDigits('mil e quinhentos neon cardinal')==='1500 neon cardinal','voz 1500');
 ok(F.spokenToDigits('dois mil rodostomus')==='2000 rodostomus','voz 2000');
 ok(F.spokenToDigits('trinta e cinco limpa vidro e')==='35 limpa vidro e','voz 35 (e solto fica)');
 ok(F.spokenToDigits('uma caixa de neon')==='1 caixa de neon','voz uma caixa');
 // preço por cliente
 const cli={nome:'X',desc:10,precos:'NEON CARDINAL = 0,35\nCORYDORAS ELEGANS=0.5'};
 const it=sl.items.find(i=>/CARDINAL/i.test(i.comum)); ok(F.priceFor(cli,it)===0.35,'preço especial cardinal '+F.priceFor(cli,it));
 const it2=sl.items.find(i=>!/CARDINAL|ELEGANS/i.test(i.comum+i.sci)); ok(F.priceFor(cli,it2)===F.r2(it2.preco*0.9),'desconto 10% '+it2.preco+'→'+F.priceFor(cli,it2));
 // pedido + histórico + estoque
 const txt="2 cx neon cardinal\n1 cx rodostomus"; const mkEntry=(id,inv,cli_)=>{
   let hist=[]; const eff=F.effCatalog(sl.items,F.soldBoxes([], 1),cli_); const {rows}=Core.parseText(txt,eff); const P=Core.plan(rows,eff);
   const nr=Core.notinhaRows(P,cfg), ex={gtaAuto:true,gta:0,temAt:true,atestado:80,embalagem:36,qCaixaMaior:0,caixaMaior:80}, totals=Core.notinhaTotals(nr,ex,cfg.valores);
   return {rows,P,eff,e:F.makeEntry({id,ts:Date.now(),dataISO:'2026-11-04',cliente:{nome:'CLIENTE A',end:'X · Y'},inv,atNum:5,nf:'123',stamp:1,P,nota:{rows:nr,totals,ex,dia:'QUINTA-FEIRA'},catalog:eff,rows,cfg,kg:8}),nr,totals,ex};
 };
 const A=mkEntry('a',100); ok(A.e.totais.caixas===3,'entry caixas '+A.e.totais.caixas); console.log('  uso',JSON.stringify(A.e.uso));
 const sold=F.soldBoxes([A.e],1); const eff2=F.effCatalog(sl.items,sold,null);
 const card=eff2.find(i=>Core.itemKey(i) in A.e.uso); ok(card.vendido>0&&card.estoque===Math.max(0,card.estoqueTab-card.vendido),'estoque desconta: '+card.comum+' '+card.estoqueTab+'→'+card.estoque);
 ok(F.soldBoxes([A.e],1,'a')[Object.keys(A.e.uso)[0]]===undefined,'excluir o próprio pedido ao editar');
 ok(Object.keys(F.soldBoxes([A.e],2)).length===0,'stocklist nova zera a conta');
 // conferência
 const chk=F.crossCheck({P:A.P,nota:{rows:A.nr,totals:A.totals,ex:A.ex},rows:A.rows,catalog:A.eff,cliente:{nome:'C',end:'a'},num:{invoice:100,atestado:5,nf:'123'},hist:[],curId:null,kg:8});
 ok(!chk.some(x=>x.lvl==='bad'),'conferência sem erro: '+chk.map(x=>x.lvl[0]).join('')); 
 const nr2=A.nr.map(r=>Object.assign({},r)); nr2[0].cxs=(nr2[0].cxs||0)+1;
 const chk2=F.crossCheck({P:A.P,nota:{rows:nr2,totals:Core.notinhaTotals(nr2,A.ex,cfg.valores),ex:A.ex},rows:A.rows,catalog:A.eff,cliente:{nome:'C',end:'a'},num:{invoice:100,atestado:5,nf:'123'},hist:[],curId:null,kg:8});
 ok(chk2.some(x=>x.lvl==='bad'&&/Caixas/.test(x.txt)),'detecta notinha com caixa a mais');
 const chk3=F.crossCheck({P:A.P,nota:{rows:A.nr,totals:A.totals,ex:A.ex},rows:A.rows,catalog:A.eff,cliente:{nome:'C',end:'a'},num:{invoice:100,atestado:5,nf:'123'},hist:[A.e],curId:null,kg:8});
 ok(chk3.some(x=>x.lvl==='bad'&&/Invoice nº 100/.test(x.txt)),'detecta invoice repetida');
 ok(!F.crossCheck({P:A.P,nota:{rows:A.nr,totals:A.totals,ex:A.ex},rows:A.rows,catalog:A.eff,cliente:{nome:'C',end:'a'},num:{invoice:100,atestado:5,nf:'123'},hist:[A.e],curId:'a',kg:8}).some(x=>x.lvl==='bad'),'editar o próprio não acusa duplicada');
 // mortalidade
 const m=F.mortalidade(A.e,{0:30,1:10}); const exp=F.r2(30*A.e.lines[0].preco+10*A.e.lines[1].preco); ok(m.credito===exp&&m.mortos===40,'crédito '+m.credito+' = '+exp);
 const nc=F.notaCorrigida(A.e,m); ok(Math.abs(nc.totals.total-(A.e.totais.total-exp))<0.005,'total corrigido '+nc.totals.total+' = '+(A.e.totais.total-exp));
 const bytes=await mk.notinhaXlsx({cliente:A.e.cliente,dataISO:'2026-11-04',nota:nc}); fs.mkdirSync(__dirname+'/../out/feat',{recursive:true}); fs.writeFileSync(__dirname+'/../out/feat/NOTINHA_CORRIGIDA.xlsx',Buffer.from(bytes));
 const w2=new ExcelJS.Workbook(); await w2.xlsx.load(Buffer.from(bytes)); const ws=w2.worksheets[0]; let found=0; ws.eachRow(r=>{ if(String(r.getCell(1).value||'').startsWith('CRÉDITO MORT')) found++; }); ok(found===2,'linhas de crédito na notinha: '+found);
 // saldo/situação
 A.e.mort={credito:exp,destino:'abater'}; ok(F.devido(A.e)===F.r2(A.e.totais.total-exp),'devido abate crédito');
 ok(F.situacao(A.e,'2026-11-05',7).key==='aguardando','situação aguardando'); ok(F.situacao(A.e,'2026-11-20',7).key==='atrasado','situação atrasado');
 A.e.pay.pago=F.devido(A.e); ok(F.situacao(A.e,'2026-11-20',7).key==='pago','pago integral');
 A.e.mort={credito:50,destino:'guardar'}; ok(F.creditoCliente([A.e],'cliente a')===50,'crédito guardado'); A.e.creditoAplicado=20; ok(F.creditoCliente([A.e],'CLIENTE A')===30,'crédito após aplicar 20');
 // crédito aplicado não mexe na GTA
 const rowsC=A.nr.concat([F.creditRow(30)]); ok(Core.notinhaTotals(rowsC,A.ex,cfg.valores).gta===A.totals.gta&&Math.abs(Core.notinhaTotals(rowsC,A.ex,cfg.valores).total-(A.totals.total-30))<0.005,'crédito aplicado desconta e não muda a GTA');
 // painel / romaneio / reposição / ibama
 const B=mkEntry('b',101); B.e.cliente={nome:'CLIENTE B',end:''}; B.e.dataISO='2026-11-03';
 const H=[A.e,B.e]; const pn=F.painel(H,'2026-11-01','2026-11-04','2026-11-04',7); ok(pn.pedidos===2&&pn.caixas===6,'painel pedidos/caixas'); ok(pn.especies[0].peixes>0,'painel espécies');
 const rm=F.romaneio(H,'2026-11-04'); ok(rm.pedidos.length===1&&rm.tot.caixas===3,'romaneio do dia'); 
 const rp=F.reposicao(H,F.effCatalog(sl.items,F.soldBoxes(H,1),null),{dias:30,meta:2,hoje:'2026-11-04'}); ok(rp.length>=2&&rp[0].repor>=0,'reposição '+rp.map(x=>x.comum+':'+x.repor).join(','));
 ok(F.ibamaRows(H,'2026-11-01','2026-11-30').length===4,'ibama linhas');
 ok(F.mergeHist([A.e],[B.e]).length===2,'merge histórico');
 // cobrança
 console.log('  msg:',F.msgCobranca(B.e,'Prestige Aquarium').slice(0,160));
 // nuvem: cifra
 const k=await F.deriveKeys('Prestige','senha123'); const k2=await F.deriveKeys('prestige','senha123'); ok(k.id===k2.id,'id estável (maiúscula/minúscula)');
 const c=await F.encryptJSON({a:1,hist:H},k.key); ok(!c.includes('CLIENTE'),'cifrado não mostra texto'); ok((await F.decryptJSON(c,k.key)).hist.length===2,'decifra');
 const kw=await F.deriveKeys('prestige','errada'); let bad=false; try{await F.decryptJSON(c,kw.key)}catch(e){bad=true} ok(bad&&kw.id!==k.id,'senha errada falha e muda o id');
 // invoice USD
 const P=A.P, base={P,cliente:A.e.cliente,cfg,num:{invoice:100,atestado:5,nf:'123'},dataISO:'2026-11-04',nota:{rows:A.nr,totals:A.totals,ex:A.ex,dia:'QUINTA-FEIRA'}};
 for(const [nm,mo] of [['brl',null],['en',{en:true}],['usd',{usd:true,taxa:5.5}]]){
   const b=await mk.invoiceXlsx(Object.assign({},base,{moeda:mo})); fs.writeFileSync(__dirname+`/../out/feat/INVOICE_${nm}.xlsx`,Buffer.from(b));
   const wx=new ExcelJS.Workbook(); await wx.xlsx.load(Buffer.from(b)); const s=wx.worksheets[0];
   console.log('  ',nm,'| C7',s.getCell('C7').value,'| N7',s.getCell('N7').value,'| O7',s.getCell('O7').value,'| N3',s.getCell('N3').value,'N4',s.getCell('N4').value,'| N9',s.getCell('N9').value,'O9',s.getCell('O9').result??s.getCell('O9').value);
 }
 const ub=await mk.invoiceXlsx(Object.assign({},base,{moeda:{usd:true,taxa:5.5}})); const sx=await (await JSZip.loadAsync(ub)).file('xl/worksheets/sheet1.xml').async('string');
 const tot=sx.match(/<f>SUM\(O9:P\d+\)<\/f><v>([\d.]+)/); const exp$=base.P.L.reduce((a,l)=>a+Math.round(l.peixes*Math.round(l.it.preco/5.5*10000)/10000*100)/100,0);
 ok(tot&&Math.abs(+tot[1]-exp$)<0.01,'total USD '+(tot&&tot[1])+' ≈ '+exp$.toFixed(2)+' (R$ '+P.valor+' / 5,5 = '+(P.valor/5.5).toFixed(2)+')');
 console.log(fail?'\n'+fail+' FALHA(S)':'\nTUDO OK'); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
