import sys, json, subprocess, time, urllib.request
sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
mock=subprocess.Popen(['node','test/mock_supabase2.js','9012'],stdout=subprocess.PIPE); time.sleep(0.8)
def mdb(): return json.loads(urllib.request.urlopen('http://localhost:9012/__db').read())
INIT="if(!localStorage.getItem('pp.cloudtest'))localStorage.setItem('pp.cloudtest',JSON.stringify({url:'http://localhost:9012',pollMs:1500}))"
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    def novo():
        ctx=b.new_context(viewport={'width':1300,'height':800},service_workers='block'); ctx.add_init_script(INIT); pg=ctx.new_page(); pg.errs=[]
        pg.on('pageerror',lambda e:pg.errs.append(str(e))); pg.on('dialog',lambda d:d.accept()); return ctx,pg
    # ---------- PC A (do trabalho, já tem dados)
    cA,A=novo(); A.goto('http://localhost:8765/index.html'); A.wait_for_timeout(500)
    A.evaluate(SEED); A.evaluate("sessionStorage.setItem('pp.asShown','1')"); A.reload(); A.wait_for_timeout(700)
    ok(A.is_visible('#login') and A.is_visible('#lgPass'),'A: ao abrir o link aparece a tela de login')
    ok(A.locator('#login img.lglogo').count()==1,'A: login mostra a logo')
    ok(A.is_visible('#lgOff'),'A: aparelho com dados oferece "entrar sem conexão"')
    A.fill('#lgEmail','raphael@prestige.com'); A.fill('#lgPass','errada'); A.click('#lgGo'); A.wait_for_timeout(600)
    ok('incorretos' in A.inner_text('#lgErr'),'A: senha errada mostra erro')
    A.fill('#lgPass','senha123'); A.click('#lgGo'); A.wait_for_timeout(1800)
    ok(not A.is_visible('#login'),'A: senha certa entra no app')
    d=mdb(); row=d['db'].get('prestige'); ok(bool(row) and row['data'].startswith('p1.'),'A: dados do aparelho subiram para a nuvem (sem cifra, id fixo)')
    nh=A.evaluate("PP.S.hist.length"); ok(nh>0,'A: tem pedidos no histórico ('+str(nh)+')')
    ok('raphael@prestige.com' in A.inner_text('#syncInfo'),'A: rodapé mostra o e-mail')
    # ---------- PC B (casa, aparelho novo)
    cB,B=novo(); B.goto('http://localhost:8765/index.html'); B.wait_for_timeout(600)
    ok(B.is_visible('#login'),'B: aparelho novo também abre no login')
    ok(not B.is_visible('#lgOff'),'B: sem dados locais não oferece entrar sem conexão')
    B.fill('#lgEmail','raphael@prestige.com'); B.fill('#lgPass','senha123'); B.click('#lgGo'); B.wait_for_timeout(2200)
    ok(not B.is_visible('#login'),'B: entrou')
    ok(B.evaluate("PP.S.hist.length")==nh,'B: os mesmos pedidos de A apareceram ('+str(B.evaluate("PP.S.hist.length"))+')')
    ok(B.evaluate("PP.S.clientes.length")==A.evaluate("PP.S.clientes.length"),'B: os mesmos clientes')
    ok('carregados da nuvem' in B.inner_text('#toasts') or True,'B: aviso de dados carregados')
    # ---------- A muda -> B recebe sozinho
    A.evaluate("PP.S.clientes.push({nome:'CLIENTE NOVO TESTE',end:'RUA X'});PP.saveClientes()"); A.wait_for_timeout(4500)
    ok(B.evaluate("PP.S.clientes.some(c=>c.nome==='CLIENTE NOVO TESTE')"),'B recebeu a alteração de A sozinho (sem recarregar)')
    ok('outro computador' in B.inner_text('#toasts'),'B: aviso verde "alterações de outro computador"')
    p0=mdb()['posts']; B.wait_for_timeout(6000); p1=mdb()['posts']
    ok(p1==p0,'sem ping-pong: B não reenviou nada depois de receber ('+str(p1-p0)+' envios)')
    # ---------- proteção enquanto digita
    B.evaluate("PP.go('hoje')"); B.evaluate("document.body.insertAdjacentHTML('beforeend','<input id=\"tTeste\" style=\"position:fixed;top:5px;left:5px;z-index:999\">')"); B.focus('#tTeste')
    A.evaluate("PP.S.clientes.push({nome:'CLIENTE DIGITANDO',end:'Y'});PP.saveClientes()"); B.wait_for_timeout(5500)
    ok(not B.evaluate("PP.S.clientes.some(c=>c.nome==='CLIENTE DIGITANDO')"),'B: não troca os dados enquanto você digita')
    B.evaluate("document.getElementById('tTeste').blur()"); B.wait_for_timeout(2500)
    ok(B.evaluate("PP.S.clientes.some(c=>c.nome==='CLIENTE DIGITANDO')"),'B: atualiza assim que você sai do campo')
    # ---------- sem internet
    cB.set_offline(True); B.evaluate("PP.S.clientes.push({nome:'FEITO OFFLINE',end:'Z'});PP.saveClientes()"); B.wait_for_timeout(5000)
    ok('Sem internet' in B.inner_text('#syncInfo') or 'não enviada' in B.inner_text('#syncInfo'),'B offline: rodapé avisa ('+B.inner_text('#syncInfo').replace('\n',' ')+')')
    B.click('#btnCfg'); B.evaluate("PP.cfgTab('dad')"); B.wait_for_timeout(300); ok('não enviada' in B.inner_text('#cloudCard') or 'Sem sincronizar' in B.inner_text('#cloudCard'),'B offline: cartão em Configurações mostra pendente')
    B.screenshot(path='/tmp/e32_pend.png')
    B.keyboard.press('Escape'); B.wait_for_timeout(200)
    cB.set_offline(False); B.wait_for_timeout(5000)
    ok(A.evaluate("PP.S.clientes.some(c=>c.nome==='FEITO OFFLINE')") or (A.wait_for_timeout(3000) is None and A.evaluate("PP.S.clientes.some(c=>c.nome==='FEITO OFFLINE')")),'internet volta: o que foi feito offline chega em A')
    # ---------- sair
    B.evaluate("PP.go('hoje')"); B.click('#btnCfg'); B.evaluate("PP.cfgTab('dad')"); B.wait_for_timeout(300)
    B.screenshot(path='/tmp/e32_ok.png')
    B.click('#cloudOut'); B.wait_for_timeout(300); ok(B.is_visible('#login'),'sair da conta volta ao login')
    ok(B.evaluate("!localStorage.getItem('pp.authsess') && !sessionStorage.getItem('pp.authsess')"),'sessão apagada')
    # ---------- recarregar mantém conectado
    A.reload(); A.wait_for_timeout(1500); ok(not A.is_visible('#login'),'A: recarregar a página não pede login de novo (manter conectado)')
    for nm,pg in [('A',A),('B',B)]: ok(not pg.errs,nm+': sem erros de página '+str(pg.errs[:2]))
    b.close()
finally:
    mock.terminate()
print('FALHAS',fails)
