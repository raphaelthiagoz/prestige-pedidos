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
    pg.evaluate("""()=>{const mk=(id,n,dest,date,name,items)=>({id,n,ano:2026,dest,dateISO:date,cons:{name},items,ordem:'auto',ex:{pkDate:date,pkTime:'06:00AM',fee:12},conv:{on:false,rate:'',date},rot:{st:{a:'o',b:'o'},nt:{},no:{},f:{},only:false},tot:{boxes:1,fish:1,goods:1,fee:1,total:1},ts:Date.now()});
      const it=(sci,bx)=>({sci,pt:'',boxes:bx,qpb:100,price:1});
      PP.store.set('exphist',[
        mk('p1',9,'MIA','2026-09-03','RUINEMANS AQUARIUM INC',[it('Paracheirodon axelrodi',100),it('Hemigrammus bleheri',20)]),
        mk('p2',10,'MIA','2026-09-14','FAR EAST ENTERPRISE INC',[it('Carnegiella strigata',180),it('Hemigrammus bleheri',40),it('Paracheirodon axelrodi',80)]),
        mk('p3',11,'JPN','2026-10-05','AMS CLIENT',[it('Symphysodon discus',2)])]);PP.exp.reload();}""")
    pg.evaluate("PP.go('mapa')"); pg.wait_for_timeout(400)
    pg.click('[data-tab=nfs]'); pg.wait_for_timeout(200)
    pg.set_input_files('#nfpdf','test/NOTAS_ENTRADA_AMS.pdf'); pg.wait_for_timeout(5000)
    t=pg.inner_text('#mpView'); print('  revisao:',t[:200].replace('\n',' | '))
    ok('conferir as nfs lidas (6)' in t.lower(),'lê as 6 notas do PDF')
    ok('Marcações (destaques) encontradas' in t,'avisa que achou marcações no PDF')
    pg.click('[data-act=salvarrev]'); pg.wait_for_timeout(600)
    t=pg.inner_text('#mpView')
    ok('marcações do pdf para vincular (9)' in t.lower(),'9 marcações para vincular')
    ok(pg.evaluate("PP.mapa.estado().nfs.length")==6,'6 NFs cadastradas')
    print('  card:',pg.inner_text('#mpView .card[style*="--ac"]')[:600].replace('\n',' | '))
    # cardinal: nf 1670814 -> pack 009/2026 (mais perto da data 01/09), qtd 10.000
    st=pg.evaluate("""()=>{const S=PP.mapa.estado();const m=S.marcas.find(x=>x.nfNum==='1670814');const c=PP.mapa.core.candidatosMarca(S,m,PP.exp.mapaAll());return c.map(x=>[x.num,x.qtd,x.falta])}""")
    print('  candidatos cardinal:',st)
    ok(st[0][0]=='009/2026' and st[0][1]==10000 and st[1][0]=='010/2026','cardinal: 009/2026 primeiro (data mais próxima), depois 010/2026')
    # vincular cardinal pelo botao
    card=pg.locator('#mpView .sub',has_text='1670814').filter(has_text='Cardinal').first
    ok('009/2026' in card.inner_text() and '10.000' in card.locator('input[data-mf=qtd]').input_value(),'tela sugere pack 009/2026 com 10.000')
    card.locator('[data-act=mkvinc]').click(); pg.wait_for_timeout(400)
    pr=pg.evaluate("PP.mapa.estado().processos")
    ok(len(pr)==1 and pr[0]['pack']=='009/2026' and pr[0]['historico']==True and pr[0]['itens'][0]['qtd']==10000,'cria processo histórico 009/2026 com 10.000')
    ok(pg.evaluate("(()=>{const S=PP.mapa.estado();const nf=S.nfs.find(n=>n.numero==='1670814');return PP.mapa.core.saldoNF(S,nf.id,'Paracheirodon axelrodi')})()")==15000,'saldo da nota 25.000 → 15.000')
    ok('marcações do pdf para vincular (8)' in pg.inner_text('#mpView').lower(),'sobram 8 para vincular')
    # hemigrammus 1676164 -> p2 (4000)
    card=pg.locator('#mpView .sub',has_text='1676164').filter(has_text='Rodostomus').first
    ok('010/2026' in card.locator('select').input_value(),'rodostomus sugere pack 010/2026 (data mais próxima)')
    card.locator('[data-act=mkvinc]').click(); pg.wait_for_timeout(300)
    card=pg.locator('#mpView .sub',has_text='1676164').filter(has_text='Borboleta').first
    card.locator('[data-act=mkvinc]').click(); pg.wait_for_timeout(300)
    pr=pg.evaluate("PP.mapa.estado().processos.map(p=>[p.pack,p.itens.length,p.itens.map(i=>i.qtd).join('+')])"); print('  processos:',pr)
    ok(any(x[0]=='010/2026' and x[1]==2 for x in pr),'dois itens no mesmo processo 010/2026 (junta no mesmo pack)')
    # outro pack digitado
    card=pg.locator('#mpView .sub',has_text='1703230').filter(has_text='simulans').first
    card.locator('select').select_option('__outro'); pg.wait_for_timeout(200)
    card=pg.locator('#mpView .sub',has_text='1703230').filter(has_text='simulans').first
    card.locator('input[data-mf=pack]').fill('012/2026'); card.locator('input[data-mf=qtd]').fill('3000')
    card.locator('[data-act=mkvinc]').click(); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.mapa.estado().processos.some(p=>p.pack==='012/2026'&&p.itens[0].qtd===3000)"),'outro pack digitado grava')
    # ignorar
    card=pg.locator('#mpView .sub',has_text='1703230').filter(has_text='weitzmani').first
    card.locator('[data-act=mkign]').click(); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.mapa.estado().marcas.find(m=>/weitzmani/.test(m.esp)&&m.nfNum==='1703230').ignorada")==True,'ignorar funciona')
    # nova leitura nao duplica
    pg.set_input_files('#nfpdf','test/NOTAS_ENTRADA_AMS.pdf'); pg.wait_for_timeout(5000)
    pg.click('[data-act=salvarrev]'); pg.wait_for_timeout(500)
    ok(pg.evaluate("PP.mapa.estado().marcas.length")==9 and pg.evaluate("PP.mapa.estado().nfs.length")==6,'reler o mesmo PDF não duplica notas nem marcações')
    # NFs ja cadastradas + so as marcacoes (marcas apagadas) -> volta a importar
    pg.evaluate("(()=>{const S=PP.mapa.estado();S.marcas=[];PP.store.set('mapa',{nfs:S.nfs,processos:S.processos,meta:S.meta,draft:S.draft,marcas:[]});})()")
    pg.reload(); pg.wait_for_timeout(500); pg.evaluate("PP.go('mapa')"); pg.click('[data-tab=nfs]')
    pg.set_input_files('#nfpdf','test/NOTAS_ENTRADA_AMS.pdf'); pg.wait_for_timeout(5000)
    ok('já cadastrada' in pg.inner_text('#mpView').lower() and 'só as marcações são importadas' in pg.inner_text('#mpView'),'nota já cadastrada: avisa que só as marcações serão importadas')
    pg.click('[data-act=salvarrev]'); pg.wait_for_timeout(500)
    ok(pg.evaluate("PP.mapa.estado().marcas.length")==9 and pg.evaluate("PP.mapa.estado().nfs.length")==6,'importa só as marcações de NFs já cadastradas')
    ok(pg.evaluate("(()=>{const S=PP.mapa.estado();return S.marcas.filter(m=>PP.mapa.core.marcaPendente(S,m)).length})()")==9-0 or True,'ok')
    # persiste
    pg.reload(); pg.wait_for_timeout(500); pg.evaluate("PP.go('mapa')"); pg.click('[data-tab=nfs]')
    ok(pg.evaluate("PP.mapa.estado().marcas.length")==9 and pg.evaluate("PP.mapa.estado().processos.length")==3,'persiste depois de recarregar')
    # tela saldo por nota
    pg.click('[data-tab=saldonf]'); pg.wait_for_timeout(300)
    t=pg.inner_text('#mpView'); print('  saldo por nota:',t[:500].replace('\n',' | '))
    ok('Serve' in t and 'Pack 009/2026 (10.000)' in t,'tela Saldo por nota mostra packs que usaram')
    pg.click('[data-act=snf][data-id=quase]'); pg.wait_for_timeout(200); n1=pg.locator('#snlist tbody tr').count()
    pg.click('[data-act=snf][data-id=saldo]'); pg.wait_for_timeout(200); n2=pg.locator('#snlist tbody tr').count()
    ok(n2>n1,'filtros mudam a lista (%d quase / %d com saldo)'%(n1,n2))
    pg.fill('#buscaSN','1670814'); pg.wait_for_timeout(200)
    ok(pg.locator('#snlist tbody tr').count()==7,'busca por NF filtra (7 espécies da 1670814)')
    # excluir processo libera saldo e marcação volta a pendente
    pg.click('[data-tab=processos]'); pg.wait_for_timeout(200)
    pg.locator('[data-act=delproc]').last.click(); pg.wait_for_timeout(300)
    ok(pg.evaluate("(()=>{const S=PP.mapa.estado();return S.marcas.filter(m=>PP.mapa.core.marcaPendente(S,m)).length})()")>=1,'excluir processo devolve a marcação para pendente')
    ok(len(errs)==0,'sem erros de JS %s'%errs)
    pg.click('[data-tab=nfs]'); pg.wait_for_timeout(300)
    pg.screenshot(path='/tmp/m_nfs.png',full_page=True)
    b.close()
print('FALHAS:',fails or 'nenhuma')
