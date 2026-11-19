# v29.20: Histórico - trocar a espécie de uma linha (notinha com mortalidade sai certa)
import sys, os, zipfile, re; sys.path.insert(0,'test'); sys.argv=sys.argv[:1]
exec(open('test/e2e76.py').read().split("with sync_playwright() as p:")[0])
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e81/'; os.makedirs(OUT,exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx,pg,errs=abre(b,1440,1100)
    pg.evaluate("PP.store.set('catalog',[{id:'c1',sci:'Paracheirodon axelrodi',comum:'Cardinal',preco:0.5,caixa:500},{id:'c2',sci:'Paracheirodon simulans',comum:'Neon verde',preco:0.7,caixa:500},{id:'c3',sci:'Corydoras sodalis',comum:'Coridora',preco:2.5,caixa:100}])"); pg.reload(); pg.wait_for_timeout(1500)
    cat=pg.evaluate("PP.S.catalog.filter(x=>x.preco>0).slice(0,6).map(x=>({sci:x.sci,comum:x.comum,preco:x.preco,caixa:x.caixa}))")
    A,B,C=cat[0],cat[1],cat[2]; print('  catálogo:',A['sci'],'/',B['sci'],'/',C['sci'])
    pg.evaluate("""([A,C])=>{const Core=PP.Core,e=PP.S.hist.find(x=>x.id==='hv'),nm=x=>Core.docName(x,PP.S.cfg);
      e.lines=[{key:Core.itemKey(A),sci:A.sci,comum:A.comum,nome:nm(A),preco:A.preco,peixes:1000,boxes:2,qtyBox:500},{key:Core.itemKey(C),sci:C.sci,comum:C.comum,nome:nm(C),preco:C.preco,peixes:200,boxes:2,qtyBox:100}];
      e.nota={rows:[{nome:nm(A).toUpperCase(),cxs:2,qtd:500,unit:A.preco},{nome:nm(C).toUpperCase(),cxs:2,qtd:100,unit:C.preco}],ex:Object.assign({},(e.nota||{}).ex||{}),dia:'SEGUNDA-FEIRA'};
      e.rows=[{sci:A.sci,comum:A.comum,caixa:A.caixa,boxes:2},{sci:C.sci,comum:C.comum,caixa:C.caixa,boxes:2}]; e.uso={[Core.itemKey(A)]:2,[Core.itemKey(C)]:2};
      const v=PP.Features.r2(1000*A.preco+200*C.preco); e.totais=Object.assign(e.totais||{},{valor:v,fish:v,total:v,gta:0,atestado:0,emb:0}); e.mort={dead:{0:40},credito:PP.Features.r2(40*A.preco),mortos:40,destino:'abater'}; e.pay={status:'aguardando',pago:0};
      PP.store.set('hist',PP.S.hist);}""",[A,C])
    pg.reload(); pg.wait_for_timeout(1500); abrir(pg)
    E="PP.S.hist.find(x=>x.id==='hv')"
    tot0=pg.evaluate(E+".totais.total")
    ok(pg.locator('[data-h="troca"]').count()==2,'cada linha da mortalidade tem "Trocar espécie"')
    pg.locator('[data-h="troca"][data-i="0"]').click(); pg.wait_for_timeout(300)
    ok(pg.is_visible('#trocaIn') and pg.is_disabled('[data-h="trocaok"]'),'abre a escolha da espécie (botão Trocar só libera com uma espécie da lista)')
    lab=f"{B['sci']} — {B['comum']}"+(f" ({B['caixa']}/cx)" if B.get('caixa') else '')
    pg.fill('#trocaIn',lab); pg.wait_for_timeout(300)
    ok(not pg.is_disabled('[data-h="trocaok"]') and 'Preço passa de' in pg.inner_text('#trocaPrev'),'mostra o preço antigo e o novo antes de trocar: '+pg.inner_text('#trocaPrev')[:90])
    pg.click('[data-h="trocaok"]'); pg.wait_for_timeout(600)
    l0=pg.evaluate(E+".lines[0]"); pr=pg.evaluate("(b)=>{const e=PP.S.hist.find(x=>x.id==='hv');const c=(PP.S.clientes||[]).find(c=>PP.up(c.nome)===PP.up(e.cliente.nome));return PP.Features.priceFor(c||null,PP.S.catalog.find(x=>x.sci===b))}",B['sci'])
    ok(l0['sci']==B['sci'] and abs(l0['preco']-pr)<1e-9,'a linha passa para %s com o preço dela (%s)'%(B['sci'],pr))
    ok(pg.evaluate(E+".mort.dead[0]")==40 and abs(pg.evaluate(E+".mort.credito")-round(40*pr,2))<0.01,'a mortalidade (40 peixes) fica na mesma linha, com crédito pelo preço novo')
    ok(abs(pg.evaluate(E+".totais.total")-round(tot0+(pr-A['preco'])*1000,2))<0.01,'total do pedido ajustado pela diferença de preço')
    ok(pg.evaluate("(k)=>"+E+".uso[k]",pg.evaluate("(x)=>PP.Core.itemKey(PP.S.catalog.find(c=>c.sci===x))",B['sci']))==2,'estoque: as caixas passam para a espécie nova')
    ok('trocado (era' in pg.inner_text('#mortBox') and pg.is_visible('[data-h="trocaundo"]'),'a linha mostra o nome antigo e aparece "Desfazer a troca"')
    # notinha corrigida
    with pg.expect_download() as d: pg.click('[data-h="mortNota"]')
    f=OUT+'notinha.xlsx'; d.value.save_as(f)
    import openpyxl; vals=[str(c.value) for r in openpyxl.load_workbook(f).active.iter_rows() for c in r if c.value is not None]; tx=' | '.join(vals)
    nmB=pg.evaluate("(x)=>PP.Core.docName(PP.S.catalog.find(c=>c.sci===x),PP.S.cfg).toUpperCase()",B['sci']); nmA=pg.evaluate("(x)=>PP.Core.docName(PP.S.catalog.find(c=>c.sci===x),PP.S.cfg).toUpperCase()",A['sci'])
    ok(nmB in tx and (nmA not in tx or nmA in nmB),'notinha baixada já sai com %s no lugar de %s'%(nmB,nmA))
    ok('MORTALIDADE' in tx.upper(),'notinha continua com o crédito de mortalidade')
    pg.click('[data-h="trocaundo"]'); pg.wait_for_timeout(500)
    ok(pg.evaluate(E+".lines[0].sci")==A['sci'] and abs(pg.evaluate(E+".totais.total")-tot0)<0.01,'"Desfazer a troca" devolve o pedido como estava')
    pg.screenshot(path=OUT+'troca.png')
    ok(not errs,'sem erros de JavaScript: %s'%errs[:2])
    b.close()
print('\nFALHAS:',len(fails)); sys.exit(1 if fails else 0)
