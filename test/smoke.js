const { chromium } = require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}); const p=await (await b.newContext({acceptDownloads:true})).newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{if(m.type()==='error'&&!/ERR_|Failed to load resource/.test(m.text()))errs.push(m.text())});
 await p.goto('http://localhost:8766/index.html');
 await p.setInputFiles('#fStock','test/stocklist.xlsx'); await p.waitForFunction(()=>__app.S.catalog.length>0);
 await p.click('#cliNovo'); await p.fill('#cliNome','TESTE'); await p.fill('#txt','250 borboleta listrada\n300 limpa vidro'); await p.click('#ler');
 const [z]=await Promise.all([p.waitForEvent('download'),p.click('#zip')]);
 console.log('pacote zipado OK:',z.suggestedFilename(),'| soma:',(await p.innerText('#sum')).replace(/\n/g,' '),'| erros:',errs);
 await b.close();
})();
