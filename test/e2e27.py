import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1700,'height':1000}, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    pg.evaluate("""()=>{const t=PP.Features.todayISO(),d=n=>PP.Features.addDays(t,n);
      const mk=(id,n,dest,date,name,bx,tot,ex)=>({id,n,ano:2026,dest,dateISO:date,cons:{name},items:[{sci:'X y',pt:'',boxes:bx,qpb:100,price:1}],ordem:'auto',ex:Object.assign({pkDate:date,pkTime:'06:00AM',fee:12},ex||{}),conv:{on:false,rate:'',date},rot:{st:{a:'o',b:'o'},nt:{},no:{},f:{},only:false},tot:{boxes:bx,fish:bx*100,goods:bx*100,fee:bx*12,total:tot},ts:Date.now()});
      PP.store.set('exphist',[mk('xa',18,'MIA',d(2),'RUINEMANS AQUARIUM INC',24,3000,{dep:d(3)+'T20:30',voo:'LA8085',mawb:'957-42508642'}),mk('xb',19,'JPN',d(7),'FAR EAST ENTERPRISE INC',14,1500,{}),mk('xc',16,'MIA',d(-9),'AMS CLIENT',30,2400,{dep:d(-8)+'T10:00',sit:'chegou'})]);PP.exp.reload();}""")
    pg.evaluate("PP.go('embarque')"); pg.wait_for_timeout(300)
    ok(pg.locator('[data-emtab=nac]').count()==1 and pg.locator('[data-emtab=exp]').count()==1,'abas Nacionais e Exportações aparecem')
    ok('programação de voos' in pg.inner_text('#vEmbarque').lower(),'aba Nacionais continua igual')
    pg.click('[data-emtab=exp]'); pg.wait_for_timeout(300)
    ok(pg.locator('#xProg').is_visible(),'aba Exportações abre')
    t=pg.inner_text('#xProg'); print('  tabela:',t.replace('\n',' | ')[:330])
    ok(pg.locator('#xProg tbody tr').count()==3 and '018/2026' in t and '019/2026' in t,'3 exportações listadas')
    ok('Anteriores (1)' in t,'a que já chegou/passou vai para Anteriores')
    ok(pg.locator('#xProg > .tablewrap tbody tr').count()==2,'2 próximas no topo')
    # ordem: 018 (dep d+3) antes de 019 (d+7)
    first=pg.locator('#xProg > .tablewrap tbody tr').first.inner_text(); ok('018/2026' in first,'ordem pela saída (018 antes da 019)')
    ok('1 de 2' in pg.inner_text('#xgK'),'KPI: 1 de 2 com AWB')
    # editar
    pg.fill('[data-xg=voo][data-id=xb]','KL0792'); pg.press('[data-xg=voo][data-id=xb]','Tab'); pg.wait_for_timeout(200)
    ok(pg.evaluate("PP.exp.hist().find(h=>h.id==='xb').ex.voo")=='KL0792','editar voo grava na exportação')
    pg.fill('[data-xg=mawb][data-id=xb]','074-1111'); pg.press('[data-xg=mawb][data-id=xb]','Tab'); pg.wait_for_timeout(200)
    ok('2 de 2' in pg.inner_text('#xgK'),'KPI atualiza ao preencher AWB')
    pg.fill('[data-xg=dep][data-id=xb]','2026-12-01T09:15'); pg.press('[data-xg=dep][data-id=xb]','Tab'); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.exp.hist().find(h=>h.id==='xb').ex.dep")=='2026-12-01T09:15','Saída de GRU grava')
    pg.select_option('[data-xg=sit][data-id=xa]','chegou'); pg.wait_for_timeout(300)
    ok(pg.locator('#xProg > .tablewrap tbody tr').count()==1 and 'Anteriores (2)' in pg.inner_text('#xProg'),'marcar Chegou move para Anteriores')
    pg.reload(); pg.wait_for_timeout(500); pg.evaluate("PP.go('embarque')"); pg.click('[data-emtab=exp]')
    ok(pg.evaluate("PP.exp.hist().find(h=>h.id==='xb').ex.voo")=='KL0792' and pg.evaluate("PP.exp.hist().find(h=>h.id==='xa').ex.sit")=='chegou','continua depois de recarregar')
    # abrir
    pg.click('[data-xgo=xb]'); pg.wait_for_timeout(400); ok(pg.evaluate("PP.S.view")=='exp' and pg.evaluate("PP.exp.state().curId")=='xb','clicar no número abre a exportação')
    ok(pg.evaluate("PP.exp.state().ex.voo")=='KL0792','exportação aberta mostra o voo editado na programação')
    # voltar para nacionais
    pg.evaluate("PP.go('embarque')"); pg.click('[data-emtab=nac]'); pg.wait_for_timeout(300); ok('programação de voos' in pg.inner_text('#vEmbarque').lower() and pg.locator('#emTb').count()==1,'voltar para Nacionais mostra a tabela dos nacionais')
    # nova exportação
    pg.click('[data-emtab=exp]'); pg.click('[data-xgnew]'); pg.wait_for_timeout(300); ok(pg.evaluate("PP.S.view")=='exp','+ Nova exportação abre a tela de exportação')
    # sem exportações
    pg.evaluate("PP.store.set('exphist',[]);PP.exp.reload();PP.go('embarque')"); pg.click('[data-emtab=exp]'); ok('Nenhuma exportação aberta' in pg.inner_text('#xProg'),'estado vazio')
    ok(len(errs)==0,'sem erros de JS %s'%errs); b.close()
print('FALHAS:',fails or 'nenhuma')
