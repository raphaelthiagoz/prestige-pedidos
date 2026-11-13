import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
SIM='Paracheirodon simulans Neon verde'; CAR='Paracheirodon axelrodi Cardinal'
def proc(i,pack,nf,qtd,esp=SIM,**k):
    d={'id':i,'pack':pack,'sei':k.get('sei',''),'destino':'Cliente','data':'2026-10-01','status':'ativo','historico':False,'protocolado':k.get('prot',True),'dataProt':'2026-10-02','itens':[{'esp':esp,'nfId':nf,'qtd':qtd}]}
    return d
ST={'nfs':[
 {'id':'a','numero':'1676164','fornecedor':'Aramar','data':'2026-06-01','itens':[{'esp':SIM,'qtd':3000},{'esp':CAR,'qtd':1000}]},
 {'id':'c','numero':'1710124','fornecedor':'Eloisa','data':'2026-08-01','itens':[{'esp':SIM,'qtd':5000}]}],
 'processos':[proc('p1','010/2026','a',1000,sei='21010.000001/2026-01'),proc('p2','011/2026','a',500,prot=False)],
 'meta':{},'marcas':[],
 'draft':{'pack':'','sei':'','destino':'','historico':False,'linhas':[]}}
def save(pg):
    pg.evaluate("()=>{var e=PP.mapa.estado();PP.store.set('mapa',{nfs:e.nfs,processos:e.processos,meta:e.meta,draft:e.draft,marcas:e.marcas||[]});}")
