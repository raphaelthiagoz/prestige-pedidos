import zipfile, os, json
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e/'
def fill(pg, p, v): pg.fill(f'[data-xp="{p}"]', v)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':1000}, accept_downloads=True, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'TUNNEL' not in m.text else None)
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(600)
    pg.click('#nav button[data-view="exp"]'); pg.set_input_files('#xFile','/home/claude/prestige-pedidos/test/exp/stocklist_miami.xlsx'); pg.wait_for_timeout(1500)
    for k,v in {'ex.nf':'00008941/8942 S-2','ex.dued':'26BR001971465-1','ex.mawb':'074-70222390','ex.hawb':'HAW123','ex.voo':'KL0792','ex.dep':'2026-11-06T22:30','ex.gta':'123456','ex.serie':'AM','ex.lpcoMapa':'E2600665213','ex.lpcoIbama':'E2600604683','conv.rate':'5.4772'}.items(): fill(pg,k,v)
    pg.screenshot(path=OUT+'b_pedido.png', full_page=True)
    print('warn:', pg.inner_text('#xWarn')[:200]); print('cert:', pg.inner_text('#xCert'))
    pg.click('button.primary[data-xa="prev"]'); pg.wait_for_timeout(400)
    for t in ['inv','pl','et','at','cz']:
        pg.click(f'[data-xtab="{t}"]'); pg.wait_for_timeout(200); pg.locator('#xPrev').screenshot(path=OUT+f'b_{t}.png')
    pg.click('[data-xiv="brl"]') if pg.locator('[data-xiv="brl"]').count() else None
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    with pg.expect_download() as d:
        pg.click('[data-xa="zip"]')
    dl=d.value; path=OUT+dl.suggested_filename; dl.save_as(path); print('zip', path, os.path.getsize(path))
    z=zipfile.ZipFile(path); print(z.namelist())
    z.extractall(OUT+'zip')
    pg.wait_for_timeout(500)
    print('msg', pg.inner_text('#xMsg'))
    pg.keyboard.press('Escape'); pg.click('#nav button[data-view="hist"]'); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'b_num.png', full_page=True)
    pg.click('#nav button[data-view="exp"]'); pg.click('[data-xa="rot"]'); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'b_rot.png', full_page=True)
    print('errs', errs)
    b.close()
