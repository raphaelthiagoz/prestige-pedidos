import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1600,'height':1000}, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    pid=pg.evaluate("PP.S.hist[0].id"); nome=pg.evaluate("PP.S.hist[0].cliente.nome")
    pg.evaluate("""(pid)=>{const t=PP.Features.todayISO();PP.S.embarques=[{id:'e1',titulo:'Embarque',saida:t,chegadaPrev:t,linhas:[{id:'l1',cliente:'Com pedido',aero:'GRU',cidade:'SP',caixas:5,status:'chegou',pedidoId:pid},{id:'l2',cliente:'Sem pedido',aero:'BSB',cidade:'DF',caixas:3,status:'programado'}]}];PP.store.set('embarques',PP.S.embarques);}""",pid)
    pg.evaluate("PP.go('embarque')"); pg.wait_for_timeout(400)
    ok(pg.locator('[data-em=mort]').count()==1,'botão Mortalidade só na linha ligada a um pedido (%d)'%pg.locator('[data-em=mort]').count())
    pg.click('[data-em=mort]'); pg.wait_for_timeout(500)
    ok(pg.evaluate("PP.S.view")=='hist','abre o Histórico')
    t=pg.inner_text('#vHist'); ok('mortalidade' in t.lower() and 'Baixar nota do pedido corrigida' in t,'mostra o ajuste de chegada (mortalidade) do pedido')
    ok(pg.evaluate("PP.extra.ST.hist.open")==pid,'abre exatamente o pedido da linha')
    ok(not errs,'sem erros JS %s'%errs); b.close()
print('FALHAS:',fails or 'nenhuma')