def sit(pg,id): return pg.evaluate("(id)=>PP.mapa.core.sitProc(PP.mapa.estado().processos.filter(p=>p.id===id)[0])",id)
def saldo(pg,nf,esp): return pg.evaluate("([n,e])=>PP.mapa.core.saldoNF(PP.mapa.estado(),n,e)",[nf,esp])
answers=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':900}, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    def dlg(d):
        a=answers.pop(0) if answers else ''
        d.accept(a) if d.type=='prompt' else d.accept()
    pg.on('dialog', dlg)
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')")
    pg.evaluate("s=>PP.store.set('mapa',s)",ST); pg.reload(); pg.wait_for_timeout(600)
    pg.click('#nav [data-view="mapa"]'); pg.wait_for_timeout(400)
    pg.click('#mpTabs [data-tab=processos]'); pg.wait_for_timeout(300)
    ok(pg.locator('#procSit').count()==1,'Processos tem o painel de situações')
    ok('Falta protocolar (1)' in pg.inner_text('#procSit') and 'Protocolados (1)' in pg.inner_text('#procSit'),'os contadores por situação batem (1 falta protocolar, 1 protocolado)')
    ok('sem o nº do SEI' in pg.inner_text('#procSit') or pg.locator('[data-sit=aguardando]').count()==1,'pack aguardando aparece')
    ok(pg.locator('[data-sit=protocolado] [data-act=devolvproc]').count()==1 and pg.locator('[data-sit=protocolado] [data-act=indefproc]').count()==1,'pack protocolado tem "MAPA devolveu" e "MAPA indeferiu"')
    ok(pg.locator('[data-sit=aguardando] [data-act=devolvproc]').count()==0,'pack que ainda não foi protocolado não pode ser "devolvido"')
    ok(saldo(pg,'a',SIM)==1500,'saldo da NF 1676164 antes: 3000 - 1000 - 500 = 1500')
    # devolvido: mantém saldo reservado
    answers.append('nota já usada em outro processo')
    pg.click('[data-sit=protocolado] [data-act=devolvproc]'); pg.wait_for_timeout(300)
    ok(sit(pg,'p1')=='devolvido','pack 010 virou devolvido')
    ok(saldo(pg,'a',SIM)==1500,'devolvido NÃO libera o saldo (continua reservado)')
    ok('nota já usada em outro processo' in pg.inner_text('[data-sit=devolvido]'),'o motivo aparece no pack devolvido')
    ok('devolvido pelo MAPA' in pg.inner_text('[data-sit=devolvido]'),'o histórico registra a devolução')
    ok(pg.locator('#mpTabs [data-tab=processos] .badge').inner_text()=='2','a aba Processos conta 2 (1 falta protocolar + 1 devolvido)')
    ok(pg.evaluate("PP.mapa.aCorrigir().length")==1,'aCorrigir lista o pack devolvido (para o aviso do Hoje)')
    # filtro
    pg.click('#procSit [data-id=devolvido]'); pg.wait_for_timeout(200)
    ok(pg.locator('.card[data-sit]').count()==1,'o filtro "Devolvidos" mostra só 1 pack')
    pg.click('#procSit [data-id=todos]'); pg.wait_for_timeout(200)
    # protocolei de novo
    answers.append('21010.000099/2026-99')
    pg.click('[data-sit=devolvido] [data-act=reprotproc]'); pg.wait_for_timeout(300)
    ok(sit(pg,'p1')=='protocolado' and pg.evaluate("PP.mapa.estado().processos[0].sei")=='21010.000099/2026-99','"Protocolei de novo" volta a protocolado e guarda o novo SEI')
    # indeferido: libera saldo
    answers.append('quantidade acima da NF')
    pg.click('[data-sit=protocolado] [data-act=indefproc]'); pg.wait_for_timeout(300)
    ok(sit(pg,'p1')=='indeferido','pack 010 virou indeferido')
    ok(saldo(pg,'a',SIM)==2500,'indeferido LIBERA o saldo: 3000 - 500 = 2500')
    ok('Indeferidos (1)' in pg.inner_text('#procSit'),'contador de indeferidos = 1')
    ok('saldo liberado' in pg.inner_text('[data-sit=indeferido]') and 'quantidade acima da NF' in pg.inner_text('[data-sit=indeferido]'),'indeferido mostra "saldo liberado" e o motivo')
    # reativar
    pg.click('[data-sit=indeferido] [data-act=reativar]'); pg.wait_for_timeout(300)
    ok(sit(pg,'p1')=='protocolado' and saldo(pg,'a',SIM)==1500,'reativar volta o pack e o saldo (1500)')
    # aviso de nota já usada: novo pedido usando a NF 'a'
    pg.evaluate("()=>{var e=PP.mapa.estado();e.draft={pack:'031/2026',sei:'',destino:'X',historico:false,linhas:[{esp:'"+SIM+"',qtd:800,aloc:[{nfId:'a',qtd:800}]}]};PP.store.set('mapa',{nfs:e.nfs,processos:e.processos,meta:e.meta,draft:e.draft,marcas:e.marcas||[]});}")
    v=pg.evaluate("()=>{var S=PP.mapa.estado();return PP.mapa.core.validarDraft(S,S.draft)}")
    ok(v['erros']==0 and v['reuso']==1,'NF já usada em outros packs gera 1 aviso de reuso e nenhum erro')
    ok(len(v['linhas'][0]['reuso'][0]['usos'])==2,'o aviso lista os 2 packs que já usaram a NF (010 e 011)')
    ok(v['reusoGrave']==0,'sem pack devolvido/indeferido o aviso não é grave')
    # grave: pack devolvido com a mesma NF
    answers.append('nota repetida')
    pg.click('#mpTabs [data-tab=processos]'); pg.click('[data-sit=protocolado] [data-act=devolvproc]'); pg.wait_for_timeout(300)
    pg.click('#mpTabs [data-tab=verificar]'); pg.wait_for_timeout(500)
    txt=pg.inner_text('#vMapa')
    ok('já foi usada em outro processo' in txt,'a tela Verificar mostra o aviso "já foi usada em outro processo"')
    ok('devolvido' in txt.lower() and 'nota repetida' in txt,'o aviso grave mostra o pack devolvido e o motivo')
    ok(pg.locator('#banner .b-w').count()==1,'o banner fica amarelo quando a NF já apareceu em pack devolvido')
    # gravação continua permitida (aviso não bloqueia)
    v=pg.evaluate("()=>{var S=PP.mapa.estado();return PP.mapa.core.validarDraft(S,S.draft)}")
    ok(v['erros']==0,'o aviso não bloqueia a gravação')
    # cancelado nao entra no aviso
    pg.click('#mpTabs [data-tab=processos]'); pg.wait_for_timeout(200)
    pg.click('[data-sit=aguardando] [data-act=cancelproc]'); pg.wait_for_timeout(300)
    ok(sit(pg,'p2')=='cancelado' and saldo(pg,'a',SIM)==2000,'cancelar o 011 libera 500 (3000-1000=2000)')
    ok('Cancelados (1)' in pg.inner_text('#procSit'),'contador de cancelados = 1')
    # histórico não avisa
    v=pg.evaluate("()=>{var S=PP.mapa.estado();S.draft.historico=true;var r=PP.mapa.core.validarDraft(S,S.draft);S.draft.historico=false;return r}")
    ok(v['reuso']==0,'registro de histórico não gera aviso de reuso')
    # regras: não devolve o que não foi protocolado
    r=pg.evaluate("()=>{var S=PP.mapa.estado();var q=S.processos.filter(p=>p.id==='p2')[0];return PP.mapa.core.mudarSit(S,'p2','devolvido',{nota:'x'})}")
    ok(r['ok']==False,'cancelado não pode virar devolvido')
    ok(not errs,'sem erros de JavaScript: '+str(errs))
    b.close()
print('\nFALHAS:',len(fails)); sys.exit(1 if fails else 0)
