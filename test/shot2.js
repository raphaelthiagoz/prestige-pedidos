const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await (await b.newContext({viewport:{width:1250,height:900}})).newPage();
await p.goto('http://localhost:8765/index.html');await p.setInputFiles('#fStock','test/stocklist.xlsx');await p.waitForFunction(()=>__app.S.catalog.length>0);
await p.evaluate(()=>{document.getElementById('config').open=false});
await p.setInputFiles('#fImg','test/foto_tabela2.jpg');await p.waitForFunction(()=>/Peguei/.test(document.getElementById('imgmsg').textContent));
await p.locator('#h1').scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/prev/ocr_tabela.png',fullPage:true,clip:{x:0,y:0,width:1250,height:1500}});await b.close()})();
