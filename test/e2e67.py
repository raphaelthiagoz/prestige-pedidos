import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
SIM='Paracheirodon simulans Neon verde'
ST={'nfs':[
 {'id':'a','numero':'1676164','fornecedor':'Aramar','data':'2026-06-01','arq':'x','itens':[{'esp':SIM,'qtd':3000}]},
 {'id':'b','numero':'1710124','fornecedor':'Eloisa','data':'2026-12-20','itens':[{'esp':SIM,'qtd':5000}]}],
 'processos':[],'meta':{'pesc':[{'id':'p-aramar','nome':'Aramar','ctf':'2026-01-01','ctfSalvo':True,'rgpSalvo':True,'rgpVal':''}],
   'docs':[{'id':'d-lic','nome':'Licença ambiental','venc':'2027-06-30'},{'id':'d-proc','nome':'Procuração','venc':'2026-10-01'}]},'marcas':[],
 'draft':{'pack':'','sei':'','destino':'','historico':False,'linhas':[]}}
def ck(pg,pk,opt='{}'):
    return pg.evaluate("([pk,opt])=>{var S=PP.mapa.estado();return PP.mapa.core.checklistPack(S,pk,opt)}",[pk,eval(opt) if False else {}])
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':900}, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')")
    pg.evaluate("s=>PP.store.set('mapa',s)",ST); pg.reload(); pg.wait_for_timeout(600)
    # --- lógica pura
    r=pg.evaluate("()=>{var S=PP.mapa.estado();return PP.mapa.core.checklistPack(S,{pack:'030/2026',destino:'Cliente X',data:'2026-11-10',itens:[{esp:'"+SIM+"',nfId:'a',qtd:500},{esp:'"+SIM+"',nfId:'b',qtd:100}]},{})}")
    txt=' | '.join(i['s']+':'+i['t'] for i in r)
    ok(any(i['s']=='erro' and '1710124' in i['t'] and 'posterior' in i['t'] for i in r),'NF de dezembro em pack de novembro: erro de data posterior')
    ok(any(i['s']=='erro' and 'Procuração vencida' in i['t'] for i in r),'procuração vencida em 01/10/2026 gera erro')
    ok(any(i['s']=='ok' and 'Licença ambiental em dia' in i['t'] for i in r),'licença válida até 2027 aparece OK')
    ok(any(i['s']=='erro' and 'CTF' in i['t'] and 'Aramar' in i['t'] for i in r),'CTF do Aramar vencido gera erro')
    ok(any(i['s']=='aviso' and 'sem PDF' in i['t'] and '1710124' in i['t'] for i in r),'NF sem PDF anexado gera atenção')
    r2=pg.evaluate("()=>{var S=PP.mapa.estado();S.meta.docs=[];S.meta.pesc=[];return PP.mapa.core.checklistPack(S,{pack:'031/2026',destino:'Y',data:'2026-11-10',itens:[{esp:'"+SIM+"',nfId:'a',qtd:500}]},{})}")
    ok(not any(i['s']=='erro' for i in r2),'sem pendências: nenhum erro (NF anterior, sem docs, sem CTF cadastrado)')
    # --- tela: passo 5 mostra o checklist
    ST2=dict(ST); ST2['draft']={'pack':'030/2026','sei':'','destino':'Cliente X','data':'2026-11-10','historico':False,'linhas':[{'esp':SIM,'qtd':600,'aloc':[{'nfId':'a','qtd':500},{'nfId':'b','qtd':100}]}]}
    pg.evaluate("s=>PP.store.set('mapa',s)",ST2); pg.reload(); pg.wait_for_timeout(600)
    pg.click('#nav [data-view="mapa"]'); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector('#mpWiz [data-act=etapa][data-n=\"5\"]').click()"); pg.wait_for_timeout(300)
    ok(pg.locator('#mpPasso .checklist').count()==1,'passo 5 mostra o checklist antes de gravar')
    ok(pg.locator('#mpPasso .checklist').get_attribute('data-ck')=='erro','o checklist fica em vermelho quando há item para corrigir')
    t=pg.inner_text('#mpPasso .checklist')
    ok('Corrigir' in t and 'Procuração vencida' in t,'o checklist lista "Corrigir" e a procuração vencida')
    # confirmar menciona o checklist
    msgs=[]
    pg.remove_listener('dialog', pg.listeners('dialog')[0]) if hasattr(pg,'listeners') and False else None
    pg.on('dialog', lambda d: msgs.append(d.message))
    pg.click('#mpPasso [data-act=protocolar]'); pg.wait_for_timeout(500)
    ok(any('checklist' in m for m in msgs),'ao gravar, o aviso menciona os itens do checklist')
    ok(pg.evaluate("PP.mapa.estado().processos.length")==1,'mesmo assim dá para gravar (o checklist não bloqueia)')
    # passo 6 e Processos mostram o checklist do pack
    ok(pg.locator('#mpPasso details.checklist').count()==1,'passo 6 mostra o checklist do pack gravado')
    pg.click('#mpTabs [data-tab=processos]'); pg.wait_for_timeout(300)
    ok(pg.locator('[data-sit=aguardando] details.checklist').count()==1,'Processos mostra o checklist no pack que falta protocolar')
    # --- documentos da empresa na aba Pescadores
    pg.click('#mpTabs [data-tab=pesc]'); pg.wait_for_timeout(300)
    ok(pg.locator('#docsEmp input[data-df=venc]').count()==2,'Pescadores tem os 2 documentos da empresa')
    pg.fill('#docsEmp input[data-did=d-proc][data-df=venc]','2027-03-01'); pg.dispatch_event('#docsEmp input[data-did=d-proc][data-df=venc]','change'); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.mapa.estado().meta.docs.filter(d=>d.id==='d-proc')[0].venc")=='2027-03-01','a nova validade da procuração fica salva')
    ok('Em dia' in pg.inner_text('#docsEmp'),'a procuração passa a aparecer "Em dia"')
    pg.click('#docsEmp [data-act=adddoc]'); pg.wait_for_timeout(300)
    ok(pg.locator('#docsEmp input[data-df=nome]').count()==3,'dá para adicionar outro documento')
    ok(not errs,'sem erros de JavaScript: '+str(errs))
    b.close()
print('\nFALHAS:',len(fails)); sys.exit(1 if fails else 0)
