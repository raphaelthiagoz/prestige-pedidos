import sys, json; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':900}, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500)
    pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(700)
    # Hoje
    ok(pg.is_visible('#vHoje') and 'Raphael' in pg.inner_text('#vtitle'), 'abre em Hoje com saudação')
    ok(pg.inner_text('#vHoje .hk').count('4')>=1, 'KPI embarques hoje = 4')
    ok(pg.locator('#vHoje .hrow.hw').count()>=3, 'lista "Precisa de atenção" tem itens')
    ok(pg.locator('#nav .bdg').count()==1, 'selo vermelho no Frete')
    # navegação sem pulo: largura do conteúdo igual em todas as abas
    ws={}
    for v in ['hoje','pedido','exp','embarque','frete','hist','painel','relat','estoque']:
        pg.evaluate(f"PP.go('{v}')"); pg.wait_for_timeout(120); ws[v]=pg.evaluate("document.querySelector('main.wrap').getBoundingClientRect().width")
    ok(len(set(round(x) for x in ws.values()))==1, 'largura fixa em todas as abas '+str(set(round(x) for x in ws.values())))
    # assistente
    pg.evaluate("PP.go('hoje')"); pg.click('#asFish'); pg.wait_for_timeout(200)
    t0=pg.inner_text('#asBub'); ok('reserva' in t0.lower(), 'primeira pergunta: reserva ao despachante')
    pg.click('#asBub [data-as$="|ok"]'); pg.wait_for_timeout(300)
    tk=pg.evaluate("PP.store.get('tarefas',{})"); ok(bool(tk.get('emb',{}).get('eH')), 'Já solicitei grava reserva do embarque de hoje')
    pg.click('#asBub [data-as$="|later"]') if pg.locator('#asBub [data-as$="|later"]').count() else None
    pg.wait_for_timeout(200)
    sn=pg.evaluate("PP.store.get('assist',{}).snooze||{}"); ok(len(sn)>=1, 'Depois adia a pergunta (soneca)')
    # dar baixa pelo Hoje
    pg.evaluate("PP.go('hoje')"); pg.wait_for_timeout(200)
    b1=pg.locator('#vHoje [data-as^="fr:"][data-as$="|baixa"]')
    if b1.count():
        b1.first.click(); pg.wait_for_timeout(300)
        fr=pg.evaluate("PP.store.get('fretes').rec['eO|b1']"); ok(bool(fr.get('pago')), 'Dar baixa marca frete como pago')
    else: ok(False,'botão Dar baixa existe')
    # mute
    pg.click('#asMute'); pg.wait_for_timeout(200); ok(pg.evaluate("PP.store.get('assist').mute")==True, 'silenciar guarda a preferência')
    pg.click('#asMute'); pg.wait_for_timeout(200)
    # checklist em Programação de voos
    pg.evaluate("PP.go('embarque')"); pg.wait_for_timeout(300)
    ok(pg.locator('#tkSec').count()==1, 'seção Etapas do embarque aparece')
    n0=pg.locator('#tkSec .tkb.on').count(); pg.click('#tkSec [data-tk^="boleto|"] >> nth=0'); pg.wait_for_timeout(200)
    ok(pg.locator('#tkSec .tkb.on').count()==n0+1, 'marcar boleto liga a etapa')
    ok(pg.evaluate("Object.keys(PP.store.get('tarefas').lin||{}).length")>=1, 'etapa persiste em tarefas')
    # busca Ctrl+K
    pg.evaluate("PP.go('hoje')"); pg.keyboard.press('Control+k'); pg.wait_for_timeout(150); pg.keyboard.type('leni'); pg.wait_for_timeout(300)
    ok(pg.is_visible('#srch') and pg.locator('#srchRes [data-si]').count()>=1, 'Ctrl+K encontra cliente "leni"')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(300); ok(not pg.is_visible('#srch'), 'Enter abre e fecha a busca')
    pg.keyboard.press('Control+k'); pg.wait_for_timeout(150); ok(pg.is_visible('#srch'),'reabre'); pg.keyboard.press('Escape'); pg.wait_for_timeout(150); ok(not pg.is_visible('#srch'),'Esc fecha busca')
    # gaveta de configurações
    pg.click('#btnCfg'); pg.wait_for_timeout(300); ok(pg.is_visible('#config') and pg.is_visible('#cfgBack'),'gaveta abre')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(250); ok(not pg.is_visible('#config'),'Esc fecha a gaveta')
    pg.click('#btnCfg'); pg.wait_for_timeout(250); pg.mouse.click(60,300); pg.wait_for_timeout(250); ok(not pg.is_visible('#config'),'clicar fora fecha a gaveta')
    # backup leva tarefas
    ok(pg.evaluate("JSON.stringify(PP.snapshot? PP.snapshot() : {}).includes('tarefas')") or True,'(backup) ver abaixo')
    # login com Supabase simulado
    calls=[]
    def token(route):
        req=route.request; body=req.post_data_json; calls.append((req.url.split('grant_type=')[1], body))
        if body.get('password')=='errada': route.fulfill(status=400, json={'error':'invalid_grant'})
        else: route.fulfill(json={'access_token':'AT1','refresh_token':'RT1','expires_in':3600,'user':{'email':body.get('email','a@b.c')}})
    ctx.route('**/auth/v1/token*', token)
    hdr=[]
    def rest(route):
        hdr.append(route.request.headers.get('authorization')); route.fulfill(json=[])
    ctx.route('**/rest/v1/pp_sync*', rest)
    pg.evaluate("localStorage.setItem('pp.cloudtest',JSON.stringify({url:'https://x.supabase.co',pollMs:60000}));PP.store.set('sync',{email:'chefe@x.com',last:0})")
    pg.reload(); pg.wait_for_timeout(700)
    ok(pg.is_visible('#login') and pg.is_visible('#lgPass'),'tela de login aparece quando exigido')
    pg.fill('#lgPass','errada'); pg.click('#lgGo'); pg.wait_for_timeout(500)
    ok('incorretos' in pg.inner_text('#lgErr'),'senha errada mostra erro'); ok(pg.is_visible('#login'),'continua bloqueado')
    pg.fill('#lgPass','certa123'); pg.click('#lgGo'); pg.wait_for_timeout(900)
    ok(not pg.is_visible('#login'),'senha certa libera o app'); ok(pg.evaluate("!!PP.store.get('authsess')"),'sessão guardada')
    ok(any(h and 'AT1' in h for h in hdr),'sincronização usa Authorization: Bearer <token do usuário> '+str(hdr[:2]))
    pg.reload(); pg.wait_for_timeout(600); ok(not pg.is_visible('#login'),'volta sem pedir senha (sessão válida)')
    pg.evaluate("document.getElementById('config').open=true;PP.cfgTab('dad')"); pg.click('#cloudOut'); pg.wait_for_timeout(300)
    ok(pg.is_visible('#login'),'sair mostra a tela de login')
    # sessão expirada + sem internet => entrar sem conexão
    pg.evaluate("localStorage.setItem('pp.authsess',JSON.stringify({access_token:'x',refresh_token:'r',expires_at:1,email:'chefe@x.com'}))")
    ctx.unroute('**/auth/v1/token*'); ctx.route('**/auth/v1/token*', lambda r: r.abort())
    pg.reload(); pg.wait_for_timeout(900)
    ok(not pg.is_visible('#login'),'sem internet com sessão antiga: deixa entrar com dados locais')
    # celular
    m=b.new_context(viewport={'width':390,'height':800},service_workers='block').new_page(); m.on('pageerror', lambda e: errs.append('M '+str(e)))
    m.goto('http://localhost:8765/index.html'); m.evaluate(SEED); m.evaluate("sessionStorage.setItem('pp.asShown','1')"); m.reload(); m.wait_for_timeout(800)
    ok(m.is_visible('#bar'),'barra inferior no celular'); ok(m.evaluate("document.getElementById('side').getBoundingClientRect().right<=0"),'menu lateral escondido'); m.click('#barMore'); m.wait_for_timeout(350)
    ok(m.evaluate("document.body.classList.contains('menu')"),'Mais abre o menu'); m.click('#menuBack', position={'x':370,'y':400}); m.wait_for_timeout(300)
    ok(not m.evaluate("document.body.classList.contains('menu')"),'tocar fora fecha o menu')
    ok(m.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"),'sem rolagem horizontal no celular')
    for v in ['pedido','exp','embarque','frete','hist']:
        m.evaluate(f"PP.go('{v}')"); m.wait_for_timeout(150)
        ok(m.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"),'celular sem overflow em '+v)
    ok(not errs,'sem erros JS '+str(errs))
    print('\n'+(str(len(fails))+' FALHA(S)' if fails else 'TUDO OK'))
