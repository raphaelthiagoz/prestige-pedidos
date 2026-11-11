const { chromium } = require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const p=await (await b.newContext({viewport:{width:1250,height:900}})).newPage();
 const errs=[]; p.on('pageerror',e=>errs.push('PAGE '+e)); p.on('console',m=>{if(m.type()==='error'&&!/ERR_|Failed to load resource/.test(m.text()))errs.push(m.text())});
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(()=>PP.go('pedido'));
 await p.setInputFiles('#fStock','test/stocklist.xlsx'); await p.waitForFunction(()=>__app.S.catalog.length>0);
 // 1. print -> OCR
 const t0=Date.now(); await p.setInputFiles('#fImg','test/print_pedido.png');
 await p.waitForFunction(()=>__app.S.rows.length>0,null,{timeout:120000});
 console.log('OCR',Math.round((Date.now()-t0)/1000)+'s |',await p.innerText('#imgmsg')); console.log('texto lido:\n'+await p.inputValue('#txt'));
 console.log(await p.evaluate(()=>__app.S.rows.map(r=>{const it=__app.Core.byId(__app.S.catalog,r.sel);return (it?it.comum+'/'+it.caixa:'—')+' '+r.mode+' '+r.qty}).join(' | ')));
 await p.screenshot({path:'test/s_conf.png',fullPage:true});
 // 2. ordenar: arrastar última linha para o topo
 const first=()=>p.evaluate(()=>__app.Core.byId(__app.S.catalog,__app.S.rows[0].sel).comum);
 console.log('1º antes:',await first());
 const n=await p.evaluate(()=>__app.S.rows.length);
 await p.dragAndDrop(`[data-grip="${n-1}"]`,'tr[data-i="0"]'); console.log('1º após arrastar:',await first());
 await p.click('[data-mv="1"][data-i="0"]'); console.log('após ▼:',await p.evaluate(()=>__app.S.rows.map(r=>__app.Core.byId(__app.S.catalog,r.sel).comum).join(', ')));
 await p.click('#ordSave'); console.log(await p.innerText('#ordMsg'));
 // novo pedido de texto usa a ordem
 await p.fill('#txt','1 cx rodostomus\n1 cx limpa vidro'); await p.click('#ler');
 console.log('ordem padrão aplicada:',await p.evaluate(()=>__app.S.rows.map(r=>__app.Core.byId(__app.S.catalog,r.sel).comum).join(', ')));
 await p.reload(); console.log("após reload bg",await p.evaluate(()=>getComputedStyle(document.body).backgroundColor));
 console.log('erros',errs); await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
