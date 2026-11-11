import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1906,'height':936}, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    pg.evaluate("PP.go('pedido')"); pg.wait_for_timeout(400)
    ok(pg.locator('#sideP').is_visible(),'painel aparece no Pedido nacional (tela larga)')
    ok('Cole o pedido' in pg.inner_text('#sideP'),'resumo vazio orienta')
    bb=pg.evaluate("(()=>{const m=document.querySelector('main.wrap').getBoundingClientRect(),s=document.getElementById('sideP').getBoundingClientRect();return [m.left,m.right,s.left,s.right,innerWidth]})()")
    print('  caixas main/side:',bb)
    ok(abs((bb[0]-237)-(bb[4]-bb[1]))<15,'conjunto centralizado (sobra igual dos dois lados)')
    # catálogo e pedido
    pg.evaluate("()=>{const c=[{id:11,row:11,sci:'PARACHEIRODON AXELRODI',comum:'Cardinal',rio:'',caixa:300,preco:0.35,estoque:40,pedido:0},{id:12,row:12,sci:'SYMPHYSODON DISCUS',comum:'Disco',rio:'',caixa:20,preco:6,estoque:10,pedido:0}];PP.S.catalog=c;PP.store.set('catalog',c);PP.store.set('catStamp',Date.now());PP.reloadState();}")
    pg.fill('#txt','')
    sci=['paracheirodon axelrodi','symphysodon discus']
    pg.fill('#txt','\n'.join(f'2 cx {s}' for s in sci)); pg.click('#ler'); pg.wait_for_timeout(500)
    t=pg.inner_text('#sideP'); print('  painel:',t.replace('\n',' | ')[:300])
    ok('caixas' in t and 'R$' in t and 'Cole o pedido' not in t,'resumo ao vivo atualiza depois de Ler pedido')
    P=pg.evaluate("(()=>{const P=PP.currentPlan();return [P.total,Math.round(P.valor*100)/100]})()")
    ok(str(P[0]) in pg.inner_text('#sideP .sdRow'),'caixas do painel = caixas do plano (%s)'%P[0])
    # muda caixas e o painel acompanha
    pg.fill('#conf tbody tr:first-child input[data-k=boxes]','5'); pg.wait_for_timeout(300)
    P2=pg.evaluate("PP.currentPlan().total"); ok(P2!=P[0] and str(P2) in pg.inner_text('#sideP .sdRow'),'painel acompanha edição das caixas (%s→%s)'%(P[0],P2))
    # salva um pedido de verdade e confere o painel do cliente + repetir
    pg.click('#saveHist'); pg.wait_for_timeout(500)
    nome=pg.evaluate("PP.cliente().nome")
    pg.click('#novoPed'); pg.wait_for_timeout(400)
    c=pg.inner_text('#sideP'); ok('Último pedido' in c and 'Cole o pedido' in c,'após novo pedido: resumo vazio e cliente mostra o último pedido salvo')
    print('  ',c.split('CLIENTE')[1][:170].replace('\n',' | '))
    ok(pg.locator('[data-sp=repeat]').count()==1,'botão repetir último pedido')
    pg.click('[data-sp=repeat]'); pg.wait_for_timeout(600)
    ok(pg.evaluate("PP.S.rows.length")==2,'repetir carrega os itens do último pedido')
    ok('caixas' in pg.inner_text('#sideP') and 'Cole o pedido' not in pg.inner_text('#sideP'),'resumo atualiza depois de repetir')
    pg.screenshot(path='/tmp/side_real.png')
    for v in ['hoje','hist','painel','exp','frete']:
        pg.evaluate(f"PP.go('{v}')"); pg.wait_for_timeout(250)
        ok(not pg.locator('#sideP').is_visible(),f'painel escondido em {v}')
    pg.screenshot(path='/tmp/hoje_center.png')
    # estreito / celular
    for w,h in [(1100,800),(412,915)]:
        pg.set_viewport_size({'width':w,'height':h}); pg.evaluate("PP.go('pedido')"); pg.wait_for_timeout(300)
        ok(not pg.locator('#sideP').is_visible(),f'painel não aparece em {w}px')
        ok(pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),f'sem rolagem lateral em {w}px')
    ok(len(errs)==0,'sem erros de JS %s'%errs); b.close()
print('FALHAS:',fails or 'nenhuma')
