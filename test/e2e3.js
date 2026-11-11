const { chromium } = require('playwright'); const fs=require('fs'); const ExcelJS=require('exceljs'); const JSZip=require('jszip');
let fail=0; const ok=(c,m)=>{console.log((c?'  ok  ':' FALHA ')+m); if(!c) fail++;};
(async()=>{
 const mock=await require('./mock_supabase')(9011);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:1280,height:900},acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push('PAGE '+e)); p.on('console',m=>{if(m.type()==='error'&&!/ERR_|Failed to load resource|favicon/.test(m.text()))errs.push(m.text())});
 p.on('dialog',d=>d.accept());
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(()=>PP.go('pedido'));
 await p.setInputFiles('#fStock','test/stocklist.xlsx'); await p.waitForFunction(()=>__app.S.catalog.length>0);
 // cliente
 await p.click('#cliNovo'); await p.fill('#cliNome','NATALIA VIEIRA'); await p.fill('#cliEnd','RUA A 10 · BELO HORIZONTE = MG'); await p.fill('#nf','000009001');
 await p.fill('#txt','2 cx neon cardinal\n1 cx rodostomus\n250 borboleta listrada @1\n600 neon verde @1'); await p.waitForFunction(()=>__app.S.rows.length>=3);
 const info=()=>p.evaluate(()=>{const P=__app.currentPlan();return {cx:P.total,peixes:P.peixes,valor:P.valor,rows:__app.S.rows.length}});
 console.log('pedido 1',JSON.stringify(await info()));
 // conferência automática visível
 console.log('conferência:',(await p.innerText('#checkBox')).replace(/\n+/g,' | ').slice(0,260));
 ok(await p.isVisible('#checkBox'),'painel de conferência aparece');
 // preço por item
 await p.fill('[data-k="preco"][data-i="0"]','0.55'); await p.press('[data-k="preco"][data-i="0"]','Tab');
 ok(await p.evaluate(()=>__app.S.rows[0].preco===0.55),'preço só deste pedido'); ok((await p.innerText('#doc')).includes('0,55'),'invoice mostra 0,55');
 // rascunho: recarrega
 await p.waitForTimeout(700); await p.reload(); await p.evaluate(()=>PP.go('pedido')); await p.waitForFunction(()=>__app.S.rows.length>=3);
 ok(await p.inputValue('#nf')==='000009001' && (await p.inputValue('#cliNome'))==='NATALIA VIEIRA','rascunho recuperado após recarregar'); ok(await p.evaluate(()=>__app.S.rows[0].preco===0.55),'preço do item recuperado');
 console.log('  aviso:',await p.innerText('#draftBar'));
 // baixa o zip -> salva no histórico
 const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#zip')]); const zp='/tmp/e3.zip'; await dl.saveAs(zp);
 const z=await JSZip.loadAsync(fs.readFileSync(zp)); console.log('  zip:',Object.keys(z.files).join(', '));
 ok(await p.evaluate(()=>__app.S.hist.length===1&&__app.S.curId),'pedido salvo no histórico'); 
 const chk=await p.innerText('#checkBox'); console.log('  conferência pós-zip:',chk.replace(/\n+/g,' | ').slice(0,400)); ok(/aberto e conferido/.test(chk),'arquivos reabertos e conferidos');
 // estoque desconta em novo pedido
 await p.click('#novoPed'); await p.fill('#txt','1 cx neon cardinal'); await p.waitForFunction(()=>__app.S.rows.length>=1);
 const st=await p.evaluate(()=>{const c=__app.PP.cat().find(i=>/CARDINAL/i.test(i.comum)&&i.caixa===500);return {tab:c.estoqueTab,resta:c.estoque,v:c.vendido}}); console.log('  cardinal',JSON.stringify(st)); ok(st.v===2&&st.resta===st.tab-2,'estoque restante considera pedido salvo');
 // pedido que passa do estoque
 await p.fill('#txt',`${st.resta+1} cx neon cardinal`); await p.waitForTimeout(900);
 ok(/Pede/.test(await p.innerText('#conf tbody')),'avisa que pede mais do que há ('+(await p.innerText('#conf tbody tr .chip')).trim()+')');
 // histórico
 await p.click('[data-view="hist"]'); ok((await p.innerText('#vHist')).includes('NATALIA VIEIRA'),'histórico lista o pedido');
 await p.click('[data-h="open"]'); await p.fill('[data-dead="0"]','40'); await p.fill('[data-dead="1"]','10');
 console.log('  crédito:',(await p.innerText('#hdet')).match(/Crédito: R\$ [\d.,]+/)[0]);
 await p.check('input[name=mdest][value=guardar]'); await p.click('[data-h="mortSave"]');
 ok(await p.evaluate(()=>__app.S.hist[0].mort&&__app.S.hist[0].mort.destino==='guardar'),'mortalidade aplicada');
 const [dn]=await Promise.all([p.waitForEvent('download'),p.click('[data-h="mortNota"]')]); await dn.saveAs('/tmp/nc.xlsx');
 const wb=new ExcelJS.Workbook(); await wb.xlsx.readFile('/tmp/nc.xlsx'); let n=0; wb.worksheets[0].eachRow(r=>{if(String(r.getCell(1).value||'').startsWith('CRÉDITO'))n++}); ok(n>=1,'notinha corrigida baixada com '+n+' linha(s) de crédito');
 await p.selectOption('#pst','pago'); ok(await p.evaluate(()=>__app.S.hist[0].pay.status==='pago'&&__app.S.hist[0].pay.pago>0),'marcado como pago (valor preenchido)');
 await p.screenshot({path:'test/s_hist.png',fullPage:true});
 // crédito vai para o próximo pedido
 await p.click('[data-view="pedido"]'); ok(await p.isVisible('#credBox'),'cliente com crédito: caixa de aplicar aparece');
 await p.fill('#txt','1 cx rodostomus'); await p.waitForFunction(()=>__app.S.rows.length===1&&__app.S.rows[0].boxes===1); await p.check('#credUse');
 const nt=await p.evaluate(()=>{const o=__app.order(__app.currentPlan());return {rows:o.nota.rows.map(r=>r.nome+':'+r.unit),total:o.nota.totals.total,gta:o.nota.totals.gta}}); console.log('  notinha com crédito',JSON.stringify(nt)); ok(nt.rows.some(r=>/CRÉDITO/.test(r)),'linha de crédito na notinha');
 // USD
 await p.selectOption('#moeda','usd'); await p.fill('#taxa','5.5'); await p.waitForTimeout(100); ok((await p.innerText('#doc')).includes('US$'),'prévia em US$');
 const [d2]=await Promise.all([p.waitForEvent('download'),p.click('[data-dl="invoice"]')]); await d2.saveAs('/tmp/inv_usd.xlsx'); const w2=new ExcelJS.Workbook(); await w2.xlsx.readFile('/tmp/inv_usd.xlsx'); ok(w2.worksheets[0].getCell('N7').value==='UNIT PRICE US$','invoice USD baixada: '+w2.worksheets[0].getCell('N7').value);
 ok(await p.evaluate(()=>__app.S.hist.length===2),'segundo pedido salvo'); 
 // painel
 await p.click('[data-view="painel"]'); const pt=await p.innerText('#vPainel'); ok(/pedidos/.test(pt)&&/NATALIA/.test(pt),'painel mostra dados'); await p.screenshot({path:'test/s_painel.png',fullPage:true});
 // relatórios
 await p.click('[data-view="relat"]'); ok((await p.innerText('#vRelat')).includes('Total do dia'),'romaneio do dia lista pedidos');
 const [d3]=await Promise.all([p.waitForEvent('download'),p.click('[data-r="romX"]')]); await d3.saveAs('/tmp/rom.xlsx'); const w3=new ExcelJS.Workbook(); await w3.xlsx.readFile('/tmp/rom.xlsx'); ok(w3.worksheets[0].rowCount>=3,'romaneio .xlsx com '+w3.worksheets[0].rowCount+' linhas');
 const [d4]=await Promise.all([p.waitForEvent('download'),p.click('[data-r="ibX"]')]); await d4.saveAs('/tmp/ibama.xlsx'); ok(fs.statSync('/tmp/ibama.xlsx').size>3000,'IBAMA .xlsx baixado');
 await p.screenshot({path:'test/s_relat.png',fullPage:true});
 // estoque e reposição
 await p.click('[data-view="estoque"]'); const et=await p.innerText('#vEstoque'); ok(/estoque restante/i.test(et)&&/lista de reposição/i.test(et),'tela de estoque/reposição');
 const [d5]=await Promise.all([p.waitForEvent('download'),p.click('[data-e="stk"]')]); await d5.saveAs('/tmp/stk.xlsx');
 const w5=new ExcelJS.Workbook(); await w5.xlsx.readFile('/tmp/stk.xlsx'); const o5=Core5(w5); 
 function Core5(w){const C=require('../core.js');return C.parseStocklistWorksheet(w.worksheets[0]).items}
 const card=o5.find(i=>/CARDINAL/i.test(i.comum)&&i.caixa===500); console.log('  stocklist atualizada: cardinal estoque',card.estoque,'(tabela',st.tab,')'); ok(card.estoque<st.tab&&o5.length===66,'stocklist atualizada mantém 66 itens e desconta');
 await p.screenshot({path:'test/s_estoque.png',fullPage:true});
 // editar e repetir
