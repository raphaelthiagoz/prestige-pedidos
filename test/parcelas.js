const F = require('../features.js'); let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) bad++; };
const mk = (total, extra) => Object.assign({ id: 'x', dataISO: '2026-11-01', totais: { total }, pay: { status: 'aguardando', pago: 0 } }, extra || {});
ok(JSON.stringify(F.parcDias('30/40/50/60')) === '[30,40,50,60]', 'lê 30/40/50/60');
ok(JSON.stringify(F.parcDias('25, 40')) === '[25,40]' && JSON.stringify(F.parcDias('60-30 30')) === '[30,60]', 'aceita vírgula, traço, espaço; ordena e tira repetido');
ok(F.parcDias('abc').length === 0 && F.parcDias('0/400').length === 0, 'ignora lixo e valores fora de 1 a 365');
const e = mk(1000); e.pay.parc = F.gerarParcelas(e, [30, 40, 50, 60]);
ok(e.pay.parc.length === 4 && e.pay.parc.map(p => p.valor).join() === '250,250,250,250', '1000 em 4 = 250 cada');
ok(e.pay.parc[0].venc === '2026-12-01' && e.pay.parc[3].venc === '2026-12-31', 'vencimentos: pedido + 30 e + 60 dias');
const e2 = mk(100); const p2 = F.gerarParcelas(e2, [30, 40, 50]);
ok(p2.map(p => p.valor).join() === '33.33,33.33,33.34' && F.r2(p2.reduce((s, p) => s + p.valor, 0)) === 100, 'divisão com centavos fecha em 100,00 (a última ajusta)');
// situação
const hoje = '2026-12-05';
let s = F.situacao(e, hoje, 7); ok(s.key === 'atrasado' && s.venc === '2026-12-01' && /4 dias/.test(s.label), 'primeira parcela venceu há 4 dias => atrasado: ' + s.label);
s = F.situacao(e, '2026-11-20', 7); ok(s.key === 'aguardando' && s.venc === '2026-12-01', 'antes do vencimento fica aguardando (mesmo passando de 7 dias do pedido)');
e.pay.parc[0].pago = '2026-12-02'; F.syncParc(e);
ok(e.pay.pago === 250 && e.pay.status === 'aguardando' && F.saldo(e) === 750, 'pagar a 1ª parcela => recebido 250, saldo 750');
s = F.situacao(e, hoje, 7); ok(s.key === 'aguardando' && s.venc === '2026-12-11', 'sem atraso: próxima parcela vence 11/12 (pedido + 40)');
s = F.situacao(e, '2026-12-12', 7); ok(s.key === 'atrasado' && s.venc === '2026-12-11', 'passou da 2ª parcela => atrasado');
e.pay.parc.forEach(p => { p.pago = '2026-12-12'; }); F.syncParc(e);
ok(e.pay.status === 'pago' && F.saldo(e) === 0 && F.situacao(e, '2027-03-01', 7).key === 'pago', 'todas pagas => Pago');
e.pay.parc[3].pago = ''; F.syncParc(e); ok(e.pay.status === 'aguardando' && F.saldo(e) === 250, 'desmarcar uma parcela volta para aguardando');
// sem parcelas: comportamento antigo
const o = mk(500); ok(F.situacao(o, '2026-11-20', 7).key === 'atrasado' && F.situacao(o, '2026-11-05', 7).key === 'aguardando', 'pedido sem parcelas continua com o prazo de dias da configuração');
// abater mortalidade: soma deixa de bater
const m = mk(1000); m.pay.parc = F.gerarParcelas(m, [30, 60]); m.mort = { destino: 'abater', credito: 100 };
ok(F.somaParc(m) === 1000 && F.devido(m) === 900, 'com mortalidade abatida a soma das parcelas (1000) difere do total (900): a tela avisa e redistribui');
ok(F.gerarParcelas(m, [30, 60]).map(p => p.valor).join() === '450,450', 'redistribuir usa o total já abatido');
const r = mk(1000); r.pay.parc = F.gerarParcelas(r, [30, 60]); r.pay.parc[0].pago = '2026-12-02'; r.mort = { destino: 'abater', credito: 100 }; F.redistribuir(r); F.syncParc(r);
ok(r.pay.parc.map(p => p.valor).join() === '500,400' && F.saldo(r) === 400, 'redistribuir mantém a parcela paga e ajusta só a aberta (500 paga + 400 aberta = 900)');
const rc = mk(900, { pay: { status: 'aguardando', pago: 450, dataPago: '2026-11-20' } }); rc.pay.parc = F.gerarParcelas(rc, [30, 60]); F.aplicarRecebido(rc); F.syncParc(rc);
ok(rc.pay.parc[0].pago === '2026-11-20' && !rc.pay.parc[1].pago && F.saldo(rc) === 450, 'pedido que já tinha 450 recebidos: a 1ª parcela entra como paga');
const em = mk(100); em.pay.status = 'embarcado'; em.pay.parc = F.gerarParcelas(em, [30]); em.pay.parc[0].pago = '2026-12-01'; F.syncParc(em);
ok(em.pay.status === 'embarcado', 'situação "embarcado" não é trocada ao pagar tudo');
console.log(bad ? '\nFALHAS: ' + bad : '\nFALHAS: nenhuma'); process.exit(bad ? 1 : 0);
