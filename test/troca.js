const Core = require('../core.js'); global.window = global.window || {}; window.Core = Core; const F = require('../features.js');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) bad++; };
const it = (sci, comum, preco, caixa) => ({ id: sci, sci, comum, preco, caixa });
const A = it('Paracheirodon axelrodi', 'Cardinal', 0.5, 500), B = it('Paracheirodon simulans', 'Neon verde', 0.7, 500), C = it('Corydoras sodalis', 'Coridora', 2.5, 100);
const nome = x => Core.docName(x, Core.DEFAULT_CFG);
const e = { id: 'p1', cliente: { nome: 'TESTE' }, dataISO: '2026-11-10',
  lines: [{ key: Core.itemKey(A), sci: A.sci, comum: A.comum, nome: nome(A), preco: 0.5, peixes: 1000, boxes: 2, qtyBox: 500 }, { key: Core.itemKey(C), sci: C.sci, comum: C.comum, nome: nome(C), preco: 2.5, peixes: 200, boxes: 2, qtyBox: 100 }],
  nota: { rows: [{ nome: nome(A).toUpperCase(), cxs: 2, qtd: 500, unit: 0.5 }, { nome: nome(C).toUpperCase(), cxs: 2, qtd: 100, unit: 2.5 }], ex: { temAt: false, gta: 0, embalagem: 0 }, dia: 'SEGUNDA-FEIRA' },
  rows: [{ sci: A.sci, comum: A.comum, caixa: 500, boxes: 2 }, { sci: C.sci, comum: C.comum, caixa: 100, boxes: 2 }], uso: { [Core.itemKey(A)]: 2, [Core.itemKey(C)]: 2 },
  boxes: [{ no: 1, items: [{ sci: A.sci, q: 500 }] }, { no: 2, items: [{ sci: A.sci, q: 500 }] }], totais: { caixas: 4, peixes: 1200, valor: 1000, fish: 1000, gta: 0, atestado: 0, emb: 0, total: 1000 },
  mort: { destino: 'abater', dead: { 0: 50 } }, pay: { status: 'aguardando', pago: 0 } };
const t0 = Core.notinhaTotals(e.nota.rows, Object.assign({}, e.nota.ex, { gtaAuto: false }), Core.DEFAULT_CFG.valores);
console.log('  (total da notinha antes:', t0.total, ')');
const antes = F.trocarEspecie(e, 0, B, 0.7, Core.DEFAULT_CFG);
ok(e.lines[0].sci === B.sci && e.lines[0].preco === 0.7, 'linha 1 vira Paracheirodon simulans com o preço novo (0,70)');
ok(e.nota.rows[0].nome === nome(B).toUpperCase() && e.nota.rows[0].unit === 0.7 && e.nota.rows[0].cxs === 2 && e.nota.rows[0].qtd === 500, 'notinha: nome e preço trocados, caixas e quantidade iguais');
ok(e.nota.rows[1].nome === nome(C).toUpperCase() && e.nota.rows[1].unit === 2.5, 'a outra linha da notinha não muda');
ok(e.uso[Core.itemKey(B)] === 2 && e.uso[Core.itemKey(A)] == null, 'estoque: as 2 caixas saem do neon verde, não do cardinal');
ok(e.rows[0].sci === B.sci && e.boxes[0].items[0].sci === B.sci, 'pedido salvo e caixas com a espécie nova');
ok(e.totais.valor === 1200 && e.totais.total === 1200, 'resumo: total passa de 1.000 para 1.200 (1000 × 0,70 + 200 × 2,50): ' + e.totais.total);
const m = F.mortalidade(e, e.mort.dead), nc = F.notaCorrigida(e, m);
ok(m.credito === 35 && /SIMULANS|NEON/i.test(m.rows[0].nome), 'mortalidade continua na mesma linha e usa o preço novo: 50 × 0,70 = 35 (' + m.rows[0].nome + ')');
ok(nc.rows.some(r => r.nome === nome(B).toUpperCase()) && !nc.rows.some(r => r.nome === nome(A).toUpperCase()), 'notinha final sai com a espécie certa e sem a antiga');
ok(F.saldo(e) === F.r2(1200 - 35), 'saldo do pedido = 1.200 − 35 de mortalidade = ' + F.saldo(e));
ok(e.trocas.length === 1 && e.trocas[0].de === A.sci, 'fica registrado o que foi trocado');
ok(antes.lines[0].sci === A.sci && antes.totais.total === 1000, 'a cópia de antes permite desfazer');
console.log(bad ? '\nFALHAS: ' + bad : '\nFALHAS: nenhuma'); process.exit(bad ? 1 : 0);
