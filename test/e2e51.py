import sys, os; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e51/'; os.makedirs(OUT,exist_ok=True)
fails=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1500,'height':950},service_workers='block').new_page()
    pg.on('dialog',lambda d:d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(700)
    js="""()=>{const rx=/[\\u2708\\u{1F69A}\\u{1F41F}\\u{1F4CE}\\u2709\\u{1F4C4}\\u{1F3A4}\\u{1F50D}\\u{1F50E}\\u{1F441}\\u{1F5A8}\\u{1F389}\\u2705]/u;
      const bad=[];document.querySelectorAll('main button, main h1, main h2, main h3, main summary, main label, main .chip, main .xchip, header button').forEach(e=>{if(e.closest('[hidden]'))return;const t=e.textContent;if(rx.test(t))bad.push(t.trim().slice(0,50));if(e.tagName==='BUTTON'&&e.querySelector('svg'))bad.push('svg:'+t.trim().slice(0,40));});return bad}"""
    for v in ['hoje','pedido','exp','mapa','embarque','frete','hist','financeiro','clientes','painel','relat','estoque','tarefas']:
        pg.evaluate("v=>PP.go(v)",v); pg.wait_for_timeout(500)
        bad=pg.evaluate(js); print(v,bad)
        if bad: fails.append((v,bad))
        if v in('hoje','hist','exp'): pg.screenshot(path=OUT+v+'.png')
    for t in ['nfs','pesc','verificar']:
        pg.evaluate("PP.go('mapa')"); pg.wait_for_timeout(300)
        try: pg.click('[data-tab=%s]'%t); pg.wait_for_timeout(300)
        except Exception as e: pass
        bad=pg.evaluate(js); print('mapa/'+t,bad)
        if bad: fails.append(('mapa/'+t,bad))
print('FALHAS',fails or 'nenhuma'); sys.exit(1 if fails else 0)
