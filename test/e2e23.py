import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1300,'height':1000}, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    for nm,path in [('xlsx (com aba escondida)','/tmp/inv_sample.xlsx'),('pdf','/tmp/inv_vis.pdf')]:
        pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(300)
        if not pg.locator('#xqa').count(): pg.click('[data-xq=toggle]')
        pg.set_input_files('#xqFile',path); pg.wait_for_timeout(1500 if nm=='pdf' else 600)
        print('  msg:',pg.inner_text('#xqa').split('Confira')[0][-140:].replace('\n',' '))
        ok(pg.input_value('[data-qa=n]')=='18' and pg.input_value('[data-qa=ano]')=='2026',nm+': nº 18/2026')
        ok(pg.input_value('[data-qa=date]')=='2026-11-07',nm+': data '+pg.input_value('[data-qa=date]'))
        ok('RUINEMANS' in pg.input_value('[data-qa=cli]') and pg.input_value('[data-qa=dest]')=='MIA',nm+': cliente/destino')
        ok(pg.input_value('[data-qa=fee]')=='12',nm+': taxa 12')
        its=[(pg.input_value(f'[data-qa="it.{i}.sci"]'),pg.input_value(f'[data-qa="it.{i}.boxes"]'),pg.input_value(f'[data-qa="it.{i}.qpb"]'),pg.input_value(f'[data-qa="it.{i}.price"]')) for i in range(pg.locator('#xqa .qrow').count())]
        print('  ',its)
        ok(len(its)==3 and its[0][1:]==('10','300','0.12'),nm+': 3 espécies lidas')
        ok('US$ 841.00' in pg.inner_text('#xqa').replace(',',''),nm+': total 841' )
    ok(len(errs)==0,'sem erros '+str(errs)); b.close()
print('FALHAS:',fails or 'nenhuma')
