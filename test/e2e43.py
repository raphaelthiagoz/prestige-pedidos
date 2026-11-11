import sys, os, re, json; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e43/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
errs=[]
CNPJWS={"razao_social":"BANCO DO BRASIL SA","estabelecimento":{"cnpj":"00000000000191","nome_fantasia":"DIRECAO GERAL","tipo_logradouro":"SETOR","logradouro":"DE AUTARQUIAS NORTE","numero":"QUADRA 5","complemento":"LOTE B","bairro":"ASA NORTE","cep":"70040912","cidade":{"nome":"Brasília"},"estado":{"sigla":"DF"},"ddd1":"61","telefone1":"34939002","email":"contato@bb.com.br","situacao_cadastral":"Ativa","inscricoes_estaduais":[{"inscricao_estadual":"0733456600110","ativo":True,"estado":{"sigla":"DF"}}]}}
BRASIL={"razao_social":"BANCO DO BRASIL SA","nome_fantasia":"DIRECAO GERAL","descricao_situacao_cadastral":"ATIVA","logradouro":"SBS QUADRA 1","numero":"S/N","bairro":"ASA SUL","municipio":"BRASILIA","uf":"DF","cep":"70073901","ddd_telefone_1":"6134939002","email":"X@BB.COM.BR"}
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':900},service_workers='block'); pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    mode={'m':'ws'}
    def h_ws(route):
        if mode['m']=='ws': route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(CNPJWS))
        elif mode['m'] in ('brasil','nf'): route.fulfill(status=429 if mode['m']=='brasil' else 404,headers={'access-control-allow-origin':'*'},body='{}')
        else: route.abort()
    def h_br(route):
        if mode['m']=='brasil': route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(BRASIL))
        elif mode['m']=='nf': route.fulfill(status=404,headers={'access-control-allow-origin':'*'},body='{}')
        else: route.abort()
    pg.route('**/publica.cnpj.ws/**',h_ws); pg.route('**/brasilapi.com.br/**',h_br)
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(500)
    pg.evaluate("""()=>{const n=['AQUAPRIME','ASR PEIXES','CEZAR','MAEDA','RAQUEL','UBER PEIXES'];for(let i=0;i<42;i++)PP.S.clientes.push({nome:n[i%6]+' '+(i+1),end:'',aero:'GRU',cidade:'São Paulo - SP',desc:0,precos:''});PP.saveClientes();}""")
    pg.click('#nav button[data-view="clientes"]'); pg.wait_for_timeout(500)
    h=pg.evaluate("document.querySelector('.clitems .cli').getBoundingClientRect().height"); print('  altura de cada cliente na lista:',h)
    ok(h<42,'linha da lista compacta (<42px, antes ~65px)')
    ok(pg.evaluate("[...document.querySelectorAll('.clitems .cn')].map(e=>e.textContent).slice(0,3).join('|')").startswith('ANDRADE'),'lista em ordem alfabética (A–Z) por padrão')
    pg.screenshot(path=OUT+'lista.png')
    pg.fill('#clQ','maeda'); pg.wait_for_timeout(300); ok(pg.locator('.clitems .cli').count()==7,'busca por "maeda" filtra a lista (7 clientes)')
    pg.fill('#clQ',''); pg.wait_for_timeout(200)
    # v26.1: tira de letras + só a lista rola
    hl=pg.evaluate("document.querySelector('.cllist').getBoundingClientRect().height"); ok(hl<=900,'caixa da lista cabe na tela (%spx) e rola por dentro'%round(hl))
    ok(pg.evaluate("(()=>{const e=document.querySelector('.clitems');return e.scrollHeight>e.clientHeight})()"),'lista de 45 clientes rola dentro da caixa (sem esticar a página)')
    ok(pg.locator('.clletras button').count()>=4,'tira de letras A–Z presente')
    pg.click('.clletras button[data-cll="M"]'); pg.wait_for_timeout(250)
    ok(pg.locator('.clitems .cli').count()==7 and 'na letra M' in pg.inner_text('.clcount'),'letra M mostra só os 7 MAEDA')
    ok(pg.evaluate("(()=>{const e=document.querySelector('.clitems');return e.scrollHeight<=e.clientHeight+2})()"),'com a letra escolhida não precisa rolar')
    pg.click('.clletras button[data-cll=""]'); pg.wait_for_timeout(200)
    pg.click('.clitems .cli >> nth=0'); pg.wait_for_timeout(300)
    ok(pg.locator('.cltabs button').count()==4,'ficha em 4 abas: Resumo, Pedidos, Dados · CNPJ/IE, Preços')
    ok(pg.locator('.clkp').count()==1 and pg.locator('#cf_doc').count()==0,'aba Resumo mostra os números; os dados ficam em outra aba')
    pg.click('.cltabs button:has-text("Pedidos")'); pg.wait_for_timeout(200); ok('pedidos anteriores' in pg.inner_text('.clficha').lower(),'aba Pedidos mostra os pedidos')
    pg.click('.cltabs button:has-text("Dados")'); pg.wait_for_timeout(200)
    ok(pg.locator('#cf_doc').count()==1 and pg.locator('#cf_ie').count()==1,'aba Dados tem CNPJ e Inscrição estadual')
    # digitar CNPJ inválido
    pg.fill('#cf_doc','12345678000100'); pg.press('#cf_doc','Tab'); pg.wait_for_timeout(200)
    ok('não passa' in pg.inner_text('#cnpjNote'),'CNPJ inválido é avisado')
    # busca ok (cnpj.ws com IE)
    pg.fill('#cf_cidade','São Paulo - SP'); pg.fill('#cf_end','RUA TESTE 10'); pg.fill('#cf_doc','00000000000191'); pg.click('[data-cla=cnpj]'); pg.wait_for_timeout(700)
    v=lambda k: pg.input_value('#cf_'+k)
    print('  ',v('doc'),'|',v('ie'),'|',v('razao'),'|',v('end'),'|',v('cep'),'|',v('cidade'),'|',v('tel'),'|',v('email'))
    ok(v('doc')=='00.000.000/0001-91' and v('ie')=='0733456600110','CNPJ formatado e IE preenchida automaticamente')
    ok(v('razao')=='BANCO DO BRASIL SA' and v('cep')=='70040-912' and v('cidade')=='São Paulo - SP' and 'Endereço na Receita' in pg.inner_text('.cnpjbox'),'razão social e CEP preenchidos; cidade já cadastrada foi mantida e o endereço da Receita é oferecido')
    pg.click('[data-cla=usaend]'); pg.wait_for_timeout(200); ok('ASA NORTE' in v('end') and v('cidade')=='Brasília - DF','"Usar este endereço" aplica endereço e cidade da Receita')
    ok('✓' in pg.inner_text('.cnpjbox') and 'Ativa' in pg.inner_text('.cnpjbox'),'mostra situação na Receita e confirmação')
    pg.screenshot(path=OUT+'dados.png')
    ok(pg.evaluate("PP.S.clientes.find(c=>c.doc==='00.000.000/0001-91').ie")=='0733456600110','salvo no cadastro do cliente')
    # fallback BrasilAPI (sem IE)
    mode['m']='brasil'; pg.fill('#cf_ie',''); pg.press('#cf_ie','Tab'); pg.click('[data-cla=cnpj]'); pg.wait_for_timeout(700)
    ok('não trouxe a inscrição estadual' in pg.inner_text('.cnpjbox') and pg.input_value('#cf_ie')=='','sem IE na base: avisa para digitar à mão (não inventa)')
    mode['m']='nf'; pg.click('[data-cla=cnpj]'); pg.wait_for_timeout(700); ok('Não consegui consultar' in pg.inner_text('.cnpjbox') or 'não encontrado' in pg.inner_text('.cnpjbox'),'erro de consulta tem mensagem clara')
    mode['m']='off'; pg.click('[data-cla=cnpj]'); pg.wait_for_timeout(700); ok('Não consegui consultar' in pg.inner_text('.cnpjbox'),'sem internet: mensagem clara, dados mantidos')
    ok(pg.input_value('#cf_razao')=='BANCO DO BRASIL SA','dados já preenchidos continuam')
    pg.click('.cltabs button:has-text("Preços")'); pg.wait_for_timeout(200); ok(pg.locator('#cf_precos').count()==1,'aba Preços tem preços especiais e observações')
    ok(not errs,'sem erros %s'%errs)
print('FALHAS',fails)
