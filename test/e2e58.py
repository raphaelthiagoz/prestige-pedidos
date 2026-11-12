from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1400,'height':1000},service_workers='block').new_page()
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500); pg.evaluate("sessionStorage.setItem('pp.asShown','1')")
    pg.evaluate("""()=>{const L=(id,c)=>({id,cliente:c,aero:'GRU',cidade:'',caixas:3,peso:'',dim:'',awb:'',status:'programado',chegou:'',obs:'',pedidoId:''});
      PP.S.embarques=[{id:'e1',titulo:'T',saida:PP.Features.todayISO(),chegadaPrev:PP.Features.todayISO(),linhas:[L('a','CLIENTE UM')]}];PP.store.set('embarques',PP.S.embarques);}""")
    pg.reload(); pg.wait_for_timeout(600); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.evaluate("document.getElementById('config').open=false")
    def tela(v,id_):
        pg.click(f'#nav button[data-view="{v}"]'); pg.wait_for_timeout(400); return pg.inner_text(id_)
    t=tela('pedido','#vPedido'); ok('Programação (saída)' in t and 'valores da nota do pedido' in t.lower() and 'Embarque (saída)' not in t and 'otinha' not in t.lower(),'Nacional usa Programação e Nota do pedido')
    t=tela('frete','#vFrete'); ok('Programação do dia' in t and 'Total da programação' in t and 'Embarque do dia' not in t,'Frete usa Programação')
    t=tela('hoje','#vHoje'); ok('mbarques hoje' not in t and 'Próximo embarque' not in t,'Hoje sem "Embarques hoje"/"Próximo embarque"')
    t=tela('embarque','#vEmbarque'); ok('Nova programação' in t and 'Excluir esta programação' in t,'Programação de voos mantém os botões aprovados')
    b.close()
print('TUDO OK' if not fails else 'FALHAS: %d'%len(fails))
