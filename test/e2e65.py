import sys
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1400,'height':950}, accept_downloads=True, service_workers='block').new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_timeout(500); pg.evaluate("document.getElementById('config').open=false")
    # situação dele: histórico com 16, 18 e 19; a 017 foi pulada
    pg.click('#nav button[data-view="exp"]'); pg.set_input_files('#xFile','test/exp/stocklist_miami.xlsx'); pg.wait_for_timeout(1200)
    pg.click('#xNum summary'); pg.fill('#xLast','15'); pg.dispatch_event('#xLast','change'); pg.wait_for_timeout(200)
    for n in (16,18,19):
        if n==16:
            pg.evaluate("document.querySelector('#xLast')&&0")
        pg.click('[data-xa=save]'); pg.wait_for_timeout(300)
        if n!=19: pg.click('[data-xa=novo]'); pg.wait_for_timeout(300)
        if n==16:
            pg.fill('#xNumEd','18'); pg.dispatch_event('#xNumEd','change'); pg.wait_for_timeout(200)
        if n==18:
            pg.fill('#xNumEd','19'); pg.dispatch_event('#xNumEd','change'); pg.wait_for_timeout(200)
    hist=pg.evaluate("JSON.parse(localStorage.getItem('pp.exphist')).map(e=>e.n)")
    ok(hist==[16,18,19],'preparação: histórico com 16, 18 e 19 (tem %s)'%hist)
    pg.click('[data-xa=novo]'); pg.wait_for_timeout(300)
    ok('020/2026' in pg.inner_text('.xbig'),'nova exportação começa na 020')
    ok(pg.locator('#xNumEd').count()==1,'existe o campo "Trocar nº"')
    t=pg.inner_text('#vExp')
    ok('Sem registro no histórico' in t and pg.locator('[data-xa=usarnum][data-n="17"]').count()==1,'aparece o atalho para o número pulado 017')
    # digitar o número direto
    pg.fill('#xNumEd','17'); pg.dispatch_event('#xNumEd','change'); pg.wait_for_timeout(300)
    ok('017/2026' in pg.inner_text('.xbig'),'digitar 17 troca o número da exportação para 017/2026')
    ok(pg.evaluate("JSON.parse(localStorage.getItem('pp.expcfg')).last")==19,'trocar o número NÃO mexe na "última usada" (continua 019)')
    # número repetido é recusado
    pg.fill('#xNumEd','18'); pg.dispatch_event('#xNumEd','change'); pg.wait_for_timeout(300)
    ok('já existe' in pg.inner_text('#xMsg') and '017/2026' in pg.inner_text('.xbig'),'número que já existe (018) é recusado e fica 017')
    pg.fill('#xNumEd','17'); pg.dispatch_event('#xNumEd','change'); pg.wait_for_timeout(200)
    pg.click('[data-xa=save]'); pg.wait_for_timeout(400)
    hist=pg.evaluate("JSON.parse(localStorage.getItem('pp.exphist')).map(e=>e.n)")
    ok(17 in hist and len(hist)==4,'salvar grava a 017 no histórico: %s'%hist)
    ok(pg.evaluate("JSON.parse(localStorage.getItem('pp.expcfg')).last")==19,'a "última usada" continua 019 (a próxima será 020)')
    pg.click('[data-xa=novo]'); pg.wait_for_timeout(300)
    ok('020/2026' in pg.inner_text('.xbig'),'a próxima nova exportação continua sendo a 020')
    ok(pg.locator('[data-xa=usarnum][data-n="17"]').count()==0,'depois de salva, a 017 sai de "Sem registro"')
    # atalho cria em branco com o número
    pg.evaluate("localStorage.setItem('pp.exphist',JSON.stringify(JSON.parse(localStorage.getItem('pp.exphist')).filter(e=>e.n!==17)));PP.exp&&PP.exp.reload&&PP.exp.reload()"); pg.reload(); pg.wait_for_timeout(600)
    pg.click('#nav button[data-view="exp"]'); pg.wait_for_timeout(300)
    if pg.locator('[data-xa=usarnum][data-n="17"]').count():
        pg.click('[data-xa=usarnum][data-n="17"]'); pg.wait_for_timeout(300)
        ok('017/2026' in pg.inner_text('.xbig'),'clicar em 017 em "Sem registro" abre a exportação já com o número 017')
    else: ok(False,'atalho 017 não apareceu depois de recarregar')
    # renumerar uma exportação já salva
    pg.click('[data-xa=save]'); pg.wait_for_timeout(300)
    pg.fill('#xNumEd','21'); pg.dispatch_event('#xNumEd','change'); pg.wait_for_timeout(300)
    hist=pg.evaluate("JSON.parse(localStorage.getItem('pp.exphist')).map(e=>e.n)")
    ok(21 in hist and 17 not in hist,'trocar o número de uma exportação já salva renumera no histórico: %s'%hist)
    ok(pg.evaluate("JSON.parse(localStorage.getItem('pp.expcfg')).last")==21,'e a "última usada" sobe para 021')
    ok(not errs,'sem erro de JS: '+str(errs))
    b.close()
print('FALHAS:',fails) if fails else print('TUDO OK')
sys.exit(1 if fails else 0)
