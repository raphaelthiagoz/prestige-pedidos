const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await (await b.newContext({serviceWorkers:'block'})).newPage();
const seen=[];await p.route('**/rest/v1/pp_sync*',r=>{seen.push(r.request().headers());r.fulfill({json:[]})});
await p.goto('http://localhost:8765/index.html');
for(const key of ['sb_publishable_abc','eyJhbGciOi.x.y']){seen.length=0;
 await p.evaluate(async k=>{await PP.Features.cloudPull(fetch.bind(window),{url:'https://x.supabase.co',key:k,esp:'e'},{id:'abc',key:null})},key).catch(e=>console.log('E',e.message));
 console.log(key,'->',seen[0]&&{apikey:seen[0].apikey,auth:seen[0].authorization});}
await b.close();})();
