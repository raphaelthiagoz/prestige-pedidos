import sys, os, json, base64, re
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
b64=lambda f: base64.b64encode(open(f,'rb').read()).decode()
ANEXOS=[{'@odata.type':'#microsoft.graph.fileAttachment','name':'CTE - 957-43218011 - LUIZ.pdf','contentType':'application/pdf','size':90000,'isInline':False,'contentBytes':b64('test/fx/real_cte_luiz.pdf')},
        {'@odata.type':'#microsoft.graph.fileAttachment','name':'CTE - 957-43220144 - ICARO.pdf','contentType':'application/pdf','size':90000,'isInline':False,'contentBytes':b64('test/fx/real_cte_icaro.pdf')},
        {'@odata.type':'#microsoft.graph.fileAttachment','name':'CTE - WOLCKMAR.pdf','contentType':'application/pdf','size':90000,'isInline':False,'contentBytes':b64('test/fx/real_cte_wolckmar.pdf')},
        {'@odata.type':'#microsoft.graph.fileAttachment','name':'image001.png','contentType':'image/png','size':120000,'isInline':True,'contentBytes':b64('test/fx/real_mail_print.png')},
        {'@odata.type':'#microsoft.graph.fileAttachment','name':'logo.png','contentType':'image/png','size':900,'isInline':True,'contentBytes':base64.b64encode(b'x'*600).decode()}]
TAB="<table>"+"".join("<tr>"+"".join(f"<td>{c}</td>" for c in r)+"</tr>" for r in [
 ['PRESTIGE','LUIZ','SLZ','957-43218011','7,0','46,0','11/nov','tarde','LA3847/12','LA3612/12','16:25'],
 ['PRESTIGE','ICARO DOUGLAS','FOR','957-43220144','6,0','48,0','11/nov','tarde','LA4510/12','','13:10']])+"</table>"
MSGS=[{'id':'m1','subject':'CTE','receivedDateTime':'2026-11-11T17:59:00Z','hasAttachments':True,'from':{'emailAddress':{'address':'exp.emissao@dmarcos.com.br'}}},
      {'id':'mX','subject':'Promoção','receivedDateTime':'2026-11-11T16:00:00Z','hasAttachments':False,'from':{'emailAddress':{'address':'loja@exemplo.com'}}},
      {'id':'m2','subject':'Tabela em texto','receivedDateTime':'2026-11-10T12:00:00Z','hasAttachments':False,'from':{'emailAddress':{'address':'Exp.Emissao@dmarcos.com.br'}}}]
