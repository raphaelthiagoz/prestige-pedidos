import sys, json, datetime, os, re
sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
SP=os.environ.get('SP','/tmp')
today=datetime.date(2026,11,5)  # quinta; o relógio do navegador é fixado abaixo
mon=today-datetime.timedelta(days=today.weekday())
def d(n): return (mon+datetime.timedelta(days=n)).isoformat()
SPEC={'CARD':('PARACHEIRODON AXELRODI','NEON CARDINAL',0.5),'CORY':('CORYDORAS PANDA','CORYDORAS PANDA',1.2),'RUM':('HEMIGRAMMUS RHODOSTOMUS','RUMMY NOSE',0.9),'DISC':('SYMPHYSODON AEQUIFASCIATUS','ACARÁ DISCO',6.0)}
def nac(i,dia,cli,items,mort=None):
    lines=[];cx=0;pe=0;val=0
    for k,(sp,boxes,peixes) in enumerate(items):
        sci,com,pr=SPEC[sp]; lines.append({'key':sp,'sci':sci,'comum':com,'nome':com,'preco':pr,'peixes':peixes,'boxes':boxes,'qtyBox':peixes//boxes}); cx+=boxes;pe+=peixes;val+=peixes*pr
    tot=round(val+36*cx,2)
    e={'id':'n%d'%i,'ts':1000+i,'cliente':{'nome':cli},'inv':str(100+i),'nf':'','dataISO':dia,'totais':{'caixas':cx,'peixes':pe,'valor':round(val,2),'total':tot},'pay':{'status':'pago' if i%2 else 'aguardando','pago':0},'lines':lines}
    if mort: e['mort']=mort
    return e
def exp(i,dia,dest,cli,items,rate):
    boxes=sum(b for _,b,_,_ in items); fish=sum(b*q for _,b,q,_ in items); goods=sum(b*q*p for _,b,q,p in items); fee=boxes*12
    return {'id':'x%d'%i,'n':20+i,'ano':2026,'dest':dest,'dateISO':dia,'cons':{'name':cli},'items':[{'sci':SPEC[s][0],'pt':SPEC[s][1],'boxes':b,'qpb':q,'price':p} for s,b,q,p in items],'conv':{'on':True,'rate':rate,'date':dia,'msg':''},'ex':{},'tot':{'boxes':boxes,'fish':fish,'goods':goods,'fee':fee,'total':goods+fee},'ts':2000+i}
N=[ # semana passada (26/10..01/11 => dias -7..-1 relativos à segunda atual)
 nac(1,d(-7),'NACIONAL AQUÁRIO',[('CARD',10,4000),('CORY',2,800)], {'dead':{'0':120,'1':10},'credito':72,'mortos':130,'destino':'abater'}),
 nac(2,d(-6),'PET CENTER NORTE',[('CARD',5,2000),('RUM',4,1600)]),
 nac(3,d(-5),'NACIONAL AQUÁRIO',[('CORY',6,2400)]),
 nac(4,d(-3),'AQUA VIDA',[('DISC',3,300),('CARD',4,1600)]),
 nac(5,d(-2),'ANDRADE PET',[('RUM',3,1200)]),
 # semana anterior (19/10..25/10)
 nac(6,d(-13),'NACIONAL AQUÁRIO',[('CARD',8,3200)]),
 nac(7,d(-10),'PET CENTER NORTE',[('CORY',4,1600),('RUM',2,800)]),
 # esta semana (02/11..)
 nac(8,d(0),'LOJA DO PEIXE',[('CARD',2,800)]),
 nac(9,d(2),'NACIONAL AQUÁRIO',[('RUM',5,2000)]),
 # cancelado (não pode entrar)
]
canc=nac(10,d(-4),'CANCELADO LTDA',[('CARD',50,20000)]); canc['pay']['status']='cancelado'; N.append(canc)
X=[ exp(1,d(-6),'MIA','TROPICAL IMPORTS',[('CARD',18,500,0.2),('RUM',10,400,0.25)],5.40),
    exp(2,d(-4),'AMS','AQUA EUROPE',[('CORY',8,400,0.3),('DISC',5,100,2.0)],5.50),
    exp(3,d(-2),'JPN','JAPAN FISH',[('RUM',4,400,0.25)],0),   # sem cotação salva -> usa a do dia
    exp(4,d(-12),'MIA','TROPICAL IMPORTS',[('CARD',6,500,0.2)],5.30),
    exp(5,d(-30),'MIA','TROPICAL IMPORTS',[('CARD',20,500,0.2)],5.30),
]
RATE_DIA=5.4321
# ------- esperado (semana passada = d(-7)..d(-1)) -------
a,b=d(-7),d(-1)
nn=[e for e in N if a<=e['dataISO']<=b and e['pay']['status']!='cancelado']
xx=[e for e in X if a<=e['dateISO']<=b]
exp_nac_cx=sum(e['totais']['caixas'] for e in nn); exp_nac_pe=sum(e['totais']['peixes'] for e in nn); exp_nac_val=round(sum(e['totais']['total']-(e['mort']['credito'] if e.get('mort') and e['mort']['destino']=='abater' else 0) for e in nn),2)
exp_x_cx=sum(e['tot']['boxes'] for e in xx); exp_x_usd=round(sum(e['tot']['total'] for e in xx),2); exp_x_brl=round(sum(e['tot']['total']*(e['conv']['rate'] or RATE_DIA) for e in xx),2)
print('esperado: nac',len(nn),exp_nac_cx,exp_nac_pe,exp_nac_val,'exp',len(xx),exp_x_cx,exp_x_usd,exp_x_brl)

with sync_playwright() as p:
    br=p.chromium.launch(); ctx=br.new_context(viewport={'width':1280,'height':900}, device_scale_factor=1.5, service_workers='block', accept_downloads=True); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d_: d_.accept())
    ctx.route('**/olinda.bcb.gov.br/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin':'*'}, body=json.dumps({'value':[{'cotacaoCompra':RATE_DIA}]})))
    pg.add_init_script("""(()=>{const R=Date;const fix=new R(2026,10,5,9,30).getTime();const off=fix-R.now();class D extends R{constructor(...a){if(a.length)super(...a);else super(R.now()+off)}static now(){return R.now()+off}}window.Date=D})()""")
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    ok(pg.evaluate("PP.Features.todayISO()")=='2026-11-05','relógio fixado em 05/11/2026')
    pg.evaluate("(d)=>{PP.S.hist.length=0;d.N.forEach(e=>PP.S.hist.push(e));const h=PP.exp.hist();h.length=0;d.X.forEach(e=>h.push(e));}", {'N':N,'X':X})
    pg.evaluate("localStorage.removeItem('pp.relcfg')")
    pg.click('[data-view="painel"]'); pg.wait_for_timeout(700)
    ok(pg.locator('#relBox .rpchips button').count()==5,'5 botões de período (semana, semana passada, mês, mês passado, datas)')
    ok(pg.evaluate("PP.relatorio.state.rate")==RATE_DIA,'cotação do dia buscada sozinha no Banco Central (PTAX)')
    pg.click('#relBox [data-rp="p:semana_ant"]'); pg.wait_for_timeout(400)
    R=pg.evaluate("(()=>{const r=PP.relatorio.rangeOf('semana_ant');const R=PP.relatorio.detail(r.a,r.b,'semana_ant',PP.relatorio.state.rate);return {a:r.a,b:r.b,nac:R.cur.nac,exp:R.cur.exp,caixas:R.cur.caixas,sp:R.species.map(x=>[x.k,x.nCx,x.nUn,x.xCx,x.xUn]),pv:R.pv,pc:R.prev.caixas,ch:R.change,mortos:R.mortos,cred:R.credito,dest:R.destinos.map(x=>[x.k,x.caixas,x.usd]),top:R.top&&R.top.nome,best:R.best&&R.best.d.k, big:R.big, ev:R.evo.list.map(o=>[o.n,o.x]),dias:R.dias.list.map(o=>[o.n,o.x])}})()")
    ok(R['a']==a and R['b']==b,'Semana passada = segunda a domingo %s a %s'%(R['a'],R['b']))
    ok(R['nac']['pedidos']==len(nn) and R['nac']['caixas']==exp_nac_cx and R['nac']['peixes']==exp_nac_pe,'nacional: pedidos/caixas/peixes (cancelado fora) %s'%R['nac'])
    ok(abs(R['nac']['valor']-exp_nac_val)<0.01,'nacional: valor R$ %s = %s (abatendo crédito de mortalidade)'%(R['nac']['valor'],exp_nac_val))
    ok(R['exp']['pedidos']==len(xx) and R['exp']['caixas']==exp_x_cx and abs(R['exp']['usd']-exp_x_usd)<0.01,'exportação: embarques/caixas/US$ %s'%R['exp'])
    ok(abs(R['exp']['brl']-exp_x_brl)<0.02,'exportação convertida: %s = %s (cotação do embarque; sem cotação usa a do dia)'%(R['exp']['brl'],exp_x_brl))
    ok(sum(s[1] for s in R['sp'])==R['nac']['caixas'] and sum(s[2] for s in R['sp'])==R['nac']['peixes'],'tabela de espécies fecha com o nacional (caixas e peixes)')
    ok(sum(s[3] for s in R['sp'])==R['exp']['caixas'] and sum(s[4] for s in R['sp'])==sum(e['tot']['fish'] for e in xx),'tabela de espécies fecha com a exportação')
    ok(R['pv']['a']==d(-14) and R['pv']['b']==d(-8),'período anterior = semana anterior %s a %s'%(R['pv']['a'],R['pv']['b']))
    ok(R['pc']==sum(e['totais']['caixas'] for e in N if d(-14)<=e['dataISO']<=d(-8) and e['pay']['status']!='cancelado')+sum(e['tot']['boxes'] for e in X if d(-14)<=e['dateISO']<=d(-8)),'caixas do período anterior')
    ok(R['mortos']==130 and abs(R['cred']-(120*0.5+10*1.2))<0.01,'perdas: 130 mortos, crédito R$ %s'%R['cred'])
    ok(len(R['dest'])==3,'exportação por destino: %s'%R['dest'])
    ok(len(R['dias'])==7 and len(R['ev'])==8,'gráficos: 7 dias e 8 semanas')
    ok(R['ev'][-1][0]==exp_nac_cx and R['ev'][-1][1]==exp_x_cx,'última coluna da evolução = semana do período')
    # tela + prévia
    pg.click('#relBox [data-rp="view"]'); pg.wait_for_timeout(700)
    npg=pg.locator('#relBox .rpshell').count(); ok(npg>=6,'prévia mostra %d páginas'%npg)
    txt=pg.inner_text('#relBox .rpprev')
    ok('Relatório de vendas' in txt and 'Vendas por espécie' in txt and 'Perdas e mortalidade' in txt and 'Quem mais comprou' in txt,'prévia tem capa, espécies, clientes e perdas')
    ok('Página 1 de %d'%npg in txt.replace('\n',' ') or ('Página 2 de %d'%npg) in txt.replace('\n',' '),'rodapé com numeração de páginas')
    pg.screenshot(path=SP+'/rel/app_painel.png')
    for i in range(npg):
        pg.locator('#relBox .rpshell').nth(i).screenshot(path=SP+'/rel/real_pg%d.png'%(i+1))
    # PDF
    with pg.expect_download(timeout=90000) as dl: pg.click('#relBox [data-rp="pdf"]')
    dd=dl.value; path=SP+'/rel/'+dd.suggested_filename; dd.save_as(path)
    raw=open(path,'rb').read(); ok(raw[:5]==b'%PDF-','PDF baixado: %s (%d KB)'%(dd.suggested_filename,len(raw)//1024))
    ok(len(re.findall(rb'/Type\s*/Page[^s]',raw))==npg,'PDF com %d páginas (igual à prévia)'%npg)
    ok(dd.suggested_filename=='RELATORIO_VENDAS_%s_a_%s.pdf'%(a,b),'nome do arquivo')
    # Excel
    with pg.expect_download(timeout=30000) as dl2: pg.click('#relBox [data-rp="xlsx"]')
    xp=SP+'/rel/'+dl2.value.suggested_filename; dl2.value.save_as(xp)
    import openpyxl
    wb=openpyxl.load_workbook(xp); ok(set(['Resumo','Por espécie','Por dia','Clientes','Exportação por destino','Perdas'])<=set(wb.sheetnames),'Excel com abas %s'%wb.sheetnames)
    ws=wb['Por espécie']; ok(ws.max_row==len(R['sp'])+2,'Excel: uma linha por espécie + total')
    # compartilhar (sem suporte a arquivo no Chromium de teste -> baixa e abre o WhatsApp com o resumo)
    with ctx.expect_page(timeout=30000) as popup, pg.expect_download(timeout=90000) as dl3: pg.click('#relBox [data-rp="share"]')
    ok('wa.me' in popup.value.url or popup.value.url.startswith('about') or popup.value.url.startswith('chrome-error'),'Compartilhar abre o WhatsApp (sem internet aqui no teste) %s'%popup.value.url[:60])
    pg.wait_for_timeout(300); ok('WhatsApp' in pg.inner_text('#relBox [data-rpmsg]') or 'anexar' in pg.inner_text('#relBox [data-rpmsg]'),'mensagem orienta anexar o PDF')
    # cotação manual
    pg.fill('#rpRate','6,00'); pg.dispatch_event('#rpRate','change'); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.relatorio.state.rate")==6,'cotação digitada vale (6,00)')
    # datas livres + mês
    pg.click('#relBox [data-rp="p:mes"]'); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.relatorio.rangeOf('mes')").get('a')=='2026-11-01','Este mês começa em 01/11')
    pg.click('#relBox [data-rp="p:mes_ant"]'); pg.wait_for_timeout(300)
    rr=pg.evaluate("PP.relatorio.rangeOf('mes_ant')"); ok(rr['a']=='2026-10-01' and rr['b']=='2026-10-31','Mês passado = 01/10 a 31/10')
    pv=pg.evaluate("PP.relatorio.prevOf('2026-10-01','2026-10-31','mes_ant')"); ok(pv['a']=='2026-09-01' and pv['b']=='2026-09-30','comparativo do mês = setembro inteiro')
    pg.fill('#rpA','2026-10-20'); pg.dispatch_event('#rpA','change'); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.relatorio.state.p")=='livre','mexer na data vira "Datas livres"')
    # período sem vendas
    pg.fill('#rpA','2020-01-01'); pg.dispatch_event('#rpA','change'); pg.fill('#rpB','2020-01-07'); pg.dispatch_event('#rpB','change'); pg.wait_for_timeout(300)
    ok(pg.is_disabled('#relBox [data-rp="pdf"]'),'sem vendas: botão PDF desligado')
    ok(len(errs)==0,'sem erros de JS %s'%errs)
    # celular
    m=br.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, service_workers='block'); mp=m.new_page(); mp.on('pageerror', lambda e: errs.append(str(e)))
    m.route('**/olinda.bcb.gov.br/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin':'*'}, body=json.dumps({'value':[{'cotacaoCompra':RATE_DIA}]})))
    mp.add_init_script("""(()=>{const R=Date;const fix=new R(2026,10,5,9,30).getTime();const off=fix-R.now();class D extends R{constructor(...a){if(a.length)super(...a);else super(R.now()+off)}static now(){return R.now()+off}}window.Date=D})()""")
    mp.goto('http://localhost:8765/index.html'); mp.wait_for_timeout(400); mp.evaluate(SEED); mp.evaluate("sessionStorage.setItem('pp.asShown','1')"); mp.reload(); mp.wait_for_timeout(600)
    mp.evaluate("(d)=>{PP.S.hist.length=0;d.N.forEach(e=>PP.S.hist.push(e));const h=PP.exp.hist();h.length=0;d.X.forEach(e=>h.push(e));}", {'N':N,'X':X})
    mp.evaluate("PP.go('painel')"); mp.wait_for_timeout(600); mp.click('#relBox [data-rp="p:semana_ant"]'); mp.wait_for_timeout(300); mp.click('#relBox [data-rp="view"]'); mp.wait_for_timeout(600)
    ok(mp.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"),'celular: sem rolagem horizontal')
    ok(mp.evaluate("(()=>{const s=document.querySelector('#relBox .rpshell');return s.getBoundingClientRect().width<=window.innerWidth})()"),'celular: página da prévia cabe na tela')
    mp.screenshot(path=SP+'/rel/app_cel.png')
    br.close()
print('\nFALHAS:',fails if fails else 'nenhuma'); print('TUDO OK' if not fails else 'COM FALHAS')
