import sys, os
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e55/'; os.makedirs(OUT,exist_ok=True)
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
    ok('PRINT' in pg.inner_text('#frDrop'),'caixa explica que aceita o PRINT do e-mail')
    import base64
    b64=base64.b64encode(open('test/fx/real_mail_print.png','rb').read()).decode()
    pg.evaluate("""(b)=>{const by=Uint8Array.from(atob(b),c=>c.charCodeAt(0));const dt=new DataTransfer();dt.items.add(new File([by],'print.png',{type:'image/png'}));document.body.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));}""",b64)
    pg.wait_for_selector('.frmail .warnbox',timeout=90000); pg.wait_for_timeout(300)
    msg=pg.inner_text('.frmail .warnbox'); print(msg)
    H=lambda k: pg.input_value(f'[data-fi="hora"][data-k="e1|{k}"]')
    exp={'a':'06:30','b':'15:15','c':'16:25','d':'16:25','e':'18:45','f':'08:30','g':'13:10'}
    for k,v in exp.items(): ok(H(k)==v,'PRINT REAL: hora do cliente %s = %s (%s)'%(k,v,H(k)))
    ok(H('h')=='','cliente fora do print fica sem hora')
    ok('Lido do print' in msg,'avisa que veio do print (conferir)')
    pg.locator('#frFlow').scroll_into_view_if_needed(); pg.screenshot(path=OUT+'print.png')
    # modelo novo com HOJE / AMANHÃ
    ok(pg.input_value('[data-fi="modelo"]').startswith('EMBARQUE CHEGARÁ {dia} ÀS {hora} HORAS'),'modelo padrão novo: '+pg.input_value('[data-fi="modelo"]').split('\n')[0])
    pg.click('[data-fr="sel"][data-k="e1|a"]'); pg.wait_for_timeout(200)
    t=pg.input_value('[data-fi="msg"]'); print('  msg:',t.replace('\n',' / '))
    ok('CHEGARÁ AMANHÃ ÀS 06:30 HORAS' in t,'voo do dia 12 visto no dia 11 = AMANHÃ')
    ok(pg.evaluate("PP.frete.FC.msgFor('X',{hora:'06:30',frete:1,chegaDia:'2026-11-12'},{taxa:0},'2026-11-12')").startswith('EMBARQUE CHEGARÁ HOJE ÀS 06:30'),'no dia 12 a mesma mensagem diz HOJE')
    # quem tinha o modelo antigo salvo passa para o novo; modelo personalizado fica
    pg.evaluate("()=>{const D=PP.store.get('fretes');D.cfg.modelo='EMBARQUE CHEGARÁ {hora} HORAS\\nFRETE: R$ {total}';PP.store.set('fretes',D);PP.frete.reload();PP.frete.render();}"); pg.wait_for_timeout(200)
    ok('{dia}' in pg.input_value('[data-fi="modelo"]'),'modelo antigo padrão é trocado pelo novo')
    pg.evaluate("()=>{const D=PP.store.get('fretes');D.cfg.modelo='MEU TEXTO {hora}';PP.store.set('fretes',D);PP.frete.reload();PP.frete.render();}"); pg.wait_for_timeout(200)
    ok(pg.input_value('[data-fi="modelo"]')=='MEU TEXTO {hora}','modelo personalizado não é mexido')
    # cabeçalho do Nacional e modo leve
    pg.evaluate("PP.go('pedido')"); pg.wait_for_timeout(300)
    ok(pg.inner_text('#pedDel').strip()=='Apagar' and pg.evaluate("document.getElementById('cliente').getBoundingClientRect().width")>=170,'cabeçalho: botão "Apagar" e seletor de cliente com largura boa (%d px)'%pg.evaluate("document.getElementById('cliente').getBoundingClientRect().width"))
    ok(not pg.evaluate("document.documentElement.classList.contains('fx-full')"),'modo leve é o padrão')
    pg.click('#btnCfg'); pg.wait_for_timeout(200); pg.click('#config [data-cgo="apa"]'); pg.check('#fxFull'); pg.wait_for_timeout(150)
    ok(pg.evaluate("document.documentElement.classList.contains('fx-full')"),'"Efeitos completos" liga o desfoque de volta')
    ok(not errs,'sem erros de JS: %s'%errs)
    b.close()
print('\nFALHAS:',fails if fails else 'nenhuma'); sys.exit(1 if fails else 0)
