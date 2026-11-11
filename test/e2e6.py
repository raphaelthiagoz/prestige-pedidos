import json
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e/'
ok=lambda c,m: print(('  ok  ' if c else '  FAIL ')+m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':1000}, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    calls=[]
    def h(route):
        u=route.request.url; calls.append(u)
        # primeiro dia (04-11) sem cotação, depois com
        if '11-04-2026' in u: route.fulfill(status=200,content_type='application/json',body='{"value":[]}')
        else: route.fulfill(status=200,content_type='application/json',body='{"value":[{"cotacaoCompra":5.4772,"cotacaoVenda":5.4778,"dataHoraCotacao":"2026-11-03 13:06:17.0"}]}')
    pg.route('**/olinda.bcb.gov.br/**',h)
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500); pg.evaluate("document.getElementById('config').open=false")
    ok(pg.locator('#nav button[data-view="exp"]').count()==1 and pg.locator('#nav button[data-view="pedido"]').count()==1,'menu tem Nacional e Exportação')
    pg.click('#nav button[data-view="exp"]'); pg.set_input_files('#xFile','test/exp/stocklist_miami.xlsx'); pg.wait_for_timeout(1200)
    pg.click('[data-xa="ptax"]'); pg.wait_for_timeout(800)
    print('  ptax:', pg.inner_text('#xPtmsg'), len(calls),'chamadas')
    ok(pg.input_value('[data-xp="conv.rate"]')=='5.4772','PTAX mock preenchida (recuou 1 dia)')
    # digitação mantém foco e atualiza prévia
    pg.click('[data-xi="0"][data-xk="boxes"]'); pg.keyboard.press('End'); pg.keyboard.type('5')
    ok(pg.evaluate("document.activeElement.dataset.xk")=='boxes','foco mantido ao digitar')
    ok('85' in pg.inner_text('#xTot') or '8' in pg.inner_text('#xTot'),'total atualizou')
    print('  ', pg.inner_text('#xTot').replace('\n',' '))
    # BRL preview
    pg.click('button.primary[data-xa="prev"]'); pg.wait_for_timeout(400); pg.click('[data-xiv="brl"]'); pg.wait_for_timeout(200); pg.locator('#xPrev').screenshot(path=OUT+'d_brl.png')
    pg.click('[data-xtab="et"]'); pg.locator('#xPrev').screenshot(path=OUT+'d_et.png')
    pg.click('[data-xtab="cz"]'); pg.locator('#xPrev').screenshot(path=OUT+'d_cz.png')
    pg.click('[data-xtab="at"]'); pg.locator('#xPrev').screenshot(path=OUT+'d_at.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    # roteiro link
    pg.click('#nav button[data-view="exp"]'); pg.click('[data-xa="rot"]'); pg.click('[data-xrotgo="cz"]'); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.S.view")=='exp' and pg.evaluate("PP.exp.state().tab")=='cz','roteiro ↗ leva ao CZI')
    pg.keyboard.press('Escape'); pg.click('#nav button[data-view="pedido"]'); pg.wait_for_timeout(200); ok(pg.evaluate("PP.S.view")=='pedido','Nacional volta ao Pedido')
    print('errs',errs)
