const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const c=await b.newContext({service_workers:'block'});const p=await c.newPage();
await p.goto('http://localhost:8765/vendor/logo.png');
await p.addScriptTag({url:'/vendor/pdf.min.js'});
const fs=require('fs');const buf=fs.readFileSync('/home/claude/prestige-pedidos/test/fx/modelo_ams.pdf').toString('base64');
const r=await p.evaluate(async(b64)=>{pdfjsLib.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.min.js';
const u=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const d=await pdfjsLib.getDocument({data:u}).promise;const out=[];
for(let n=1;n<=d.numPages;n++){const pg=await d.getPage(n);const tc=await pg.getTextContent();const an=await pg.getAnnotations();
out.push({n,view:pg.view,its:tc.items.filter(i=>i.str.trim()).map(i=>[i.str,+i.transform[4].toFixed(1),+i.transform[5].toFixed(1),+i.width.toFixed(1)]),hl:an.filter(a=>a.subtype==='Highlight').map(a=>({q:a.quadPoints&&Array.from(a.quadPoints).map(x=>+(+x).toFixed(1)),rect:a.rect.map(x=>+x.toFixed(1))}))});}
return out;},buf);
fs.writeFileSync('/tmp/pl/probe.json',JSON.stringify(r));
for(const pg of r){console.log('PAGE',pg.n,pg.view);console.log(' HL',JSON.stringify(pg.hl.map(h=>h.rect)));
 const ys=new Set(pg.hl.map(h=>Math.round(h.rect[1])));
 pg.its.filter(i=>pg.hl.some(h=>i[2]>=h.rect[1]-3&&i[2]<=h.rect[3]+3)).forEach(i=>console.log('  ',JSON.stringify(i)));}
await b.close();})();
