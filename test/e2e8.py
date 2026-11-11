import zipfile,re
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e/'
ok=lambda c,m: print(('  ok  ' if c else '  FAIL ')+m)
names=lambda pg: pg.evaluate("PP.exp.orderObj().items.map(x=>x.sci.split(' ')[0].slice(0,4)+' '+x.sci.split(' ')[1].slice(0,4))")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1400,'height':950}, accept_downloads=True, service_workers='block').new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500); pg.evaluate("document.getElementById('config').open=false")
    pg.click('#nav button[data-view="exp"]'); pg.set_input_files('#xFile','test/exp/stocklist_miami.xlsx'); pg.wait_for_timeout(1200)
    print('  auto :',names(pg))
    pg.evaluate("window.scrollTo(0,420)"); pg.screenshot(path=OUT+'o1.png')
    # arrastar linha do Cardinal (linha 2) para o topo? mover Tucano (linha 9) para o topo
    n=pg.locator('tr[data-xrow]').count(); print('  linhas',n)
    tuc=[i for i in range(n) if 'TUCANO' in pg.input_value(f'[data-xi="{i}"][data-xk="sci"]')][0]
    pg.wait_for_timeout(800)  # espera as animações de entrada terminarem (o arrastar falhava quando começava durante elas)
    for _ in range(3):
        pg.locator(f'[data-xgrip="{tuc}"]').scroll_into_view_if_needed(); pg.locator(f'[data-xgrip="{tuc}"]').drag_to(pg.locator('tr[data-xrow="0"]')); pg.wait_for_timeout(400)
        if names(pg)[0].upper().startswith('TUCA'): break
    nm=names(pg); print('  após arrastar:',nm)
    ok(nm[0].upper().startswith('TUCA'),'arrastar Tucano para o topo')
    ok(pg.evaluate("PP.exp.state().ordem")=='manual','modo manual')
    # ▼ no primeiro
    pg.click('[data-xmv="1"][data-xi2="0"]'); pg.wait_for_timeout(200); nm=names(pg); print('  após ▼:',nm[:3])
    ok(nm[1].upper().startswith('TUCA'),'▼ desce uma posição')
    pg.screenshot(path=OUT+'o2.png')
    # preview e docs seguem a ordem manual
    pg.click('button.primary[data-xa="prev"]'); pg.wait_for_timeout(300)
    rows=pg.eval_on_selector_all('#xStage tr td:nth-child(3) .xe','e=>e.map(x=>x.textContent).slice(0,4)'); print('  prévia:',rows)
    pg.screenshot(path=OUT+'o3.png'); pg.keyboard.press('Escape')
    for k,v in {'ex.nf':'1','ex.dued':'1','ex.mawb':'1','ex.dep':'2026-11-06T22:30','ex.gta':'1','ex.lpcoMapa':'E1','ex.lpcoIbama':'E2'}.items(): pg.fill(f'[data-xp="{k}"]',v)
    with pg.expect_download() as d: pg.click('[data-xa="zip"]')
    d.value.save_as(OUT+'o.zip'); z=zipfile.ZipFile(OUT+'o.zip')
    x=re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',z.open('ATESTADO_SISA_EUA_018.2026.docx').read().decode() if False else zipfile.ZipFile(z.open('ATESTADO_SISA_EUA_018.2026.docx')).read('word/document.xml').decode()))
    first=re.findall(r'(OTOCINCLUS|TUCANOICHTHYS|PARACHEIRODON AXELRODI)',x)[:3]; print('  atestado:',first)
    ok(first[0]=='OTOCINCLUS' and first[1]=='TUCANOICHTHYS','atestado segue ordem manual')
    # voltar automática
    pg.click('[data-xa="ordauto"]'); pg.wait_for_timeout(200); nm=names(pg); print('  auto de novo:',nm[:3]); ok(nm[0].upper().startswith('OTOC'),'voltar à automática')
    # guardar ordem e nova exportação
    pg.click('[data-xmv="1"][data-xi2="0"]'); pg.click('[data-xa="ordsave"]'); pg.wait_for_timeout(200)
    print('  guardada:',pg.evaluate("PP.exp.cfg().ordem.slice(0,3)"))
    pg.click('[data-xa="novo"]'); pg.set_input_files('#xFile','test/exp/stocklist_miami.xlsx'); pg.wait_for_timeout(1200)
    nm=names(pg); print('  nova importação:',nm[:3]); ok(nm[0].upper().startswith('PARA'),'ordem guardada vale na próxima (Cardinal primeiro)')
    pg.screenshot(path=OUT+'o4.png')
    print('errs',errs)
