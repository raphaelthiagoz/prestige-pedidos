import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
FUT="""()=>{const F=PP.Features,t=F.todayISO(),d=n=>F.addDays(t,n),L=(id,c,cx)=>({id,cliente:c,aero:'GRU',cidade:'',caixas:cx,peso:'',dim:'',awb:'',status:'programado',chegou:'',obs:'',pedidoId:''});
 const e=PP.S.embarques.concat([{id:'f1',titulo:'N',saida:d(1),chegadaPrev:d(2),linhas:[L('x1','CLIENTE UM',5),L('x2','CLIENTE DOIS',3)]},{id:'f2',titulo:'N',saida:d(3),chegadaPrev:d(4),linhas:[L('y1','CLIENTE TRES',8)]},{id:'f3',titulo:'N',saida:d(6),chegadaPrev:d(7),linhas:[L('z1','A',1),L('z2','B',1),L('z3','C',1),L('z4','D',1)]}]);
 PP.S.embarques=e;PP.store.set('embarques',e);}"""
def abre(b,w,h,mob=False):
    ctx=b.new_context(viewport={'width':w,'height':h},service_workers='block',is_mobile=mob,has_touch=mob); pg=ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_function('window.PP'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate(FUT)
    pg.evaluate("sessionStorage.setItem('pp.asShown','1');PP.store.set('bkSnooze',Date.now()+9e9);PP.store.set('guiaVisto',1);PP.store.set('tourVisto',1)")
    pg.reload(); pg.wait_for_timeout(2200); return ctx,pg,errs
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx,pg,errs=abre(b,1440,1100)
    ok(pg.is_visible('#hjRec'),'cartão "A receber · previsão" aparece no Hoje')
    tot=pg.evaluate("(()=>{const st=PP.hoje.stats();return st.aguardando})()")
    pt=pg.evaluate("PP.hojeplus.pontos(60)")
    ok(abs(pt['total']-tot)<0.01 or pt['total']+pt['depois']>=tot-0.01,'a previsão usa os mesmos pedidos do cartão "Aguardando pagamento" (%.2f de %.2f)'%(pt['total'],tot))
    ok(pt['B'][0]['n']==4 and abs(pt['B'][0]['v']-15840)<0.01,'atrasados somam R$ 15.840,00 em 4 pedidos (vencimento antes de hoje)')
    ok(pt['B'][1]['n']==1,'o que vence hoje aparece à parte')
    ok(pg.locator('#hjRec circle').count()==7,'gráfico tem 7 pontos (atrasado, hoje e 5 faixas)')
    ok(pg.locator('#hjRec [data-rd][aria-pressed=true]').inner_text().startswith('30'),'período padrão 30 dias')
    t30=pg.inner_text('#hjRec .hrbig small')
    pg.click('#hjRec [data-rd="60"]'); pg.wait_for_timeout(300)
    ok(pg.locator('#hjRec [data-rd][aria-pressed=true]').inner_text().startswith('60') and pg.inner_text('#hjRec .hrbig small')!=t30,'botão 60 dias muda o período e a data')
    pg.click('#hjRec [data-rd="15"]'); pg.wait_for_timeout(300)
    ok(pg.inner_text('#hjRec .hrbig small').split('até')[1].strip().startswith(pg.evaluate("(()=>{const d=new Date();d.setDate(d.getDate()+15);return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')})()")),'15 dias termina daqui a 15 dias')
    pg.reload(); pg.wait_for_timeout(2200)
    ok(pg.locator('#hjRec [data-rd][aria-pressed=true]').inner_text().startswith('15'),'o período escolhido fica salvo')
    pg.hover('#hjRec svg g[data-tip] circle >> nth=0'); pg.wait_for_timeout(300)
    ok(pg.is_visible('.mo-tip.on') and 'Atrasado' in pg.inner_text('.mo-tip'),'passar o mouse no ponto mostra valor e pedidos (tooltip)')
    # pedido quitado sai da previsão
    n0=pg.evaluate("PP.hojeplus.pontos(30).B.reduce((a,b)=>a+b.n,0)")
    pg.evaluate("(()=>{const e=PP.S.hist.find(h=>h.pay&&h.pay.status==='aguardando');e.pay.pago=e.totais.total;e.pay.status='pago';})()")
    ok(pg.evaluate("PP.hojeplus.pontos(30).B.reduce((a,b)=>a+b.n,0)")==n0-1,'pedido que foi pago sai da previsão')
    # sem nada a receber
    pg.evaluate("PP.S.hist.forEach(h=>{h.pay={status:'pago',pago:h.totais.total}});PP.hoje.render()"); pg.wait_for_timeout(500)
    ok('Nada a receber' in pg.inner_text('#hjRec'),'sem pedidos em aberto mostra "Nada a receber"')
    pg.evaluate("document.querySelector('#hjPilha').scrollIntoView()")
    # pilha
    ok(pg.is_visible('#hjPilha') and pg.locator('#hjPilha .stc').count()==3,'pilha mostra as 3 próximas programações')
    pos=lambda: pg.evaluate("[...document.querySelectorAll('#hjPilha .stc')].map(c=>c.dataset.pos).join()")
    ok(pos()=='0,1,2','o cartão mais próximo está na frente')
    ok('CLIENTE UM' in pg.inner_text('#hjPilha .stc[data-pos="0"]') and '2 clientes' in pg.inner_text('#hjPilha .stc[data-pos="0"]') and '8 caixas' in pg.inner_text('#hjPilha .stc[data-pos="0"]'),'cartão da frente: clientes e caixas da programação (2 clientes · 8 caixas)')
    ok('amanhã' in pg.inner_text('#hjPilha .stc[data-pos="0"]'),'diz "amanhã" para a próxima')
    pg.click('#hjPilha [data-pst=next]'); pg.wait_for_timeout(600)
    ok(pos()=='2,0,1' and 'CLIENTE TRES' in pg.inner_text('#hjPilha .stc[data-pos="0"]'),'seta › traz a próxima programação para a frente')
    pg.click('#hjPilha [data-pst=prev]'); pg.wait_for_timeout(500); ok(pos()=='0,1,2','seta ‹ volta')
    bb=pg.locator('#hjPilha .stc[data-pos="1"]').bounding_box(); pg.mouse.click(bb['x']+bb['width']/2,bb['y']+bb['height']-3); pg.wait_for_timeout(500)
    ok(pos()=='2,0,1','clicar no cartão de trás traz ele para a frente')
    pg.click('#hjPilha .sdots i >> nth=2'); pg.wait_for_timeout(500); ok(pos()=='1,2,0','pontinhos pulam direto para a programação')
    ok('e mais 1' in pg.inner_text('#hjPilha .stc[data-pos="0"]') and '4 clientes' in pg.inner_text('#hjPilha .stc[data-pos="0"]'),'programação com 4 clientes mostra o resumo certo')
    pg.click('#hjPilha .stc[data-pos="0"] [data-pst=abrir]'); pg.wait_for_timeout(700)
    ok(pg.evaluate("document.body.dataset.view")=='embarque' and pg.evaluate("PP.extra.ST.emb.sel")=='f3','"Abrir esta programação" abre a programação certa')
    ok(not errs,'sem erros JS '+str(errs[:2]))
    ctx.close()
    # sem programações futuras
    ctx=b.new_context(viewport={'width':1440,'height':900},service_workers='block'); pg=ctx.new_page()
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_function('window.PP'); pg.evaluate(SEED)
    pg.evaluate("sessionStorage.setItem('pp.asShown','1');PP.store.set('bkSnooze',Date.now()+9e9);PP.store.set('guiaVisto',1);PP.store.set('tourVisto',1)")
    pg.reload(); pg.wait_for_timeout(2000)
    ok(pg.locator('#hjPilha').count()==0,'sem programações futuras a pilha não aparece')
    ctx.close()
    # celular
    ctx,pg,errs=abre(b,390,844,True)
    ok(pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),'celular: sem rolagem horizontal')
    ok(pg.evaluate("(()=>{const r=document.querySelector('#hjRec').getBoundingClientRect();return r.right<=innerWidth&&r.left>=0})()"),'celular: cartão da previsão cabe na tela')
    ok(pg.evaluate("(()=>{const r=document.querySelector('#hjPilha').getBoundingClientRect();return r.right<=innerWidth&&r.left>=0})()"),'celular: pilha cabe na tela')
    ok(not errs,'celular sem erros JS')
    ctx.close(); b.close()
print('\nFALHAS:',len(fails)); sys.exit(1 if fails else 0)
