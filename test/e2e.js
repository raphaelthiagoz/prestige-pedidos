const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:1250,height:900},acceptDownloads:true}); const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push('PAGE '+e)); p.on('console',m=>{if(m.type()==='error'&&!/ERR_|Failed to load resource/.test(m.text()))errs.push(m.text())});
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(()=>PP.go('pedido'));
 await p.setInputFiles('#fStock','test/stocklist.xlsx'); await p.waitForFunction(()=>__app.S.catalog.length>0);
 console.log('catálogo:',await p.evaluate(()=>__app.S.catalog.length), await p.innerText('#catinfo'));
 // cliente
 await p.click('#cliNovo'); await p.fill('#cliNome','AQUAPRIME'); await p.fill('#cliEnd','JOINVILLE - SC');
 await p.fill('#nf','000008950');
 await p.fill('#txt',"300 cardinal @1\n100 neon verde @1\n120 rodostomus @1\n100 limpa vidro @2\n10 banjo @2\n30 corydoras schwartzi @2\n30 corydoras sodalis @2\n30 corydoras incolicana @3\n20 corydoras elegans @3\n10 limpa fundo verde @3\n20 piaba @3\nlinha sem número");
 await p.click('#ler');
 console.log('soma:',(await p.innerText('#sum')).replace(/\n/g,' '));
 console.log('ignorado:',await p.innerText('#ignored'));
 await p.uncheck('#temAt');
 console.log('soma sem atestado:',(await p.innerText('#sum')).replace(/\n/g,' '));
 // notinha editável: mudar qtd da primeira linha
 await p.click('[data-tab=notinha]');
 await p.fill('[data-nr="0"][data-f="qtd"]','400');
 console.log('após editar notinha:',(await p.innerText('#sum')).replace(/\n/g,' '), '| foco ok:',await p.evaluate(()=>document.activeElement&&document.activeElement.dataset.f));
 await p.fill('[data-nr="0"][data-f="qtd"]','300');
 // downloads individuais
 for (const [tab,kind] of [['invoice','invoice'],['atestado','atestado'],['packing','packing'],['etiquetas','etiquetas'],['notinha','notinha']]){
   await p.click(`[data-tab=${tab}]`); const [d]=await Promise.all([p.waitForEvent('download'),p.click(`[data-dl=${kind}]`)]);
   await d.saveAs('test/dl/'+d.suggestedFilename()); console.log('baixou',d.suggestedFilename());
 }
 const [z]=await Promise.all([p.waitForEvent('download'),p.click('#zip')]); await z.saveAs('test/dl/'+z.suggestedFilename()); console.log('zip',z.suggestedFilename());
 console.log('numeração salva:',await p.evaluate(()=>JSON.stringify(__app.S.cfg.numeracao)));
 // recarregar: persistência
 await p.reload(); console.log('após recarregar:',await p.innerText('#catinfo'),'| clientes:',await p.evaluate(()=>__app.S.clientes.length),'| inv:',await p.inputValue('#inv'));
 // pedido por planilha do cliente
 await p.setInputFiles('#fPedido','test/pedido_cliente.xlsx'); await p.waitForFunction(()=>__app.S.rows.length>0);
 console.log('planilha:',await p.innerText('#pedmsg'),'|',(await p.innerText('#sum')).replace(/\n/g,' '));
 // celular
 await p.setViewportSize({width:400,height:800});
 console.log('overflow400:',await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'erros:',errs);
 await p.screenshot({path:'test/shot.png',fullPage:true});
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
