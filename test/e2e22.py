import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':1000}, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(400)
    n0=pg.evaluate("PP.exp.hist().length"); last0=pg.evaluate("PP.exp.cfg().last")
    pg.click('[data-xq=toggle]'); pg.wait_for_timeout(200)
    ok(pg.locator('#xqa').is_visible(),'formulário abre')
    # validações
    pg.click('[data-xq=save]'); ok('número' in pg.inner_text('#xqa'),'pede o número')
    pg.fill('[data-qa=n]','19'); pg.fill('[data-qa=date]','2026-11-07')
    pg.click('[data-xq=save]'); ok('pelo menos uma espécie' in pg.inner_text('#xqa'),'pede espécie')
    pg.fill('[data-qa="it.0.sci"]','Paracheirodon axelrodi'); pg.fill('[data-qa="it.0.boxes"]','10'); pg.fill('[data-qa="it.0.qpb"]','300'); pg.fill('[data-qa="it.0.price"]','0.12')
    pg.click('[data-xq=add]'); pg.fill('[data-qa="it.1.sci"]','Symphysodon discus'); pg.fill('[data-qa="it.1.boxes"]','2'); pg.fill('[data-qa="it.1.qpb"]','20'); pg.fill('[data-qa="it.1.price"]','5')
    ok(pg.input_value('[data-qa="it.0.sci"]')=='Paracheirodon axelrodi','linha 1 mantida ao adicionar espécie')
    ok('US$ 704.00' in pg.inner_text('#xqa').replace(',',''),'total ao vivo: '+pg.inner_text('#xqa').split('caixa(s)')[1][:40])
    pg.select_option('[data-qa=dest]','JPN'); ok(pg.input_value('[data-qa=cli]')!='' and pg.input_value('[data-qa=n]')=='19','trocar destino mantém dados e troca cliente')
    pg.screenshot(path='/tmp/qa1.png')
    pg.click('[data-xq=save]'); pg.wait_for_timeout(300)
    h=pg.evaluate("PP.exp.hist()"); e=[x for x in h if x['n']==19]
    ok(len(h)==n0+1 and len(e)==1,'entrou no histórico')
    e=e[0]; ok(e['tot']['boxes']==12 and abs(e['tot']['total']-(10*300*0.12+2*20*5+12*12))<1e-6,'totais corretos %s'%e['tot'])
    ok(e['dest']=='JPN' and e['dateISO']=='2026-11-07' and e['items'][0]['pt']!='','destino/data/nome pt')
    ok(pg.evaluate("PP.exp.cfg().last")==max(last0,19),'contador avançou')
    ok('019/2026' in pg.inner_text('#xHist') and not pg.locator('#xqa').count(),'aparece na tabela e o formulário fecha')
    # duplicado
    pg.click('[data-xq=toggle]'); pg.fill('[data-qa=n]','19'); pg.fill('[data-qa="it.0.sci"]','X y'); pg.fill('[data-qa="it.0.boxes"]','1'); pg.fill('[data-qa="it.0.qpb"]','10'); pg.click('[data-xq=save]')
    ok('já está no histórico' in pg.inner_text('#xqa'),'bloqueia número repetido')
    pg.click('[data-xq=toggle]')
    # abrir a salva e relatório
    pg.click('[data-xopen="%s"]'%e['id']); pg.wait_for_timeout(500)
    ok(pg.evaluate("PP.exp.state().n")==19,'Abrir funciona para o registro rápido')
    pg.evaluate("PP.go('painel')"); pg.wait_for_timeout(500)
    r=pg.evaluate("JSON.stringify(PP.relatorio.summary('2026-11-01','2026-11-30',5.5).exp)")
    print('  rel:',r[:300])
    ok('704' in r,'relatório de vendas soma a exportação 019 (US$ 704)')
    ok(len(errs)==0,'sem erros de JS %s'%errs)
    b.close()
print('FALHAS:',fails if fails else 'nenhuma')