console.log('DBG',await p.evaluate(()=>[__app.S.view,document.getElementById('vHist').hidden,document.getElementById('vHist').innerText.slice(0,300)]));
await p.click('[data-view="hist"]'); console.log('DBG2',await p.evaluate(()=>[document.querySelectorAll('#histTb tbody tr').length,document.querySelector('#histTb tbody tr')&&document.querySelector('#histTb tbody tr').innerText]));
 await p.click('[data-view="hist"]'); await p.click('#histTb tbody tr >> nth=-1 >> [data-h="repeat"]'); await p.waitForFunction(()=>__app.S.rows.length>0&&!__app.S.curId);
 const rp=await p.evaluate(()=>({rows:__app.S.rows.length,inv:document.getElementById('inv').value,nf:document.getElementById('nf').value,cur:__app.S.curId})); console.log('  repetir',JSON.stringify(rp)); ok(rp.rows>=2&&rp.nf===''&&rp.cur===null,'repetir pedido: itens carregados, NF vazia, pedido novo');
 await p.click('[data-view="hist"]'); await p.click('#histTb tbody tr >> nth=-1 >> [data-h="edit"]'); await p.waitForFunction(()=>__app.S.curId);
 ok(await p.evaluate(()=>document.getElementById('nf').value==='000009001'&&__app.S.rows.some(r=>r.preco===0.55)),'editar pedido: NF e preço combinado voltam'); await p.screenshot({path:'test/s_edit.png',fullPage:true});
 // numeração
 await p.click('[data-view="pedido"]'); await p.evaluate(()=>{document.getElementById('config').open=true;PP.cfgTab('val')}); await p.fill('[data-path="numeracao.ultimaInvoice"]','500'); await p.press('[data-path="numeracao.ultimaInvoice"]','Tab');  await p.evaluate(()=>{document.getElementById('config').open=false});
 await p.click('#novoPed'); ok(await p.inputValue('#inv')==='501','numeração editável: próxima invoice 501');
 // nuvem
 await p.evaluate(()=>{document.getElementById('config').open=true;PP.cfgTab('dad')}); await p.fill('#syUrl','http://localhost:9011'); await p.fill('#syKey','chave'); await p.fill('#syEsp','Prestige'); await p.fill('#syPass','segredo!'); await p.click('#syConnect'); await p.waitForFunction(()=>/enviados|Conectado/.test(document.getElementById('syMsg').textContent),null,{timeout:20000});
 console.log('  nuvem:',await p.innerText('#syMsg')); const rows=Object.values(mock.db); ok(rows.length===1&&!rows[0].data.includes('NATALIA')&&rows[0].data.startsWith('v1.'),'nuvem recebeu dados cifrados');
 // segundo "computador": contexto novo
 const ctx2=await b.newContext({viewport:{width:1280,height:900}}); const p2=await ctx2.newPage(); p2.on('dialog',d=>d.accept()); await p2.goto('http://localhost:8765/index.html');
 await p2.evaluate(()=>{document.getElementById('config').open=true;PP.cfgTab('dad')}); await p2.fill('#syUrl','http://localhost:9011'); await p2.fill('#syKey','chave'); await p2.fill('#syEsp','prestige'); await p2.fill('#syPass','segredo!'); await p2.click('#syConnect');
 await p2.waitForFunction(()=>__app.S.hist.length===2,null,{timeout:20000}); ok(true,'segundo computador recebeu os 2 pedidos e '+(await p2.evaluate(()=>__app.S.catalog.length))+' itens da stocklist');
 await p2.fill('#syPass','errada'); await p2.click('#syConnect'); await p2.waitForFunction(()=>/Sem sincronizar|Conectado/.test(document.getElementById('syMsg').textContent)); 
 // PWA
 await p.waitForTimeout(500); ok(await p.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>!!r)),'service worker registrado'); ok((await (await p.request.get('http://localhost:8765/manifest.webmanifest')).ok()),'manifest');
 // backup
 await p.evaluate(()=>{localStorage.removeItem('pp.lastBackup');}); await p.reload(); ok(await p.isVisible('#bnBk'),'lembrete de backup aparece'); const [d6]=await Promise.all([p.waitForEvent('download'),p.click('#bnBk')]); await d6.saveAs('/tmp/bk.json'); const bk=JSON.parse(fs.readFileSync('/tmp/bk.json')); ok(bk.hist.length===2&&bk.stockFile,'backup leva histórico e stocklist'); ok(!(await p.isVisible('#bnBk')),'aviso some após backup');
 console.log('erros',errs); if(errs.length) fail++;
 console.log(fail?'\n'+fail+' FALHA(S)':'\nTUDO OK'); await b.close(); mock.close(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
