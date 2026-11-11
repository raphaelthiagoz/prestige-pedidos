import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e/'
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1400,'height':900}, service_workers='block').new_page()
    pg.on('pageerror', lambda e: print('ERR',e)); pg.on('console', lambda m: print('CON',m.text[:200]) if m.type=='error' and 'Failed to load' not in m.text and 'TUNNEL' not in m.text else None)
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500)
    pg.evaluate(SEED); pg.evaluate("localStorage.setItem('pp.assist',JSON.stringify({mute:true}))"); pg.reload(); pg.wait_for_timeout(600)
    for v in ['pedido','exp','frete','hist','painel','relat','estoque']:
        try:
            pg.evaluate(f"PP.go('{v}')"); pg.wait_for_timeout(500); pg.screenshot(path=OUT+f's8_{v}.png',full_page=True)
        except Exception as e: print('fail',v,e)
    pg.evaluate("PP.go('hoje')"); pg.click('#btnCfg'); pg.wait_for_timeout(500); pg.screenshot(path=OUT+'s8_cfg.png')
    pg.keyboard.press('Escape'); pg.keyboard.press('Control+k'); pg.keyboard.type('leni'); pg.wait_for_timeout(400); pg.screenshot(path=OUT+'s8_search.png')
    pg.keyboard.press('Escape')
    m=b.new_context(viewport={'width':390,'height':800},service_workers='block',device_scale_factor=2).new_page()
    m.goto('http://localhost:8765/index.html'); m.wait_for_timeout(400); m.evaluate(SEED); m.reload(); m.wait_for_timeout(800)
    m.evaluate("PP.go('hoje')"); m.wait_for_timeout(2000); m.screenshot(path=OUT+'s8_m_hoje.png')
    m.click('#barMore'); m.wait_for_timeout(400); m.screenshot(path=OUT+'s8_m_menu.png')
