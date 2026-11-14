import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
def abre(b,w,h,mob=False):
    ctx=b.new_context(viewport={'width':w,'height':h},accept_downloads=True,service_workers='block',is_mobile=mob,has_touch=mob,permissions=['clipboard-read','clipboard-write']); pg=ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('dialog',lambda d: d.accept())
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_function('window.PP'); pg.wait_for_timeout(400); pg.evaluate(SEED)
    pg.evaluate("sessionStorage.setItem('pp.asShown','1');PP.store.set('bkSnooze',Date.now()+9e9);PP.store.set('guiaVisto',1);PP.store.set('tourVisto',1)")
    pg.evaluate("PP.S.hist.forEach(h=>{h.rows=h.rows||[];h.nota=h.nota||{rows:[],dia:'SEGUNDA-FEIRA'};h.dia=h.dia||'segunda-feira'});PP.store.set('hist',PP.S.hist)")
    pg.reload(); pg.wait_for_timeout(2000); return ctx,pg,errs
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx,pg,errs=abre(b,1440,1000)
    pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(500); pg.click('[data-htipo=nac]'); pg.wait_for_timeout(300)
    rows=pg.locator('#histTb tbody tr'); n=rows.count()
    ok(n>=8,'Histórico lista os pedidos (%d)'%n)
    ok(pg.locator('#histTb tbody tr .hacts button').count()==2*n,'cada linha tem só 2 botões: ação principal + Mais')
    ok(pg.locator('#histTb [data-h=edit]').count()==0 and pg.locator('#histTb [data-h=repeat]').count()==0,'Editar e Repetir saíram da linha (ficam no Mais)')
    # situação x botão principal
    info=pg.evaluate("""(()=>{const F=PP.Features,h=F.todayISO(),pz=PP.S.cfg.prazoPag||7;return [...document.querySelectorAll('#histTb tbody tr')].map(tr=>{const id=tr.querySelector('[data-h=more]').dataset.id,e=PP.S.hist.find(x=>x.id===id),s=F.situacao(e,h,pz);return [s.key,s.saldo>0,tr.querySelector('.hacts button').dataset.h]})})()""")
    atr=[x for x in info if x[0]=='atrasado' and x[1]]; ag=[x for x in info if x[0]!='atrasado' and x[1]]; pago=[x for x in info if not x[1]]
    ok(atr and all(x[2]=='cobrar' for x in atr),'atrasado: botão principal é "Cobrar" (%d linhas)'%len(atr))
    ok(ag and all(x[2]=='baixa' for x in ag),'aguardando: botão principal é "Dar baixa" (%d linhas)'%len(ag))
    ok(pago and all(x[2]=='open' for x in pago),'pago: botão principal é "Ver" (%d linhas)'%len(pago))
    # menu Mais
    ok(pg.locator('#hMenu').count()==0,'menu fechado no começo')
    pg.locator('#histTb [data-h=more]').first.click(); pg.wait_for_timeout(200)
    itens=pg.locator('#hMenu [role=menuitem]').all_inner_texts()
    ok(pg.is_visible('#hMenu') and 'Ver detalhes' in itens and 'Editar pedido' in itens and 'Duplicar pedido' in itens and 'Registrar mortalidade' in itens and 'Baixar notinha (Excel)' in itens,'menu Mais tem Ver, Editar, Duplicar, Mortalidade e Notinha: %s'%itens)
    ok(itens[-1]=='Excluir este pedido' and pg.locator('#hMenu hr').count()==1,'"Excluir este pedido" fica separado, por último')
    ok(pg.evaluate("getComputedStyle(document.querySelector('#hMenu .danger')).color")!=pg.evaluate("getComputedStyle(document.querySelector('#hMenu [data-h=open]')).color"),'o botão de excluir tem cor de perigo')
    ok(pg.locator('#hMenu [data-h=more]').count()==0 and pg.evaluate("document.querySelector('[data-h=more]').getAttribute('aria-expanded')")=='true','botão Mais marca aria-expanded')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100); ok(pg.locator('#hMenu').count()==0,'Esc fecha o menu')
    pg.locator('#histTb [data-h=more]').first.click(); pg.wait_for_timeout(150); pg.mouse.click(5,300); pg.wait_for_timeout(150)
    ok(pg.locator('#hMenu').count()==0,'clicar fora fecha o menu')
    pg.locator('#histTb [data-h=more]').first.click(); pg.wait_for_timeout(150); pg.locator('#histTb [data-h=more]').first.click(); pg.wait_for_timeout(150)
    ok(pg.locator('#hMenu').count()==0,'clicar de novo no Mais fecha')
    # duplicar a partir do menu
    pg.locator('#histTb [data-h=more]').first.click(); pg.click('#hMenu [data-h=repeat]'); pg.wait_for_timeout(700)
    ok(pg.evaluate("document.body.dataset.view")=='pedido','"Duplicar pedido" abre o pedido para repetir')
    pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(500)
    # Cobrar copia mensagem
    pg.evaluate("navigator.clipboard.writeText('')")
    pg.locator('#histTb [data-h=cobrar]').first.click(); pg.wait_for_timeout(500)
    clip=pg.evaluate("navigator.clipboard.readText()")
    ok(len(clip)>40 and ('R$' in clip),'"Cobrar" copia a mensagem de cobrança (%d letras)'%len(clip))
    ok('copiada' in pg.inner_text('#toasts').lower(),'avisa que a mensagem foi copiada')
    # Dar baixa
    r0=pg.evaluate("PP.S.hist.filter(h=>h.pay.status==='pago').length")
    pg.locator('#histTb [data-h=baixa]').first.click(); pg.wait_for_timeout(500)
    ok(pg.evaluate("PP.S.hist.filter(h=>h.pay.status==='pago').length")==r0+1,'"Dar baixa" marca um pedido como pago (com confirmação)')
    ok(pg.evaluate("PP.S.hist.filter(h=>h.pay.status==='pago'&&h.pay.dataPago===PP.Features.todayISO()).length")>=1,'registra a data de hoje')
    # recusar confirmação não altera
    pg.remove_listener('dialog',pg.listeners('dialog')[0]) if hasattr(pg,'listeners') else None
    # excluir pelo menu (com confirmação) e desfazer
    h0=pg.evaluate("PP.S.hist.length")
    pg.locator('#histTb [data-h=more]').first.click(); pg.click('#hMenu [data-h=del]'); pg.wait_for_timeout(500)
    ok(pg.evaluate("PP.S.hist.length")==h0-1,'"Excluir este pedido" tira o pedido do histórico (depois da confirmação)')
    ok(pg.is_visible('#hLixo'),'o pedido vai para "Pedidos apagados" (dá para desfazer)')
    pg.click('#hLixo summary'); pg.wait_for_timeout(200)
    btn=pg.locator('#hLixo [data-lixo]').first; ok(btn.count()==1,'há botão para restaurar')
    btn.click(); pg.wait_for_timeout(500)
    ok(pg.evaluate("PP.S.hist.length")==h0,'restaurar devolve o pedido ao histórico')
    # notinha
    with pg.expect_download(timeout=8000) as dl:
        pg.locator('#histTb [data-h=more]').first.click(); pg.click('#hMenu [data-h=notinha]')
    ok(dl.value.suggested_filename.startswith('NOTINHA_') and dl.value.suggested_filename.endswith('.xlsx'),'"Baixar notinha" baixa o Excel: '+dl.value.suggested_filename)
    # períodos agrupados e abas sublinhadas
    pg.evaluate("PP.go('painel')"); pg.wait_for_timeout(500)
    ok(pg.locator('#vPainel .seg [data-pr]').count()==4,'Painel: períodos num grupo de botões (segmentado)')
    ok(pg.evaluate("parseFloat(getComputedStyle(document.querySelector('#vPainel .seg')).borderTopLeftRadius)")>=10 and pg.evaluate("getComputedStyle(document.querySelector('#vPainel .seg [data-pr]')).borderTopWidth")=='0px','o grupo é uma pílula só, botões sem borda própria')
    pg.evaluate("PP.go('exp')"); pg.wait_for_timeout(600)
    tb=pg.locator('#vExp .tabs button').first
    if tb.count():
        ok(pg.evaluate("(()=>{const b=document.querySelector('#vExp .tabs [aria-selected=true]');const c=getComputedStyle(b);return c.borderBottomWidth==='2px'&&c.borderTopWidth==='0px'&&c.backgroundColor==='rgba(0, 0, 0, 0)'})()"),'abas: a aba ativa tem só o sublinhado (sem caixa)')
    ok(not errs,'sem erros JS '+str(errs[:2]))
    ctx.close()
    ctx,pg,errs=abre(b,390,844,True)
    pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(600)
    ok(pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),'celular: Histórico sem rolagem horizontal da página')
    pg.locator('#histTb [data-h=more]').first.click(); pg.wait_for_timeout(250)
    ok(pg.evaluate("(()=>{const r=document.getElementById('hMenu').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()"),'celular: o menu Mais cabe na tela')
    pg.evaluate("PP.go('painel')"); pg.wait_for_timeout(500)
    ok(pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),'celular: Painel sem rolagem horizontal')
    ok(not errs,'celular sem erros JS '+str(errs[:2]))
    ctx.close(); b.close()
print('\nFALHAS:',len(fails)); sys.exit(1 if fails else 0)
