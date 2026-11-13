import sys, json; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
PORT='8765'
VIEWS=['hoje','pedido','exp','mapa','embarque','frete','hist','financeiro','clientes','painel','relat','estoque','tarefas']
JS="""()=>{
 const vis=e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'};
 const root=document.querySelector('main, .wrap, body');
 const act=[...document.querySelectorAll('main button, main a.btn, main [role=button], main .filebtn, main select, main input:not([type=hidden])')].filter(vis);
 const btn=act.filter(e=>e.tagName==='BUTTON'||e.classList.contains('filebtn'));
 const small=act.filter(e=>{const r=e.getBoundingClientRect();return r.height<36||r.width<36}).length;
 const fs=[...document.querySelectorAll('main *')].filter(e=>vis(e)&&e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1));
 const tiny=fs.filter(e=>parseFloat(getComputedStyle(e).fontSize)<12).length;
 // contraste: cor do texto vs fundo efetivo
 const lum=c=>{const m=c.match(/[\\d.]+/g).map(Number);const a=m[3]===undefined?1:m[3];const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return {l:.2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2]),a}};
 const bg=e=>{while(e){const c=getComputedStyle(e).backgroundColor;const m=c.match(/[\\d.]+/g);if(m&&(m[3]===undefined||+m[3]>.5))return c;e=e.parentElement}return 'rgb(10,14,17)'};
 let low=0,lowEx=[];
 fs.slice(0,600).forEach(e=>{const cs=getComputedStyle(e);const f=lum(cs.color),b=lum(bg(e));const L1=Math.max(f.l,b.l),L2=Math.min(f.l,b.l);const cr=(L1+.05)/(L2+.05);if(cr<4.5&&parseFloat(cs.fontSize)<18){low++;if(lowEx.length<3)lowEx.push((e.textContent||'').trim().slice(0,30)+' '+cr.toFixed(1))}});
 const text=(document.querySelector('main')||document.body).innerText.length;
 const rows=[...document.querySelectorAll('main .row, main .btns, main .epa, main td')].map(r=>[...r.querySelectorAll(':scope > button')].filter(vis).length).reduce((a,b)=>Math.max(a,b),0);
 return {buttons:btn.length,inputs:act.length-btn.length,small,tiny,low,lowEx,textChars:text,maxBtnRow:rows,overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,h:document.documentElement.scrollHeight};
}"""
out={}
with sync_playwright() as p:
    b=p.chromium.launch()
    for tag,w,h,dsf in [('d',1440,900,1),('m',390,800,2)]:
        ctx=b.new_context(viewport={'width':w,'height':h},device_scale_factor=dsf,service_workers='block',is_mobile=(tag=='m'),has_touch=(tag=='m')); pg=ctx.new_page()
        pg.on('dialog', lambda d: d.accept())
        pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_function('window.PP'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.evaluate("PP.store.set('bkSnooze',Date.now()+9e9);PP.store.set('guiaVisto',1)"); pg.reload(); pg.wait_for_timeout(1500)
        for v in VIEWS:
            pg.evaluate(f"PP.go('{v}')"); pg.wait_for_timeout(700)
            m=pg.evaluate(JS); out[f'{tag}:{v}']=m
            pg.screenshot(path=f'out/audit/{tag}_{v}.png',full_page=True)
        ctx.close()
    b.close()
json.dump(out,open('out/audit/metrics.json','w'),ensure_ascii=False,indent=1)
for k,v in out.items(): print(k,{x:v[x] for x in ('buttons','small','tiny','low','maxBtnRow','overflowX','h','textChars')})