pedidos=[]
def graph(route):
    u=route.request.url; pedidos.append((u, route.request.headers.get('authorization')))
    if re.search(r'/me/messages\?',u): body={'value':MSGS}
    elif u.split('?')[0].endswith('/m1/attachments'): body={'value':ANEXOS}
    elif u.split('?')[0].endswith('/me/messages/m1'): body={'subject':'CTE','body':{'contentType':'html','content':'<p>Boa tarde! Segue o cte.</p><img src="cid:image001.png">'}}
    elif u.split('?')[0].endswith('/me/messages/m2'): body={'subject':'Tabela','body':{'contentType':'html','content':'<p>Segue</p>'+TAB}}
    else: body={'value':[]}
    route.fulfill(status=200,content_type='application/json',body=json.dumps(body))
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':1000},service_workers='block'); pg=ctx.new_page(); pg.clock.set_fixed_time('2026-11-11T16:00:00-04:00')
    pg.on('pageerror',lambda e:errs.append(str(e))); ctx.route('https://graph.microsoft.com/**',graph)
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500); pg.evaluate("sessionStorage.setItem('pp.asShown','1')")
    pg.evaluate("""()=>{const L=(id,c,a,cx)=>({id,cliente:c,aero:a,cidade:'',caixas:cx,peso:'',dim:'',awb:'',status:'programado',chegou:'',obs:'',pedidoId:''});
      PP.S.embarques=[{id:'e1',titulo:'Quarta',saida:'2026-11-11',chegadaPrev:'2026-11-12',linhas:[L('a','MICHELE APARECIDA','GRU',12),L('b','LEONARDO MATIAS','POA',11),L('c','LUIZ DUTRA','SLZ',7),L('d','RENATO XAVIER','SLZ',3),L('e','WOLCKMAR ALMEIDA','REC',3),L('f','MAEDA AQUARIOS','BSB',6),L('g','ICARO DOUGLAS','FOR',6)]}];
      PP.store.set('embarques',PP.S.embarques); PP.store.set('fretes',{cfg:{taxa:90},rec:{}});}""")
    pg.reload(); pg.wait_for_timeout(1200); pg.evaluate("sessionStorage.setItem('pp.asShown','1')")
    pg.click('#nav button[data-view="frete"]'); pg.wait_for_timeout(400)
    ok(pg.is_visible('[data-ol="buscar"]'),'botão "Buscar e-mail do despachante (Outlook)" na caixa do print')
    pg.click('[data-ol="buscar"]'); pg.wait_for_timeout(500)
    ok('ID do aplicativo' in pg.inner_text('#olBox'),'sem configurar: explica que falta o ID do aplicativo')
    pg.click('[data-ol="cfg"]'); pg.wait_for_timeout(200)
    ok(pg.is_visible('#olId') and pg.input_value('#olRem')=='exp.emissao@dmarcos.com.br','configuração: ID do aplicativo e e-mail do despachante já preenchido')
    pg.fill('#olId','11111111-2222-3333-4444-555555555555'); pg.dispatch_event('#olId','change'); pg.wait_for_timeout(200)
    ok(pg.evaluate("PP.store.get('outlook').clientId")=='11111111-2222-3333-4444-555555555555','ID do aplicativo fica salvo')
    # login simulado (a Microsoft de verdade só no seu navegador)
    pg.evaluate("PP.outlook.tokenFake='TOKEN-TESTE'")
    pg.click('[data-ol="buscar"]')
    pg.wait_for_function("(document.getElementById('olMsg')||{}).textContent && /E-mail usado/.test(document.getElementById('olMsg').textContent) && document.getElementById('frPrintMsg')",timeout=150000); pg.wait_for_timeout(500)
    R=lambda k: pg.evaluate("(k)=>PP.store.get('fretes').rec[k]||{}",'e1|'+k)
    msg=pg.inner_text('#olMsg'); print('  ',msg)
    ok('"CTE"' in msg and '3 CT-e' in msg and 'imagem' in msg,'usou o e-mail mais novo do despachante: 3 CT-es + imagem da tabela')
    ok(all(h.startswith('Bearer TOKEN-TESTE') for _,h in pedidos),'todas as chamadas vão para a Microsoft com o acesso do login')
    ok(all('graph.microsoft.com/v1.0/me/messages' in u for u,_ in pedidos),'só lê mensagens (nenhuma chamada de envio ou apagar)')
    ok(R('c').get('frete',0)>0 and R('g').get('frete',0)>0 and R('e').get('frete',0)>0,'CT-es do LUIZ, ICARO e WOLCKMAR lidos dos anexos: %s'%[R(k).get('frete') for k in 'ceg'])
    ok(R('c').get('hora')=='16:25' and R('g').get('hora')=='13:10' and R('f').get('hora')=='08:30' and R('a').get('hora')=='06:30','horas lidas da imagem anexada (16:25, 13:10, 08:30, 06:30)')
    ok('loja@exemplo.com' not in pg.inner_text('#olBox') and pg.locator('[data-ol="usar"]').count()==2,'lista só e-mails do despachante (ignora outro remetente; maiúsculas não importam)')
    pg.screenshot(path='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/outlook_frete.png')
    # e-mail com a tabela em TEXTO (HTML)
    pg.evaluate("()=>{const D=PP.store.get('fretes'); Object.values(D.rec).forEach(r=>{delete r.hora}); PP.store.set('fretes',D); PP.frete.reload(); PP.frete.render();}")
    pg.click('.olout summary'); pg.click('[data-ol="usar"][data-id="m2"]')
    pg.wait_for_function("/Tabela em texto/.test((document.getElementById('olMsg')||{}).textContent||'')",timeout=60000); pg.wait_for_timeout(400)
    ok('texto do e-mail' in pg.inner_text('#olMsg') and R('c').get('hora')=='16:25' and R('g').get('hora')=='13:10','e-mail com a tabela em texto: lê direto do corpo, sem imagem')
    # acesso expirado
    ctx.unroute('https://graph.microsoft.com/**'); ctx.route('https://graph.microsoft.com/**',lambda r: r.fulfill(status=401,body='{}'))
    pg.click('[data-ol="buscar"]'); pg.wait_for_function("/expirou/.test((document.getElementById('olMsg')||{}).textContent||'')",timeout=30000)
    ok(True,'acesso vencido: pede para entrar de novo')
    ok(not errs,'sem erros de JavaScript: %s'%errs[:2])
    b.close()
print('\nFALHAS:',len(fails)); sys.exit(1 if fails else 0)
