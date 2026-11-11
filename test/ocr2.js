const { chromium } = require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const p=await (await b.newContext({viewport:{width:1250,height:900}})).newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(''+e));
 await p.goto('http://localhost:8765/index.html');
 await p.setInputFiles('#fStock','test/stocklist.xlsx'); await p.waitForFunction(()=>__app.S.catalog.length>0);
 for (const f of process.argv.slice(2)){
  await p.evaluate(()=>{__app.S.rows=[];document.getElementById('txt').value=''});
  await p.setInputFiles('#fImg',f); await p.waitForFunction(()=>/Peguei|Não/.test(document.getElementById('imgmsg').textContent),null,{timeout:120000});
  console.log('==',f); console.log('bruto:\n'+(await p.evaluate(()=>__app.S.ocrRaw)).join('\n')); console.log('msg:',await p.innerText('#imgmsg')); console.log('texto:\n'+await p.inputValue('#txt'));
  console.log(await p.evaluate(()=>__app.S.rows.map(r=>{const it=__app.Core.byId(__app.S.catalog,r.sel);return (it?it.comum+'/'+it.caixa:'SEM')+' '+r.mode+' '+r.qty}).join(' | ')));
 }
 console.log('erros',errs); await b.close();
})();
