const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await (await b.newContext()).newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));
await p.goto('http://localhost:8765/index.html');await p.setInputFiles('#fStock','test/stocklist.xlsx');await p.waitForFunction(()=>__app.S.catalog.length>0);
await p.click('#txt');await p.keyboard.type('1 cx Rodostomus\n2 cx cardinal com 500 un\nMeia cx borboleta\nMeia cx neon verde',{delay:10});
await p.waitForFunction(()=>__app.S.rows.length===4,null,{timeout:5000});console.log('linhas na conferência sem clicar:',await p.evaluate(()=>__app.S.rows.length),errs);await b.close()})();
