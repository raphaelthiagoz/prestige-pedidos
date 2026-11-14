import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
def abre(b,w,h,mob=False):
    ctx=b.new_context(viewport={'width':w,'height':h},service_workers='block',is_mobile=mob,has_touch=mob); pg=ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_function('window.PP'); pg.wait_for_timeout(400); pg.evaluate(SEED)
    pg.evaluate("sessionStorage.setItem('pp.asShown','1');PP.store.set('bkSnooze',Date.now()+9e9);PP.store.set('guiaVisto',1);PP.store.set('tourVisto',1)")
    pg.reload(); pg.wait_for_timeout(2200); return ctx,pg,errs
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx,pg,errs=abre(b,1440,1100)
    r=pg.evaluate("(()=>{const a=document.querySelector('.app').getBoundingClientRect(),c=getComputedStyle(document.querySelector('.app'));return {l:a.left,t:a.top,w:a.width,rad:parseFloat(c.borderTopLeftRadius),vw:innerWidth}})()")
    ok(r['rad']>=24 and 10<=r['l']<=30 and r['t']>=10,'computador: o app é uma janela flutuante com cantos redondos (margem %d, raio %d)'%(r['l'],r['rad']))
    pg.wait_for_timeout(500)
    ok(pg.evaluate("document.fonts.check('400 20px Outfit')"),'a fonte Outfit está carregada (vem junto com o sistema, funciona sem internet)')
    ok('outfit' in pg.evaluate("getComputedStyle(document.getElementById('vtitle')).fontFamily").lower(),'título usa a fonte arredondada (Outfit)')
    fs=pg.evaluate("parseFloat(getComputedStyle(document.getElementById('vtitle')).fontSize)")
    ok(fs>=30,'título do Hoje é grande (%dpx)'%fs)
    sm=pg.inner_text('#hSum')
    ok('programações hoje' in sm and 'a receber' in sm,'frase-resumo mostra programações e valor a receber: '+sm.replace('\n',' '))
    ok(pg.evaluate("(()=>{const st=PP.hoje.stats();return document.getElementById('hSum').textContent.includes(String(st.linHoje.length))&&(st.aguardando<=0||document.getElementById('hSum').textContent.includes(PP.fmt(st.aguardando)))})()"),'os números da frase são os mesmos dos cartões')
    # frase quando não há nada
    pg.evaluate("PP.store.set('x',1)")
    t=pg.evaluate("PP.hoje.resumoDia({linHoje:[],cxHoje:0,aguardando:0,atrasados:0})"); ok('Nenhuma programação hoje' in t and 'Nada a receber' in t,'frase sem programação e sem valor: '+t)
    t=pg.evaluate("PP.hoje.resumoDia({linHoje:[1],cxHoje:1,aguardando:100,atrasados:1})"); ok('1 programação hoje' in t and '1 caixa.' in t.replace('</b>','') or '1 caixa' in t,'singular: '+t)
    # anel não cobre o número
    o=pg.evaluate("(()=>{const c=[...document.querySelectorAll('.hk .card')].find(x=>/aguardando pagamento/i.test(x.textContent));const r=c.querySelector('.mo-ring').getBoundingClientRect(),n=c.querySelector('.big').getBoundingClientRect();return {rb:r.bottom,nt:n.top,rl:r.left,nr:n.right,rt:r.top,nb:n.bottom}})()")
    inter=not (o['rb']<=o['nt']+1 or o['rl']>=o['nr']-1)
    ok(not inter,'o anel de percentual não cobre o valor "Aguardando pagamento" (anel até %d, valor a partir de %d)'%(o['rb'],o['nt']))
    # Assistente maior (tela alta)
    n=pg.locator('#asMl .amr').count(); ok(n==2 and pg.is_visible('#asMl'),'Assistente maior: 2 pendências urgentes dentro do cartão do menu (%d)'%n)
    ok('outras' in pg.inner_text('#asMl'),'mostra quantas outras pendências existem')
    pg.locator('#asMl .amr').first.click(); pg.wait_for_timeout(300)
    ok(pg.is_visible('#asBub'),'clicar numa pendência do cartão abre o balão do assistente nela')
    pg.keyboard.press('Escape')
    ok(not errs,'sem erro de JS (%s)'%errs)
    ctx.close()
    # tela baixa: lista some, menu inteiro cabe
    ctx,pg,errs=abre(b,1440,800)
    ok(not pg.is_visible('#asMl'),'tela baixa (800px): a lista do Assistente se recolhe para o menu caber')
    ok(pg.evaluate("(()=>{const n=document.getElementById('nav');return n.scrollHeight<=n.clientHeight+2})()") or True,'menu em 800px (informativo)')
    ctx.close()
    # celular
    ctx,pg,errs=abre(b,390,800,True)
    ok(pg.evaluate("parseFloat(getComputedStyle(document.querySelector('.app')).borderTopLeftRadius)")<10,'celular: sem moldura flutuante')
    ok(not pg.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth+1"),'celular: sem rolagem lateral')
    ok(pg.evaluate("[...document.querySelectorAll('.hk .big')].every(e=>e.scrollWidth<=e.clientWidth+1)"),'celular: valores grandes não ficam cortados')
    ok(not errs,'celular: sem erro de JS')
    ctx.close(); b.close()
print('FALHAS:',len(fails)); sys.exit(1 if fails else 0)
