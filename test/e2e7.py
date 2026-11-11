import zipfile
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e/'
ok=lambda c,m: print(('  ok  ' if c else '  FAIL ')+m)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1400,'height':950}, accept_downloads=True, service_workers='block').new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500); pg.evaluate("document.getElementById('config').open=false")
    print('h1:', pg.inner_text('h1'), '| title:', pg.title(), '| nav:', pg.eval_on_selector_all('#nav button','e=>e.map(x=>x.textContent).slice(0,3)'))
    pg.click('#nav button[data-view="exp"]'); pg.set_input_files('#xFile','test/exp/stocklist_miami.xlsx'); pg.wait_for_timeout(1200)
    ok(pg.locator('#xModal').count()==0,'prévia não aparece sozinha')
    pg.screenshot(path=OUT+'g_exp.png')
    pg.evaluate("window.scrollTo(0,700)"); pg.screenshot(path=OUT+'g_exp2.png')
    pg.evaluate("window.scrollTo(0,0)")
    pg.click('button.primary[data-xa="prev"]'); pg.wait_for_timeout(300)
    ok(pg.locator('#xModal').count()==1,'prévia abre pelo botão')
    pg.screenshot(path=OUT+'g_prev.png')
    # editar qtd/cx na prévia (primeira linha = otocinclus 300)
    first=pg.locator('#xStage [data-xe$=".qpb"]').first
    path=first.get_attribute('data-xe'); print('  editando', path)
    first.click(); pg.keyboard.press('Control+a'); pg.keyboard.type('400'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.exp.state().items.find(x=>x.sci=='OTOCINCLUS HOPPEI').qpb")=='400','edição na prévia gravou no pedido')
    # editar campo em branco NF na etiqueta
    pg.click('[data-xtab="et"]'); pg.wait_for_timeout(200)
    nf=pg.locator('#xStage [data-xe="ex.nf"]').first; nf.click(); pg.keyboard.type('00009999'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.exp.state().ex.nf")=='00009999','NF digitada na etiqueta')
    # consignee edit via CZI
    pg.click('[data-xtab="cz"]'); pg.locator('#xStage [data-xe="cons.name"]').first.click(); pg.keyboard.press('Control+a'); pg.keyboard.type('RUINEMANS TESTE'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.exp.cfg().cons.MIA.name")=='RUINEMANS TESTE','consignee editado na prévia salva no cadastro')
    pg.click('[data-xtab="inv"]'); pg.wait_for_timeout(200); pg.screenshot(path=OUT+'g_prev2.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ok(pg.locator('#xModal').count()==0,'ESC fecha')
    ok(pg.input_value('[data-xp="ex.nf"]')=='00009999','formulário reflete edição da prévia')
    ok('RUINEMANS TESTE' in pg.inner_text('#xCons summary'),'resumo do consignee atualizado')
    tot=pg.inner_text('#xTot').replace('\n',' '); print('  ',tot)
    with pg.expect_download() as d: pg.click('[data-xa="zip"]')
    d.value.save_as(OUT+'h.zip'); z=zipfile.ZipFile(OUT+'h.zip')
    import re
    t=re.sub(r'<[^>]+>','',z.read('word/document.xml').decode()) if 'word/document.xml' in z.namelist() else ''
    names=z.namelist(); print('  ',len(names),'arquivos')
    pg.screenshot(path=OUT+'g_final.png')
    print('errs',errs)
