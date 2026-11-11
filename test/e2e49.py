import sys, os
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e49/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
MAIL="""11/nov/26\tQUARTA FEIRA\tDEST\tLOTE 4\tQTD\tPESO\tENTREGA\tHORARIO\tVOO\t\t
PRESTIGE\tMICHELLE APARECIDA\tGRU\t957-43215480\t12,0\t96,0\t11/nov\ttarde\tLA3847/12\t\t06:30
PRESTIGE\tLEONARDO\tPOA\t957-43217241\t11,0\t88,0\t11/nov\ttarde\tLA3847/12\tLA3420/12\t15:15
PRESTIGE\tLUIZ\tSLZ\t957-43218011\t7,0\t46,0\t11/nov\ttarde\tLA3847/12\tLA3612/12\t16:25
PRESTIGE\tRENATO\tSLZ\t957-43218475\t3,0\t24,0\t11/nov\ttarde\tLA3847/12\tLA3612/12\t16:25
PRESTIGE\tWOLCKMAR\tREC\t957-43219024\t3,0\t24,0\t11/nov\ttarde\tLA3847/12\tLA3676/12\t18:45
PRESTIGE\tMAEDA\tBSB\t957-43219691\t6,0\t48,0\t11/nov\ttarde\tLA3747/12\t\t08:30
PRESTIGE\tICARO DOUGLAS\tFOR\t957-43220144\t6,0\t48,0\t11/nov\ttarde\tLA4510/12\t\t13:10
Segue chave Pix, deposito para Dmarcos:
"""
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1400,'height':1000},service_workers='block').new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.evaluate("document.getElementById('config').open=false")
    pg.evaluate("""()=>{
      const L=(id,c,a,cx,aw)=>({id,cliente:c,aero:a,cidade:'',caixas:cx,peso:'',dim:'',awb:aw||'',status:'programado',chegou:'',obs:'',pedidoId:''});
      PP.S.embarques=[{id:'e1',titulo:'Quarta',saida:'2026-11-11',chegadaPrev:'2026-11-12',linhas:[L('a','MICHELE APARECIDA','GRU',12),L('b','LEONARDO MATIAS','POA',11),L('c','LUIZ DUTRA','SLZ',7),L('d','RENATO XAVIER','SLZ',3),L('e','WOLCKMAR ALMEIDA','REC',3),L('f','MAEDA AQUARIOS','BSB',6),L('g','ICARO DOUGLAS','FOR',6),L('h','SEM LINHA NO EMAIL','CNF',2)]}];
      PP.store.set('embarques',PP.S.embarques);
      // CTE já anexado só para a Michele (casa por AWB, apesar do nome escrito diferente)
      const D=PP.store.get('fretes',{cfg:{taxa:90},rec:{}}); D.rec['e1|a']={awb:'957-43215480',cte:'000.180.233',frete:763.61}; PP.store.set('fretes',D);}""")
    pg.reload(); pg.wait_for_timeout(600); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.evaluate("document.getElementById('config').open=false")
    pg.click('#nav button[data-view="frete"]'); pg.wait_for_timeout(300)
    ok(pg.locator('.frmail summary').count()==1,'bloco "Colar o e-mail do despachante" existe')
    pg.evaluate("document.querySelector('.frmail').open=true")
    pg.fill('#frMail',MAIL); pg.click('[data-fr="mailgo"]'); pg.wait_for_timeout(400)
    msg=pg.inner_text('.frmail .warnbox'); print(msg)
    H=lambda k: pg.input_value(f'[data-fi="hora"][data-k="e1|{k}"]')
    exp={'a':'06:30','b':'15:15','c':'16:25','d':'16:25','e':'18:45','f':'08:30','g':'13:10'}
    for k,v in exp.items(): ok(H(k)==v,'hora do cliente %s = %s (%s)'%(k,v,H(k)))
    ok(H('h')=='','cliente que não está no e-mail fica sem hora')
    ok('Sem linha no e-mail: SEM LINHA NO EMAIL' in msg,'avisa quem ficou de fora')
    ok('casou por: AWB' in msg,'Michele casou pelo AWB (nome escrito diferente)')
    ok('LA3847/12 → LA3420/12' in pg.inner_text('#vFrete'),'mostra a conexão do voo (Leonardo/POA)')
    ok(pg.locator('.frprev.ok').count()>=7,'selo "e-mail do despachante" nas linhas')
    pg.screenshot(path=OUT+'email.png',full_page=False)
    # editar à mão tira o selo
    pg.fill('[data-fi="hora"][data-k="e1|f"]','09:00'); pg.dispatch_event('[data-fi="hora"][data-k="e1|f"]','change'); pg.wait_for_timeout(250)
    ok(H('f')=='09:00','pode corrigir a hora à mão')
    pg.evaluate("document.querySelector('.frmail').open=true"); pg.fill('#frMail','texto sem tabela'); pg.click('[data-fr="mailgo"]'); pg.wait_for_timeout(250)
    ok('Não achei nenhuma linha' in pg.inner_text('.frmail .warnbox'),'texto sem AWB: mensagem clara')
    ok(errs==[],'sem erros de JS %s'%errs)
    b.close()
print('FALHAS:',fails); sys.exit(1 if fails else 0)
