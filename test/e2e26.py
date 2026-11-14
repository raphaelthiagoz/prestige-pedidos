import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':1000}, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(300)
    n0=pg.evaluate("PP.S.hist.length"); st0=pg.evaluate("JSON.stringify(PP.S.catalog.map(c=>c.estoque))")
    rel0=pg.evaluate("PP.relatorio.summary('2026-11-01','2026-11-30',5.5).nac")
    pg.click('[data-pn=toggle]'); ok(pg.locator('#pnForm').is_visible(),'formulário abre')
    pg.click('[data-pnb=save]'); ok('cliente' in pg.inner_text('#pnForm'),'pede cliente')
    # importar xlsx
    pg.set_input_files('#pnFile','/tmp/inv_nac.xlsx'); pg.wait_for_timeout(700)
    print('  msg:',pg.inner_text('#pnForm').split('Confira')[0][-160:].replace('\n',' '))
    ok(pg.input_value('[data-pn=cli]')=='AQUAPRIME','cliente da invoice')
    ok(pg.input_value('[data-pn=data]')=='2026-11-04','data da invoice (04/11)')
    ok(pg.input_value('[data-pn=inv]')=='1','invoice nº')
    ok(pg.input_value('[data-pn=gta]')=='22.5','GTA lida')
    n=pg.locator('#pnForm .pnrow').count(); ok(n==11,'11 linhas de espécie (%s)'%n)
    c=pg.evaluate("PP.pn.calc()"); print('  calc:',{k:c[k] for k in ['caixas','peixes','valor','total']})
    ok(c['caixas']==3 and c['peixes']==770 and abs(c['valor']-(300*.8+100*.6+120*.8+100*.6+10*2+30*.8+30*.6+30*.8+20*.6+10*4+20*.8))<1e-6,'caixas/peixes/valor corretos (3 cx, 770 peixes)')
    pg.fill('[data-pn=atest]','10'); pg.fill('[data-pn=emb]','5'); pg.select_option('[data-pn=sit]','pago')
    pg.fill('[data-pn=inv]','77'); pg.click('[data-pnb=save]'); pg.wait_for_timeout(400)
    h=pg.evaluate("PP.S.hist"); e=[x for x in h if x['inv']=='77']; ok(len(h)==n0+1 and len(e)==1,'entrou no histórico')
    e=e[0]; ok(abs(e['totais']['total']-(c['valor']+22.5+10+5))<1e-6 and e['pay']['status']=='pago','total = peixes+GTA+atestado+emb, pago')
    ok(pg.evaluate("JSON.stringify(PP.S.catalog.map(c=>c.estoque))")==st0,'não mexe no estoque')
    ok('AQUAPRIME' in pg.inner_text('#histTb'),'aparece na tabela do histórico')
    ok(pg.evaluate("PP.S.cfg.numeracao.ultimaInvoice")>=77,'numeração da invoice avançou')
    # relatório soma
    rel1=pg.evaluate("PP.relatorio.summary('2026-11-01','2026-11-30',5.5).nac")
    print('  rel antes/depois:',rel0['pedidos'],rel0['valor'],'->',rel1['pedidos'],rel1['valor'])
    ok(rel1['pedidos']==rel0['pedidos']+1 and abs(rel1['valor']-rel0['valor']-e['totais']['total'])<0.01 and rel1['caixas']==rel0['caixas']+3,'relatório de vendas soma o pedido (+1 pedido, +3 caixas, +valor)')
    # duplicado
    pg.click('[data-pn=toggle]'); pg.set_input_files('#pnFile','/tmp/inv_nac.xlsx'); pg.wait_for_timeout(600); pg.fill('[data-pn=inv]','77'); pg.click('[data-pnb=save]'); ok('Já existe' in pg.inner_text('#pnForm'),'bloqueia invoice repetida do mesmo cliente')
    # importar zip
    pg.fill('[data-pn=inv]','78'); pg.set_input_files('#pnFile','/tmp/zip_nac.zip'); pg.wait_for_timeout(800)
    ok(pg.input_value('[data-pn=cli]')=='AQUAPRIME' and pg.locator('#pnForm .pnrow').count()==11,'importa o .zip baixado (pega a invoice, ignora a "em reais")')
    pg.click('[data-pnb=close]')
    # editar
    pg.click('tr:has-text("AQUAPRIME") [data-h=more]'); pg.click('#hMenu [data-h=edit]'); pg.wait_for_timeout(400)
    ok(pg.locator('#pnForm').is_visible() and pg.input_value('[data-pn=inv]')=='77' and pg.locator('#pnForm .pnrow').count()==11,'Editar reabre o formulário preenchido')
    pg.fill('[data-pn=atest]','20'); pg.click('[data-pnb=save]'); pg.wait_for_timeout(300)
    e2=pg.evaluate("PP.S.hist.find(x=>x.inv==='77')"); ok(abs(e2['totais']['total']-(c['valor']+22.5+20+5))<1e-6 and pg.evaluate("PP.S.hist.filter(x=>x.inv==='77').length")==1,'edição atualiza sem duplicar')
    # detalhes + repetir
    pg.wait_for_timeout(800); pg.click('tr:has-text("AQUAPRIME") [data-h=more]'); pg.click('#hMenu [data-h=open]'); pg.wait_for_timeout(300); ok(pg.locator('#hdet').count()==1,'Detalhes abre sem erro')
    pg.click('[data-pn=toggle]') if pg.locator('#pnForm').count() else None
    # manual
    pg.evaluate("PP.go('hist')"); pg.click('[data-pn=toggle]'); pg.fill('[data-pn=cli]','MAEDA AQUARIOS'); pg.fill('[data-pn=data]','2026-11-03'); pg.fill('[data-pn=inv]','9')
    pg.fill('[data-pn="it.0.sci"]','Paracheirodon axelrodi'); pg.fill('[data-pn="it.0.boxes"]','4'); pg.fill('[data-pn="it.0.qpb"]','300'); pg.fill('[data-pn="it.0.price"]','0.8')
    ok('R$ 960,00' in pg.inner_text('#pnSum').replace('.',','),'soma ao vivo (4×300×0,80 = 960)')
    pg.click('[data-pnb=save]'); pg.wait_for_timeout(300); ok(pg.evaluate("PP.S.hist.some(x=>x.cliente.nome==='MAEDA AQUARIOS'&&x.totais.total===960)"),'registro manual salvo')
    ok(pg.evaluate("PP.S.clientes.some(c=>c.nome==='MAEDA AQUARIOS')"),'cliente novo foi cadastrado')
    pg.reload(); pg.wait_for_timeout(500); ok(pg.evaluate("PP.S.hist.some(x=>x.inv==='9')"),'continua depois de recarregar')
    ok(len(errs)==0,'sem erros de JS %s'%errs); b.close()
print('FALHAS:',fails or 'nenhuma')
