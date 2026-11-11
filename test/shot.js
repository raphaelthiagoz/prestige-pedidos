const { chromium } = require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const p=await (await b.newContext({viewport:{width:1200,height:900}})).newPage();
 await p.goto('http://localhost:8765/index.html');
 await p.setInputFiles('#fStock','test/stocklist.xlsx'); await p.waitForFunction(()=>__app.S.catalog.length>0);
 await p.click('#cliNovo'); await p.fill('#cliNome','CEZAR APARECIDO'); await p.fill('#nf','000008960');
 await p.fill('#txt',"1000 neon cardinal\n750 rodostomus\n900 limpa vidro\n300 corydoras schwartzi\n100 corydoras sodalis @1\n100 corydoras elegans");
 await p.click('#ler'); await p.click('[data-tab=notinha]');
 await p.evaluate(()=>{document.getElementById('config').open=false});
 await p.screenshot({path:'test/desktop.png',fullPage:true});
 await b.close();
})();
