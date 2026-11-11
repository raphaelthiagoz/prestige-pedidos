import sys, os; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e45/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':900},service_workers='block',accept_downloads=True); pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(500)
    pg.click('#btnCfg'); pg.wait_for_timeout(300); pg.click('#config [data-cgo="stock"]'); pg.wait_for_timeout(200)
    pg.set_input_files('#fStock','test/stocklist.xlsx'); pg.wait_for_timeout(1500)
    n=pg.evaluate("PP.S.catalog.length"); print('  itens na stocklist:',n); ok(n>5,'stocklist carregada')
    ok(pg.evaluate("!!PP.store.get('stockFile',null)"),'arquivo original guardado')
    pg.keyboard.press('Escape'); pg.evaluate("PP.go('hoje')"); pg.wait_for_timeout(300)
    ok(not pg.locator('#stkTop').is_visible(),'botão "Stocklist atualizada" NÃO aparece fora do Estoque')
    pg.evaluate("PP.go('estoque')"); pg.wait_for_timeout(300)
    ok(pg.locator('#stkTop').is_visible(),'botão "Stocklist atualizada" visível em Estoque e reposição')
    pg.screenshot(path=OUT+'topo.png')
    # simula venda salva (1 pedido com o 1º item)
    pg.evaluate("""()=>{const c=PP.S.catalog.find(x=>x.row&&x.estoque>5);const h={id:'tv',ts:Date.now(),cliente:{nome:'NACIONAL'},inv:'1',nf:'1',dataISO:PP.Features.todayISO(),totais:{caixas:2,peixes:200,total:100},pay:{status:'aguardando',pago:0},lines:[{it:{id:c.id,row:c.row,sci:c.sci,comum:c.comum,preco:c.preco},boxes:2,peixes:200}],rows:[{id:c.id,sci:c.sci,boxes:2,peixes:200}]};PP.S.hist.push(h);PP.store.set('hist',PP.S.hist);}""")
    with pg.expect_download() as dl: pg.click('#stkTop')
    d=dl.value; path=OUT+d.suggested_filename; d.save_as(path); print('  baixou',d.suggested_filename,os.path.getsize(path))
    ok(d.suggested_filename.startswith('STOCKLIST_ATUALIZADA_') and d.suggested_filename.endswith('.xlsx'),'baixa STOCKLIST_ATUALIZADA_<data>.xlsx')
    import openpyxl; wb=openpyxl.load_workbook(path); ok(len(wb.worksheets)>=1,'arquivo abre no Excel')
    ok(errs==[],'sem erros de JS: %s'%errs)
    b.close()
print('FALHAS:',fails); sys.exit(1 if fails else 0)
