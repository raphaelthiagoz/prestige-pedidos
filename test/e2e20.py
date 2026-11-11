import sys, json, os, re
sys.path.insert(0,'test')
from seed import SEED
from reldata import N, X, d, RATE_DIA
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
SP=os.environ.get('SP','/tmp')
FIX="""(()=>{const R=Date;const fix=new R(2026,10,5,9,30).getTime();const off=fix-R.now();class D extends R{constructor(...a){if(a.length)super(...a);else super(R.now()+off)}static now(){return R.now()+off}}window.Date=D})()"""
with sync_playwright() as p:
    br=p.chromium.launch(); ctx=br.new_context(viewport={'width':1280,'height':900}, service_workers='block', accept_downloads=True); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    ctx.route('**/olinda.bcb.gov.br/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin':'*'}, body=json.dumps({'value':[{'cotacaoCompra':RATE_DIA}]})))
    pg.add_init_script(FIX)
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    pg.evaluate("(d)=>{PP.S.hist.length=0;d.N.forEach(e=>PP.S.hist.push(e));const h=PP.exp.hist();h.length=0;d.X.forEach(e=>h.push(e));}", {'N':N,'X':X})
    pg.click('[data-view="painel"]'); pg.wait_for_timeout(600)
    pg.click('#relBox [data-rp="p:semana_ant"]'); pg.wait_for_timeout(300)
    pg.click('#relBox .rpcust > summary'); pg.wait_for_timeout(150)
    ok(pg.is_visible('#rpTxt') and pg.is_visible('#rpObs') and pg.is_visible('#rpTitle'),'seção "Personalizar" abre com título, resumo e observações')
    auto=pg.input_value('#rpTxt'); ok('82 caixas' in auto and 'Neon Cardinal' in auto,'caixa de resumo já vem com o texto automático')
    # editar
    pg.fill('#rpTitle','Fechamento da semana'); pg.fill('#rpBy','Raphael Sanches'); pg.fill('#rpTxt','Semana forte: fechamos 82 caixas.\nExportação puxou o resultado.'); pg.fill('#rpObs','Embarque do Japão saiu na sexta.\nFeriado na quinta.')
    pg.dispatch_event('#rpObs','change'); pg.click('#relBox [data-rp="view"]'); pg.wait_for_timeout(700)
    txt=pg.inner_text('#relBox .rpprev'); flat=re.sub(r'\s+',' ',txt)
    ok('Fechamento da semana' in flat,'título editado aparece na capa')
    ok('Semana forte: fechamos 82 caixas.' in flat and 'Exportação puxou o resultado.' in flat,'texto do resumo editado aparece')
    ok('Entre 26/10/2026' not in flat,'texto automático foi substituído')
    ok('Observações' in flat and 'Embarque do Japão saiu na sexta.' in flat and 'Feriado na quinta.' in flat,'observações aparecem numa caixa')
    ok('Preparado por Raphael Sanches' in flat,'"Preparado por" editado')
    n0=pg.locator('#relBox .rpshell').count()
    # desligar páginas
    pg.uncheck('[data-rpg="perdas"]'); pg.uncheck('[data-rpg="capa"]'); pg.wait_for_timeout(600)
    n1=pg.locator('#relBox .rpshell').count(); ok(n1==n0-2,'desligar Capa e Perdas tira 2 páginas (%d -> %d)'%(n0,n1))
    flat=re.sub(r'\s+',' ',pg.inner_text('#relBox .rpprev'))
    ok('Perdas e mortalidade' not in flat and 'Preparado por' not in flat,'páginas desligadas somem da prévia')
    ok('Página 1 de %d'%n1 in flat and ('Página %d de %d'%(n1,n1)) in flat,'numeração refeita (Página 1 de %d)'%n1)
    # PDF com as edições
    with pg.expect_download(timeout=90000) as dl: pg.click('#relBox [data-rp="pdf"]')
    path=SP+'/rel/edit_'+dl.value.suggested_filename; dl.value.save_as(path); raw=open(path,'rb').read()
    ok(raw[:5]==b'%PDF-' and len(re.findall(rb'/Type\s*/Page[^s]',raw))==n1,'PDF baixado com %d páginas (as escolhidas)'%n1)
    ok(b'Fechamento da semana' in raw,'título vai nos metadados do PDF')
    # persistência de título e páginas ao recarregar; texto/observação não persistem
    pg.reload(); pg.wait_for_timeout(700); pg.click('[data-view="painel"]'); pg.wait_for_timeout(500)
    pg.click('#relBox .rpcust > summary'); pg.wait_for_timeout(150)
    ok(pg.input_value('#rpTitle')=='Fechamento da semana' and pg.input_value('#rpBy')=='Raphael Sanches','título e "preparado por" ficam salvos')
    ok(not pg.is_checked('[data-rpg="perdas"]') and not pg.is_checked('[data-rpg="capa"]') and pg.is_checked('[data-rpg="resumo"]'),'páginas escolhidas ficam salvas')
    ok(pg.input_value('#rpObs')=='' ,'observações não ficam de um relatório para o outro')
    # trocar período volta o texto ao automático
    pg.fill('#rpTxt','texto meu'); pg.click('#relBox [data-rp="p:mes_ant"]'); pg.wait_for_timeout(300)
    ok('texto meu' not in pg.input_value('#rpTxt') and 'Entre' in pg.input_value('#rpTxt'),'trocar o período volta o resumo ao automático')
    pg.fill('#rpTxt','abc'); pg.dispatch_event('#rpTxt','change'); pg.click('[data-rp="txtauto"]'); pg.wait_for_timeout(300)
    ok('abc' not in pg.input_value('#rpTxt'),'botão "Voltar ao texto automático"')
    # impedir desligar todas as páginas
    for k in ['capa','resumo','evolucao','especies','clientes','perdas']:
        try: pg.uncheck('[data-rpg="%s"]'%k)
        except Exception: pass
    ok(pg.evaluate("Object.values(PP.relatorio.state.pg).some(Boolean)"),'sempre sobra pelo menos 1 página')
    # texto bem longo não estoura a página do resumo
    pg.click('#relBox [data-rp="p:semana_ant"]'); pg.check('[data-rpg="resumo"]'); pg.wait_for_timeout(200)
    over=pg.evaluate("""()=>{PP.relatorio.state.txt='x '.repeat(350).trim(); PP.relatorio.state.obs='y '.repeat(225).trim(); const r=PP.relatorio.rangeOf('semana_ant'); const R=PP.relatorio.detail(r.a,r.b,'semana_ant',5.4321); const h=document.createElement('div'); h.style.cssText='position:absolute;left:0;top:0;width:794px'; h.innerHTML=PP.relatorio.pages(R).filter(x=>x.includes('Resumo do período')).join(''); document.body.appendChild(h); const pg=h.querySelector('.rpg'), f=pg.querySelector('.rpfoot').getBoundingClientRect().top; let mx=0; [...pg.children].forEach(c=>{if(!c.classList.contains('rpfoot')) mx=Math.max(mx,c.getBoundingClientRect().bottom)}); h.remove(); return Math.round(mx-f)}""")
    ok(over<=0,'texto e observação no tamanho máximo cabem na página (folga %dpx)'%(-over))
    ok(len(errs)==0,'sem erros de JS %s'%errs)
    # celular
    m=br.new_context(viewport={'width':390,'height':844}, service_workers='block'); mp=m.new_page(); mp.on('pageerror', lambda e: errs.append(str(e)))
    m.route('**/olinda.bcb.gov.br/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin':'*'}, body=json.dumps({'value':[{'cotacaoCompra':RATE_DIA}]})))
    mp.add_init_script(FIX); mp.goto('http://localhost:8765/index.html'); mp.wait_for_timeout(400); mp.evaluate(SEED); mp.evaluate("sessionStorage.setItem('pp.asShown','1')"); mp.reload(); mp.wait_for_timeout(600)
    mp.evaluate("(d)=>{PP.S.hist.length=0;d.N.forEach(e=>PP.S.hist.push(e));const h=PP.exp.hist();h.length=0;d.X.forEach(e=>h.push(e));}", {'N':N,'X':X})
    mp.evaluate("PP.go('painel')"); mp.wait_for_timeout(600); mp.click('#relBox [data-rp="p:semana_ant"]'); mp.click('#relBox .rpcust > summary'); mp.wait_for_timeout(300)
    ok(mp.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"),'celular: Personalizar sem rolagem horizontal')
    mp.locator('#relBox .rpcust').screenshot(path=SP+'/rel/cust_cel.png')
    pg.reload(); pg.wait_for_timeout(700); pg.click('[data-view="painel"]'); pg.wait_for_timeout(500)
    pg.evaluate("(()=>{const s=PP.relatorio.state; s.cust=true})()")
    br.close()
print('\nFALHAS:',fails if fails else 'nenhuma'); print('TUDO OK' if not fails else 'COM FALHAS')
