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
    pg.evaluate("PP.go('pedido')"); pg.wait_for_timeout(300)
    pg.evaluate("()=>{const c=[{id:11,row:11,sci:'PARACHEIRODON AXELRODI',comum:'Cardinal',rio:'',caixa:300,preco:0.35,estoque:40,pedido:0}];PP.S.catalog=c;PP.store.set('catalog',c);PP.store.set('catStamp',Date.now());PP.reloadState();PP.S.clientes.push({nome:'CLIENTE TESTE',end:'RUA X',aero:'BSB',cidade:'Brasília - DF'});PP.saveClientes();PP.reloadState();}")
    idx=pg.evaluate("PP.S.clientes.findIndex(c=>c.nome==='CLIENTE TESTE')"); pg.select_option('#cliente',str(idx))
    pg.fill('#txt','3 cx paracheirodon axelrodi'); pg.click('#ler'); pg.wait_for_timeout(400)
    ok(pg.locator('#embAsk').is_hidden(),'aviso não aparece antes de salvar')
    nEmb=pg.evaluate("PP.S.embarques.length"); linhas0=pg.evaluate("PP.S.embarques.reduce((a,e)=>a+e.linhas.length,0)")
    pg.click('#saveHist'); pg.wait_for_timeout(400)
    ok(pg.locator('#embAsk').is_visible() and 'Colocar este pedido' in pg.inner_text('#embAsk'),'depois de salvar pergunta se entra na programação')
    ok(pg.evaluate("PP.S.embarques.reduce((a,e)=>a+e.linhas.length,0)")==linhas0,'não coloca sozinho (só ao confirmar)')
    print('  opções:',pg.eval_on_selector_all('#eaSel option','o=>o.map(x=>x.textContent)'))
    # Agora não
    ok(pg.locator('#eaNovo').is_hidden(),'data do novo embarque escondida quando escolhe embarque existente')
    pg.click('[data-ea=no]'); ok(pg.locator('#embAsk').is_hidden(),'"Agora não" fecha o aviso')
    pg.click('#saveHist'); pg.wait_for_timeout(300); ok(pg.locator('#embAsk').is_hidden(),'não insiste depois de dizer agora não')
    # novo pedido e confirmar em embarque existente
    pg.click('#novoPed'); pg.wait_for_timeout(300)
    pg.select_option('#cliente',str(idx)); pg.fill('#txt','2 cx paracheirodon axelrodi'); pg.click('#ler'); pg.wait_for_timeout(400)
    pg.click('#saveHist'); pg.wait_for_timeout(300)
    opt=pg.eval_on_selector_all('#eaSel option','o=>o.map(x=>x.value)'); first=[o for o in opt if o!='new'][0]
    pg.select_option('#eaSel',first); pg.click('[data-ea=ok]'); pg.wait_for_timeout(300)
    id=pg.evaluate("PP.S.hist[PP.S.hist.length-1].id")
    L=pg.evaluate("(id)=>{for(const e of PP.S.embarques){const l=e.linhas.find(x=>x.pedidoId===id);if(l)return [e.id,l.cliente,l.aero,l.cidade,l.caixas]}return null}",id)
    print('  linha:',L)
    ok(L and L[0]==first and L[1]=='CLIENTE TESTE' and L[2]=='BSB' and L[3]=='Brasília - DF' and L[4]==2,'linha criada preenchida: cliente, aeroporto, cidade, caixas')
    ok('colocado na programação' in pg.inner_text('#embAsk'),'mostra confirmação')
    # editar caixas e salvar de novo → atualiza
    pg.fill('#conf tbody tr:first-child input[data-k=boxes]','5'); pg.click('#saveHist'); pg.wait_for_timeout(300)
    L2=pg.evaluate("(id)=>{for(const e of PP.S.embarques){const l=e.linhas.find(x=>x.pedidoId===id);if(l)return l.caixas}return null}",id)
    ok(L2==5,'salvar de novo atualiza as caixas na programação (%s)'%L2)
    ok('caixas atualizadas' in pg.inner_text('#embAsk'),'avisa que atualizou')
    # criar novo embarque
    pg.click('#novoPed'); pg.wait_for_timeout(300); pg.select_option('#cliente',str(idx)); pg.fill('#txt','1 cx paracheirodon axelrodi'); pg.click('#ler'); pg.wait_for_timeout(300); pg.click('#saveHist'); pg.wait_for_timeout(300)
    pg.select_option('#eaSel','new'); ok(pg.locator('#eaNovo').is_visible(),'criar novo embarque mostra a data')
    pg.fill('#eaNovo','2026-12-20'); pg.click('[data-ea=ok]'); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.S.embarques.length")==nEmb+1 and pg.evaluate("PP.S.embarques.some(e=>e.saida==='2026-12-20'&&e.linhas.length===1)"),'novo embarque criado com a linha')
    # aparece na tela da programação
    pg.click('[data-ea=ver]'); pg.wait_for_timeout(400)
    ok(pg.evaluate("PP.S.view")=='embarque','botão abre a programação')
    # persistência
    pg.reload(); pg.wait_for_timeout(500); ok(pg.evaluate("PP.S.embarques.some(e=>e.saida==='2026-12-20')"),'continua depois de recarregar')
    ok(len(errs)==0,'sem erros de JS %s'%errs); b.close()
print('FALHAS:',fails or 'nenhuma')
