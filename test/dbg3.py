import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); m=b.new_context(viewport={'width':390,'height':800},service_workers='block').new_page()
    m.goto('http://localhost:8765/index.html'); m.evaluate(SEED); m.evaluate("sessionStorage.setItem('pp.asShown','1')"); m.reload(); m.wait_for_timeout(600)
    for v in ['embarque','frete','hist']:
        m.evaluate(f"PP.go('{v}')"); m.wait_for_timeout(200)
        print(v, m.evaluate("""()=>{const W=innerWidth,o=[];document.querySelectorAll('main *').forEach(e=>{const r=e.getBoundingClientRect();if(r.right>W+1&&r.width>0){let a=e,sc=false;while(a&&a!==document.body){const s=getComputedStyle(a);if(/(auto|scroll|hidden)/.test(s.overflowX)&&a!==e){sc=true;break}a=a.parentElement}if(!sc)o.push(e.tagName+'#'+e.id+'.'+(e.className+'').slice(0,30)+' '+Math.round(r.right))}});return [document.documentElement.scrollWidth,o.slice(0,6)]}"""))
