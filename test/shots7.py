import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e/'
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1400,'height':900}, service_workers='block').new_page()
    pg.on('pageerror', lambda e: print('ERR',e)); pg.on('console', lambda m: print('CON',m.text[:200]) if m.type=='error' and 'Failed to load' not in m.text and 'TUNNEL' not in m.text else None)
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500)
    pg.evaluate(SEED); pg.evaluate("PP.go('hoje')"); pg.wait_for_timeout(2200); pg.screenshot(path=OUT+'n_hoje.png')
    pg.click('#asFish'); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'n_hoje_b.png')
    pg.evaluate("PP.go('embarque')"); pg.wait_for_timeout(400); pg.screenshot(path=OUT+'n_emb.png',full_page=True)
