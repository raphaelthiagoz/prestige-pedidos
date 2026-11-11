import datetime
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
