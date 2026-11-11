const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await (await b.newContext({viewport:{width:1280,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8765/index.html');await p.setInputFiles('#fStock','test/stocklist.xlsx');await p.waitForFunction(()=>__app.S.catalog.length>0);
await p.click('#cliNovo');
const t0=Date.now();await p.setInputFiles('#fImg',['test/print_pedido.png','test/foto_tabela2.jpg']);
await p.waitForFunction(()=>document.querySelectorAll('#thumbs .thumb span').length===2&&[...document.querySelectorAll('#thumbs .thumb span')].every(s=>!/lendo/.test(s.textContent)),null,{timeout:150000});
console.log(Math.round((Date.now()-t0)/1000)+'s');console.log('miniaturas:',await p.evaluate(()=>[...document.querySelectorAll('#thumbs .thumb span')].map(s=>s.textContent)));
console.log(await p.innerText('#imgmsg'));console.log('texto:\n'+await p.inputValue('#txt'));console.log('linhas conferência',await p.evaluate(()=>__app.S.rows.length),'| bruto visível:',await p.isVisible('#ocrRaw'));
await p.screenshot({path:'test/s_ocr3.png',fullPage:true});console.log('erros',errs);await b.close();})();
