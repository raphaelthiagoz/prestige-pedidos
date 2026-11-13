import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
MOCK="""window.showDirectoryPicker=async()=>{const r=await navigator.storage.getDirectory();const d=await r.getDirectoryHandle('Google Drive - Backups Prestige',{create:true});return d;};"""
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':900},device_scale_factor=2,service_workers='block'); pg=ctx.new_page()
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_function('window.PP'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.evaluate("PP.store.set('lastBackup',Date.now()-9*864e5)"); pg.reload(); pg.wait_for_timeout(2500)
    pg.evaluate(MOCK)
    pg.screenshot(path='out/foco/backup_aviso.png',clip={'x':330,'y':0,'width':1070,'height':260})
    pg.evaluate("document.getElementById('btnCfg').click();PP.cfgTab('dad')"); pg.wait_for_timeout(500)
    pg.locator('#bkPasta').scroll_into_view_if_needed(); pg.screenshot(path='out/foco/backup_antes.png')
    pg.locator('#bkEscolhe').dispatch_event('click'); pg.wait_for_timeout(600)
    pg.locator('#bkAgora').dispatch_event('click'); pg.wait_for_timeout(900)
    pg.locator('#bkPasta').scroll_into_view_if_needed(); pg.screenshot(path='out/foco/backup_depois.png')
    b.close()
