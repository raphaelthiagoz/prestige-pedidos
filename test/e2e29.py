import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':1000},device_scale_factor=1.5, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(700)
    pg.evaluate("""()=>{const t=PP.Features.todayISO(),d=n=>PP.Features.addDays(t,n);
      PP.S.embarques=[{id:'e1',titulo:'Embarque 11/11',saida:d(5),chegadaPrev:d(6),linhas:[{id:'l1',cliente:'Maeda',aero:'CGB',cidade:'Cuiabá',caixas:12,status:'programado'},{id:'l2',cliente:'Cezar Soares',aero:'GRU',cidade:'São Paulo',caixas:20,status:'programado'}]},{id:'e2',titulo:'Embarque 18/11',saida:d(12),chegadaPrev:d(13),linhas:[{id:'l3',cliente:'Maeda',aero:'CGB',cidade:'Cuiabá',caixas:30,status:'programado'}]},{id:'e3',titulo:'Embarque 02/12',saida:d(26),chegadaPrev:d(27),linhas:[{id:'l4',cliente:'Zé',aero:'BSB',cidade:'Brasília',caixas:15,status:'programado'}]}];
      PP.store.set('embarques',PP.S.embarques);
      const mk=(id,n,date,bx,tot)=>({id,n,ano:2026,dest:'MIA',dateISO:date,cons:{name:'RUINEMANS'},items:[{sci:'X y',pt:'',boxes:bx,qpb:100,price:1}],ordem:'auto',ex:{pkDate:date,pkTime:'06:00AM',fee:12,dep:date+'T20:30'},conv:{on:false,rate:'',date},rot:{st:{a:'o',b:'o'},nt:{},no:{},f:{},only:false},tot:{boxes:bx,fish:bx*100,goods:tot,fee:0,total:tot},ts:Date.now()});
      PP.store.set('exphist',[Object.assign(mk('xa',18,d(3),24,6000),{conv:{on:true,rate:5.4,date:t}}),mk('xb',19,d(19),40,9500)]);PP.store.set('relcfg',{p:'semana',rate:5.3});PP.exp.reload();
      const h=(PP.S.hist||[]);PP.S.embarques[0].linhas[0].pedidoId=h[0]&&h[0].id;PP.S.embarques[1].linhas[0].pedidoId=h[1]&&h[1].id;PP.S.embarques[2].linhas[0].pedidoId=h[2]&&h[2].id;PP.store.set('embarques',PP.S.embarques);}""")
    pg.evaluate("PP.go('embarque');PP.go('hoje')"); pg.wait_for_timeout(500)
    t=pg.inner_text('#vHoje'); print(t[:900].replace('\n',' | '))
    ok('PRÓXIMA PROGRAMAÇÃO' in t.upper() and '11' in t,'cartão mostra Próxima programação quando hoje não tem')
    ok('VENDAS PROGRAMADAS' in t.upper() and 'quantidade de vendas' in t.lower(),'gráfico: Vendas programadas · quantidade de vendas')
    ok('últimas 8 semanas' not in t and 'R$ 50 mil' not in t and 'mil' not in t.split('VENDAS')[1][:400],'sem valores em R$ no gráfico')
    ok('Caixas nacionais · 77' in t and 'Caixas exportação · 64' in t and 'Vendas (curva) · 6' in t,'legenda: 77 cx nacionais, 64 cx exportação, 6 vendas')
    ok(pg.locator('#vHoje svg path[stroke="#f2f6f7"]').count()==1 and pg.locator('#vHoje svg circle').count()>=3,'curva e pontos desenhados')
    ok('venda' in t and ('1 venda' in t or '2 vendas' in t),'pontos mostram quantidade de vendas')
    ok(pg.locator('#kbMic').is_visible(),'microfone aparece na tela inicial')
    pg.screenshot(path='/tmp/home_new.png')
    pg.click('[data-hdet]'); pg.wait_for_timeout(300)
    ok(pg.locator('#hDet').is_visible(),'clicar em Ver detalhes abre a aba de detalhe')
    d=pg.inner_text('#hDet'); print('  detalhe:',d[:500].replace('\n',' | '))
    ok('VENDAS NACIONAIS' in d.upper() and 'Maeda' in d and 'Cezar Soares' in d and '018/2026' in d,'detalhe por dia lista clientes e exportações')
    ok(pg.locator('#hDet tbody tr').count()==5,'5 dias com algo programado (%d)'%pg.locator('#hDet tbody tr').count())
    pg.screenshot(path='/tmp/home_det.png')
    pg.click('[data-hdx=sem]'); pg.wait_for_timeout(200); nsem=pg.locator('#hDet tbody tr').count(); ok(3<=nsem<=5,'por semana: agrupa os 5 dias em 3 a 5 semanas (depende do dia da semana de hoje; deu %d)'%nsem)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200); ok(not pg.locator('#hDet').is_visible(),'Esc fecha o detalhe')
    for v in ['pedido','exp','embarque','hist','mapa','frete']:
        pg.evaluate(f"PP.go('{v}')"); pg.wait_for_timeout(250)
        ok(not pg.locator('#kbMic').is_visible(),f'microfone escondido em {v}')
    pg.evaluate("PP.go('hoje')"); pg.wait_for_timeout(250); ok(pg.locator('#kbMic').is_visible(),'microfone volta na tela inicial')
    # embarque hoje
    pg.evaluate("""()=>{const t=PP.Features.todayISO();PP.S.embarques[0].saida=t;PP.store.set('embarques',PP.S.embarques);PP.hoje.render();}""")
    t=pg.inner_text('#vHoje').upper(); ok('PROGRAMAÇÕES HOJE' in t and '32 CAIXAS' in t,'com embarque hoje volta ao cartão Programações hoje')
    ok(not errs,'sem erros JS %s'%errs); b.close()
print('FALHAS:',fails or 'nenhuma')
