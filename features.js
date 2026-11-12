/* Prestige Pedidos — lógica dos recursos extras (histórico, estoque, preço por cliente, conferência, pós-venda, painel, voz, nuvem).
   Sem tela: roda no navegador (window.Features) e no Node (testes). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.Features = factory(root.Core);
})(typeof self !== 'undefined' ? self : this, function (Core) {
  'use strict';

  const up = s => String(s == null ? '' : s).trim().toUpperCase();
  const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const todayISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return todayISO(new Date(y, m - 1, d + n)); };
  const daysBetween = (a, b) => { const f = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((f(b) - f(a)) / 86400000); };

  /* ---------- preço por cliente (item 19) ---------- */
  // linhas "ESPÉCIE = 0,35" (científico ou comum)
  function parsePrecos(text) {
    const o = {};
    String(text || '').split(/\n/).forEach(l => {
      const m = l.split('='); if (m.length < 2) return;
      const k = up(m[0]), v = parseFloat(m.slice(1).join('=').replace(/[^\d,.\-]/g, '').replace(',', '.'));
      if (k && v > 0) o[k] = v;
    });
    return o;
  }
  function priceFor(cli, it) {
    if (!cli) return it.preco;
    const esp = parsePrecos(cli.precos);
    if (esp[up(it.sci)] > 0) return esp[up(it.sci)];
    if (esp[up(it.comum)] > 0) return esp[up(it.comum)];
    const d = parseFloat(cli.desc) || 0;
    return d > 0 && d < 100 ? r2(it.preco * (1 - d / 100)) : it.preco;
  }

  /* ---------- estoque restante (item 12) ---------- */
  const active = e => !(e.pay && e.pay.status === 'cancelado');
  // caixas já vendidas por item, desde o último envio da stocklist
  function soldBoxes(hist, stamp, excludeId) {
    const sold = {};
    (hist || []).forEach(e => { if (e.id === excludeId || !active(e) || e.stamp !== stamp) return; Object.entries(e.uso || {}).forEach(([k, v]) => { sold[k] = (sold[k] || 0) + v; }); });
    return sold;
  }
  function effCatalog(catalog, sold, cli) {
    return catalog.map(c => {
      const used = Math.ceil(((sold || {})[Core.itemKey(c)] || 0) - 1e-9);
      return Object.assign({}, c, { estoqueTab: c.estoque, precoTab: c.preco, vendido: used, estoque: c.estoque === null ? null : Math.max(0, c.estoque - used), preco: priceFor(cli, c) });
    });
  }
  // caixas que cada item consome no pedido
  function usoOf(rows, catalog) {
    const uso = {};
    rows.forEach(r => {
      const it = Core.byId(catalog, r.sel); if (!r.use || !it) return;
      const b = r.mode === 'mista' ? r.qty / it.caixa : r.boxes; if (!(b > 0)) return;
      const k = Core.itemKey(it); uso[k] = r2((uso[k] || 0) + b);
    });
    return uso;
  }

  /* ---------- histórico (itens 1, 9, 17, 18) ---------- */
  function snapRows(rows, catalog) {
    return rows.map(r => { const it = Core.byId(catalog, r.sel); return it ? { sci: it.sci, comum: it.comum, caixa: it.caixa, rio: it.rio || '', mode: r.mode, boxes: r.boxes, qty: r.qty, group: r.group || 0, perBox: r.perBox || 0, frac: r.frac || 0, preco: r.preco || 0, use: !!r.use, raw: r.raw || '' } : null; }).filter(Boolean);
  }
  function makeEntry(x) {
    const { P, nota, catalog, prev } = x, T = nota.totals, kg = x.kg || 8;
    return {
      id: x.id, ts: x.ts, upd: x.ts, dataISO: x.dataISO, cliente: { nome: x.cliente.nome, end: x.cliente.end || '' },
      inv: String(x.inv || ''), atNum: x.atNum || 0, nf: x.nf || '', temAt: !!nota.ex.temAt, dia: nota.dia, stamp: x.stamp || 0,
      rows: snapRows(x.rows, catalog), uso: usoOf(x.rows, catalog),
      lines: P.L.map(l => ({ key: Core.itemKey(l.it), sci: l.it.sci, comum: l.it.comum, nome: Core.docName(l.it, x.cfg), preco: l.it.preco, peixes: l.peixes, boxes: l.boxesCol || 0, qtyBox: l.qtyBox, ini: l.ini, fim: l.fim, mista: !!l.mista })),
      boxes: P.boxes.map(b => ({ no: b.no, items: b.items.map(i => ({ sci: i.it.sci, q: i.q })) })),
      nota: { rows: nota.rows.map(r => Object.assign({}, r)), ex: Object.assign({}, nota.ex), dia: nota.dia },
      totais: { caixas: P.total, peixes: P.peixes, valor: r2(P.valor), fish: r2(T.fish), gta: r2(T.gta), atestado: r2(T.atestado), emb: r2(T.emb + T.emb2), total: r2(T.total), kg: P.total * kg },
      creditoAplicado: r2(x.creditoAplicado || 0),
      pay: prev ? prev.pay : { status: 'aguardando', pago: 0, dataPago: '', obs: '' },
      mort: prev ? prev.mort : null,
      moeda: x.moeda || null,
    };
  }
  /* desconto para pagamento à vista: dado DEPOIS, num pedido já salvo (e.avista = { pct, valor, em }).
     É uma % sobre o valor dos peixes (sem GTA, embalagem, atestado nem créditos), igual ao orçamento. */
  // pedidos do "Pedido rápido" não guardam as linhas da notinha: monta a partir das espécies e preços do pedido
  const notaDe = e => {
    const nr = (e.nota && e.nota.rows) || [];
    if (nr.length || !(e.lines || []).length) return { rows: nr.map(r => Object.assign({}, r)), ex: Object.assign({}, e.nota && e.nota.ex, { gtaAuto: false, gta: e.totais.gta }) };
    const rows = e.lines.map(l => ({ nome: l.nome || l.comum || l.sci, cxs: null, qtd: l.peixes, unit: l.preco }));
    return { rows, ex: { temAt: !!(e.nota && e.nota.ex && e.nota.ex.temAt) || e.totais.atestado > 0, atestado: e.totais.atestado || 0, gtaAuto: false, gta: e.totais.gta || 0, embalagem: 0, qCaixaMaior: e.totais.emb > 0 ? 1 : 0, caixaMaior: e.totais.emb || 0 } };
  };
  const baseAvista = e => {
    const f = notaDe(e).rows.reduce((a, r) => a + (r.credito ? 0 : Core.notinhaLineTotal(r)), 0);
    return Math.max(0, r2(f - (e.mort && e.mort.destino === 'abater' ? e.mort.credito || 0 : 0)));
  };
  const valorAvista = (e, pct) => Math.round(baseAvista(e) * Math.max(0, Math.min(100, +pct || 0))) / 100;
  const devido = e => r2(e.totais.total - (e.mort && e.mort.destino === 'abater' ? e.mort.credito : 0) - (e.avista ? e.avista.valor || 0 : 0));
  const saldo = e => r2(Math.max(0, devido(e) - ((e.pay && e.pay.pago) || 0)));
  // crédito guardado do cliente (mortalidade "guardar") menos o que já foi descontado em pedidos novos
  function creditoCliente(hist, nome) {
    let c = 0;
    (hist || []).forEach(e => {
      if (up(e.cliente.nome) !== up(nome) || !active(e)) return;
      if (e.mort && e.mort.destino === 'guardar') c += e.mort.credito || 0;
      c -= e.creditoAplicado || 0;
    });
    return Math.max(0, r2(c));
  }
  function creditRow(valor, label) { return { nome: label || 'CRÉDITO PEDIDO ANTERIOR', cxs: null, qtd: -1, unit: r2(valor), credito: true, aplicado: true }; }

  // mortalidade (item 17): dead = { "<índice da linha>": nº de peixes mortos }
  function mortalidade(e, dead) {
    const rows = []; let credito = 0, mortos = 0;
    e.lines.forEach((l, i) => {
      const n = Math.min(Math.max(0, parseInt(dead[i], 10) || 0), l.peixes); if (!n) return;
      credito += n * l.preco; mortos += n;
      rows.push({ nome: `CRÉDITO MORTALIDADE – ${(Core.shortName ? Core.shortName({ sci: l.sci, comum: l.comum }, null) : l.comum)}`, cxs: null, qtd: -n, unit: l.preco, credito: true });
    });
    return { credito: r2(credito), mortos, rows };
  }
  // notinha corrigida: linhas originais + créditos; GTA e atestado ficam como foram cobrados
  function notaCorrigida(e, mort) {
    const nd = notaDe(e), rows = nd.rows.concat(mort.rows), av = e.avista && e.avista.valor > 0 ? e.avista : null;
    const ex = nd.ex, t0 = Core.notinhaTotals(rows, ex, Core.DEFAULT_CFG.valores);
    // com desconto à vista a nota segue o modelo dele: subtotal, "10% DESCONTO", subtotal com desconto, e só depois GTA/embalagem
    const totals = av ? Object.assign({}, t0, { desconto: av.valor, pct: av.pct, total: r2(t0.total - av.valor) }) : t0;
    return { rows, ex, totals, dia: e.nota.dia, avista: av };
  }

  // situação (item 18)
  const STATUS = { aguardando: 'Aguardando pagamento', pago: 'Pago', embarcado: 'Embarcado', entregue: 'Entregue', cancelado: 'Cancelado' };
  function situacao(e, hoje, prazo) {
    const st = (e.pay && e.pay.status) || 'aguardando', s = saldo(e), dias = daysBetween(e.dataISO, hoje || todayISO());
    if (st === 'cancelado') return { key: st, label: STATUS[st], kind: 'warn', saldo: 0, dias };
    if (s <= 0 && (e.pay.pago || 0) > 0) return { key: 'pago', label: 'Pago', kind: 'ok', saldo: 0, dias };
    if (st === 'pago') return { key: st, label: 'Pago', kind: 'ok', saldo: 0, dias };
    if (dias > (prazo == null ? 7 : prazo)) return { key: 'atrasado', label: 'Atrasado · ' + dias + ' dias', kind: 'bad', saldo: s, dias };
    return { key: st, label: STATUS[st] || st, kind: st === 'aguardando' ? 'warn' : 'ok', saldo: s, dias };
  }
  const fmtBR = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function msgCobranca(e, empresa) {
    const s = saldo(e), dBR = e.dataISO.split('-').reverse().join('/');
    return `Olá! Tudo bem? Aqui é da ${empresa || 'Prestige Aquarium'}. Passando para lembrar do pedido de ${dBR} (invoice ${e.inv}${e.nf ? ', NF ' + e.nf : ''}), no valor de R$ ${fmtBR(devido(e))}` +
      ((e.pay && e.pay.pago) ? `, com R$ ${fmtBR(e.pay.pago)} já recebidos. Saldo em aberto: R$ ${fmtBR(s)}.` : '. Ainda não identificamos o pagamento.') + ' Pode nos enviar o comprovante assim que fizer? Obrigado!';
  }

  /* ---------- conferência automática entre documentos (item 11) ---------- */
  function crossCheck(x) {
    const { P, nota, rows, catalog, cliente, num, hist, curId, kg } = x, T = nota.totals, out = [];
    const add = (lvl, txt) => out.push({ lvl, txt });
    const fmtI = n => n.toLocaleString('pt-BR');
    if (!P.L.length) return [{ lvl: 'bad', txt: 'Nenhum item válido no pedido.' }];
    // caixas
    const cxPacking = P.L.length ? Math.max(...P.L.map(l => l.fim)) : 0, nEtiq = P.boxes.length;
    const seq = new Set(); P.L.forEach(l => { for (let b = l.ini; b <= l.fim; b++) seq.add(b); });
    const caixasOk = P.total === T.caixas && P.total === nEtiq && P.total === cxPacking && seq.size === P.total;
    add(caixasOk ? 'ok' : 'bad', caixasOk ? `Caixas: ${P.total} na invoice, no packing list (1 a ${cxPacking}), nas etiquetas e na notinha.` : `Caixas diferentes: invoice ${P.total}, packing até ${cxPacking}, etiquetas ${nEtiq}, notinha ${T.caixas}.`);
    // peixes
    const fe = P.boxes.reduce((a, b) => a + b.items.reduce((s, i) => s + i.q, 0), 0);
    const pOk = P.peixes === T.peixes && P.peixes === fe;
    add(pOk ? 'ok' : 'bad', pOk ? `Peixes: ${fmtI(P.peixes)} em todos os documentos (invoice, atestado, etiquetas e notinha).` : `Peixes diferentes: invoice ${fmtI(P.peixes)}, etiquetas ${fmtI(fe)}, notinha ${fmtI(T.peixes)}.`);
    // valor dos peixes
    const dv = r2(T.fish - P.valor);
    add(Math.abs(dv) < 0.005 ? 'ok' : 'warn', Math.abs(dv) < 0.005 ? `Valor dos peixes: R$ ${fmtBR(P.valor)} na invoice e na notinha.` : `Valor dos peixes difere: invoice R$ ${fmtBR(P.valor)} e notinha R$ ${fmtBR(T.fish)} (diferença R$ ${fmtBR(dv)}). Confirme se foi de propósito.`);
    // preço por linha da notinha x invoice
    if (nota.rows.length === P.L.length) {
      const dif = nota.rows.map((r, i) => (Math.abs(r.unit - P.L[i].it.preco) > 0.0001 ? `${r.nome} (notinha ${fmtBR(r.unit)}, invoice ${fmtBR(P.L[i].it.preco)})` : '')).filter(Boolean);
      if (dif.length) add('warn', 'Preço unitário diferente entre notinha e invoice: ' + dif.join('; ') + '.');
    } else add('warn', `A notinha tem ${nota.rows.filter(r => !r.credito).length} linhas e a invoice ${P.L.length}.`);
    add('ok', `Peso: ${P.total} caixas × ${kg || 8} kg = ${P.total * (kg || 8)} kg.`);
    // estoque
    const bad = rows.filter(r => r.use).map(r => ({ r, st: Core.status(r, catalog) })).filter(o => o.st.kind === 'bad');
    if (bad.length) add('bad', 'Estoque ou correspondência com problema: ' + bad.map(o => { const it = Core.byId(catalog, o.r.sel); return `${it ? it.comum : o.r.raw} (${o.st.txt})`; }).join('; ') + '.');
    const warn = rows.filter(r => r.use).map(r => ({ r, s: Core.status(r, catalog) })).filter(o => o.s.kind === 'warn');
    if (warn.length) add('warn', 'Itens com aviso na conferência: ' + warn.map(o => { const it = Core.byId(catalog, o.r.sel); return `${it ? it.comum : o.r.raw} (${o.s.txt})`; }).join('; ') + '.');
    const off = rows.filter(r => !r.use);
    if (off.length) add('warn', `${off.length} linha(s) do pedido ficaram de fora: ${off.map(r => r.raw).join(' | ')}.`);
    // dados do pedido
    if (!cliente.end) add('warn', 'O cliente está sem endereço (a invoice sai sem “SOLD TO” completo).');
    if (!num.nf || /^0+$/.test(String(num.nf))) add('warn', 'Nota Fiscal sem número (etiquetas e atestado vão sem NF).');
    const dupInv = (hist || []).find(e => e.id !== curId && active(e) && String(e.inv) === String(num.invoice));
    if (dupInv) add('bad', `Invoice nº ${num.invoice} já foi usada no pedido de ${dupInv.cliente.nome} (${dupInv.dataISO.split('-').reverse().join('/')}).`);
    const dupAt = nota.ex.temAt && num.atestado && (hist || []).find(e => e.id !== curId && active(e) && e.temAt && e.atNum === num.atestado);
    if (dupAt) add('warn', `Atestado nº ${num.atestado} já foi usado no pedido de ${dupAt.cliente.nome}.`);
    const dupNf = num.nf && !/^0+$/.test(String(num.nf)) && (hist || []).find(e => e.id !== curId && active(e) && e.nf === String(num.nf));
    if (dupNf) add('warn', `A NF ${num.nf} já aparece no pedido de ${dupNf.cliente.nome}.`);
    return out;
  }

  /* ---------- romaneio, painel, reposição, IBAMA (itens 21, 22, 24, 27) ---------- */
  const inRange = (e, a, b) => e.dataISO >= a && e.dataISO <= b && active(e);
  function romaneio(hist, dia) {
    const L = (hist || []).filter(e => e.dataISO === dia && active(e)).sort((a, b) => a.ts - b.ts);
    const esp = {};
    L.forEach(e => e.lines.forEach(l => { const o = esp[l.sci] || (esp[l.sci] = { sci: l.sci, comum: l.nome || l.comum, peixes: 0, clientes: new Set() }); o.peixes += l.peixes; o.clientes.add(e.cliente.nome); }));
    return {
      pedidos: L, tot: { caixas: L.reduce((a, e) => a + e.totais.caixas, 0), peixes: L.reduce((a, e) => a + e.totais.peixes, 0), kg: L.reduce((a, e) => a + e.totais.kg, 0), valor: r2(L.reduce((a, e) => a + e.totais.valor, 0)), total: r2(L.reduce((a, e) => a + devido(e), 0)) },
      especies: Object.values(esp).map(o => ({ sci: o.sci, comum: o.comum, peixes: o.peixes, clientes: o.clientes.size })).sort((a, b) => b.peixes - a.peixes),
    };
  }
  function painel(hist, a, b, hoje, prazo) {
    const L = (hist || []).filter(e => inRange(e, a, b)), esp = {}, cli = {}, dia = {};
    L.forEach(e => {
      e.lines.forEach(l => { const o = esp[l.sci] || (esp[l.sci] = { sci: l.sci, nome: l.nome || l.comum, peixes: 0, valor: 0 }); o.peixes += l.peixes; o.valor += l.peixes * l.preco; });
      const c = cli[up(e.cliente.nome)] || (cli[up(e.cliente.nome)] = { nome: e.cliente.nome, pedidos: 0, total: 0, peixes: 0 }); c.pedidos++; c.total += devido(e); c.peixes += e.totais.peixes;
      dia[e.dataISO] = (dia[e.dataISO] || 0) + devido(e);
    });
    const receber = r2(L.reduce((s, e) => s + situacao(e, hoje, prazo).saldo, 0)), atrasados = L.filter(e => situacao(e, hoje, prazo).key === 'atrasado');
    return {
      pedidos: L.length, caixas: L.reduce((s, e) => s + e.totais.caixas, 0), peixes: L.reduce((s, e) => s + e.totais.peixes, 0),
      faturamento: r2(L.reduce((s, e) => s + devido(e), 0)), receber, atrasados: atrasados.length, valorAtrasado: r2(atrasados.reduce((s, e) => s + situacao(e, hoje, prazo).saldo, 0)),
      ticket: L.length ? r2(L.reduce((s, e) => s + devido(e), 0) / L.length) : 0,
      especies: Object.values(esp).sort((x, y) => y.peixes - x.peixes), clientes: Object.values(cli).sort((x, y) => y.total - x.total),
      dias: Object.entries(dia).sort((x, y) => x[0].localeCompare(y[0])).map(([d, v]) => ({ dia: d, valor: r2(v) })),
    };
  }
  // lista de reposição: vendas dos últimos `dias` dias x estoque que sobrou
  function reposicao(hist, eff, opt) {
    const hoje = opt.hoje || todayISO(), dias = opt.dias || 30, meta = opt.meta || 2, ini = addDays(hoje, -dias + 1), vend = {};
    (hist || []).filter(e => inRange(e, ini, hoje)).forEach(e => Object.entries(e.uso || {}).forEach(([k, v]) => { vend[k] = (vend[k] || 0) + v; }));
    return eff.filter(c => (vend[Core.itemKey(c)] || 0) > 0).map(c => {
      const cx = vend[Core.itemKey(c)], sem = cx * 7 / dias, resta = c.estoque, cob = resta === null ? 0 : (sem > 0 ? resta / sem : null);
      return { id: c.id, sci: c.sci, comum: c.comum, caixa: c.caixa, vendidoCx: r2(cx), vendidoPeixes: Math.round(cx * c.caixa), porSemana: r2(sem), resta, semanas: cob === null ? null : r2(cob), repor: Math.max(0, Math.ceil(sem * meta - (resta || 0))) };
    }).sort((a, b) => (a.semanas === null ? 99 : a.semanas) - (b.semanas === null ? 99 : b.semanas));
  }
  // linhas para o controle de exportação (IBAMA): uma por espécie de cada pedido
  function ibamaRows(hist, a, b) {
    const out = [];
    (hist || []).filter(e => inRange(e, a, b)).sort((x, y) => x.dataISO.localeCompare(y.dataISO) || x.ts - y.ts).forEach(e => e.lines.forEach(l => out.push({ data: e.dataISO, nf: e.nf, invoice: e.inv, cliente: e.cliente.nome, destino: e.cliente.end, sci: l.sci, comum: l.nome || l.comum, qtd: l.peixes })));
    return out;
  }

  /* ---------- pedido por voz (item 14): "duzentos e cinquenta neon" -> "250 neon" ---------- */
  const UN = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19 };
  const DZ = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
  const CT = { cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900 };
  const isNum = w => w in UN || w in DZ || w in CT || w === 'mil';
  function spokenToDigits(text) {
    const toks = String(text).split(/(\s+)/), out = []; let i = 0;
    while (i < toks.length) {
      const t = toks[i], w = norm(t);
      if (t.trim() && isNum(w)) {
        let j = i, total = 0, cur = 0, used = false, end = i + 1;
        while (j < toks.length) {
          const x = norm(toks[j]);
          if (!toks[j].trim()) { j++; continue; }
          if (isNum(x)) { if (x === 'mil') { total += (cur || 1) * 1000; cur = 0; } else cur += UN[x] ?? DZ[x] ?? CT[x]; used = true; j++; end = j; }
          else if (x === 'e' && used) { // "e" só liga números ("mil e quinhentos")
            let k = j + 1; while (k < toks.length && !toks[k].trim()) k++;
            if (k < toks.length && isNum(norm(toks[k]))) { j = k; } else break;
          } else break;
        }
        out.push(String(total + cur)); i = end; continue;
      }
      out.push(t); i++;
    }
    return out.join('').replace(/\s+/g, ' ').trim();
  }

  /* ---------- nuvem com senha (item 25): dados cifrados no navegador (AES-GCM) antes de sair ---------- */
  const cr = () => (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle ? globalThis.crypto : null);
  const b64 = u8 => { if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64'); let s = ''; u8.forEach(b => { s += String.fromCharCode(b); }); return btoa(s); };
  const unb64 = s => { if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64')); const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const hex = u8 => Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join('');
  const enc = new TextEncoder(), dec = new TextDecoder();
  async function deriveKeys(space, pass) {
    const c = cr(); if (!c) throw new Error('Este navegador não tem criptografia disponível (use https).');
    const sp = norm(space).trim();
    const id = hex(new Uint8Array(await c.subtle.digest('SHA-256', enc.encode(`pp-id|${sp}|${pass}`))));
    const base = await c.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    const key = await c.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('pp-salt|' + sp), iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    return { id, key };
  }
  async function encryptJSON(obj, key) {
    const c = cr(), iv = c.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await c.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj))));
    return 'v1.' + b64(iv) + '.' + b64(ct);
  }
  async function decryptJSON(s, key) {
    const [v, iv, ct] = String(s).split('.'); if (v !== 'v1') throw new Error('Formato desconhecido');
    try { return JSON.parse(dec.decode(await cr().subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct)))); } catch (_) { throw new Error('Senha incorreta ou dados corrompidos.'); }
  }
  // junta dois históricos pelo id (vence o mais recente)
  function mergeHist(a, b) {
    const m = new Map(); [...(a || []), ...(b || [])].forEach(e => { const o = m.get(e.id); if (!o || (e.upd || e.ts) > (o.upd || o.ts)) m.set(e.id, e); });
    return [...m.values()].sort((x, y) => x.ts - y.ts);
  }
  function mergeClientes(a, b) {
    const m = new Map(); [...(b || []), ...(a || [])].forEach(c => { m.set(up(c.nome), c); }); return [...m.values()];
  }
  async function cloudRequest(f, cfg, method, ids, body, cols) {
    const base = cfg.url.replace(/\/+$/, '') + '/rest/v1/pp_sync';
    const h = { apikey: cfg.key, 'Content-Type': 'application/json' };
    const bearer = cfg.token || (/^eyJ/.test(cfg.key) ? cfg.key : ''); // chave nova (sb_publishable_...) não é JWT: não vai no Authorization
    if (bearer) h.Authorization = 'Bearer ' + bearer;
    if (method === 'POST') h.Prefer = 'resolution=merge-duplicates,return=minimal';
    const r = await f(method === 'GET' ? `${base}?id=eq.${ids}&select=${cols || 'data,updated_at'}` : base, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) throw new Error(`A nuvem respondeu ${r.status}. Confira o endereço, a chave e se a tabela pp_sync foi criada.`);
    return method === 'GET' ? r.json() : null;
  }
  // keys.key === null  ->  modo "uma senha só": o conteúdo vai como texto simples (protegido pelo login e pela regra da tabela)
  async function cloudPull(f, cfg, keys) {
    const rows = await cloudRequest(f, cfg, 'GET', keys.id);
    if (!rows.length) return null;
    const raw = rows[0].data;
    return { mod: Date.parse(rows[0].updated_at) || 0, data: keys.key ? await decryptJSON(raw, keys.key) : JSON.parse(String(raw).replace(/^p1\./, '')) };
  }
  async function cloudMod(f, cfg, keys) { // só a data da última gravação (barato: usado a cada poucos segundos)
    const rows = await cloudRequest(f, cfg, 'GET', keys.id, null, 'updated_at');
    return rows.length ? (Date.parse(rows[0].updated_at) || 0) : null;
  }
  async function cloudPush(f, cfg, keys, data, mod) {
    await cloudRequest(f, cfg, 'POST', null, { id: keys.id, data: keys.key ? await encryptJSON(data, keys.key) : 'p1.' + JSON.stringify(data), updated_at: new Date(mod).toISOString() });
  }
  // junta dois lados sem perder nada: listas com "id" viram a união (o mais novo vence), objetos se juntam campo a campo
  const vazio = v => v === null || v === undefined || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) || v === '';
  // índice do que existia na última sincronização: caminho -> lista de ids. Serve para saber o que foi APAGADO de um lado.
  const comId = v => Array.isArray(v) && v.length > 0 && v.every(x => x && typeof x === 'object' && x.id !== undefined && x.id !== null);
  function idIndex(data) {
    const ix = {};
    (function walk(v, path, depth) {
      if (depth > 5 || v === null || typeof v !== 'object') return;
      if (Array.isArray(v)) { if (!comId(v) && v.length) return; ix[path] = v.map(x => String(x.id)); v.forEach(x => walk(x, path + '/' + x.id, depth + 1)); return; }
      Object.keys(v).forEach(k => walk(v[k], path ? path + '.' + k : k, depth + 1));
    })(data, '', 0);
    return ix;
  }
  // a = deste aparelho, b = da nuvem; bNovo = a nuvem é a mais nova; base = idIndex da última sincronização (opcional)
  function mergeData(a, b, bNovo, base, path) {
    path = path || '';
    const lista = Array.isArray(a) || Array.isArray(b);
    if (lista && base && base[path] && Array.isArray(a) && Array.isArray(b)) { // só quando os dois lados têm a lista de verdade
      const A = a, B = b;
      if ((!A.length || comId(A)) && (!B.length || comId(B))) {
        const ja = new Set(base[path]), mA = new Map(A.map(x => [String(x.id), x])), mB = new Map(B.map(x => [String(x.id), x])), out = [], visto = new Set();
        const add = id => {
          if (visto.has(id)) return; visto.add(id);
          const x = mA.get(id), y = mB.get(id);
          if (x && y) out.push(mergeData(x, y, bNovo, base, path + '/' + id));
          else if (!ja.has(id)) out.push(x || y); // novo de um lado só: fica. Se já existia e sumiu de um lado, foi apagado: não volta
        };
        (bNovo ? B : A).forEach(x => add(String(x.id))); (bNovo ? A : B).forEach(x => add(String(x.id)));
        return out;
      }
    }
    if (vazio(a)) return b; if (vazio(b)) return a;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (!comId(a) || !comId(b)) return bNovo ? b : a;
      const mA = new Map(a.map(x => [String(x.id), x])), mB = new Map(b.map(x => [String(x.id), x])), out = [], visto = new Set();
      const add = id => { if (visto.has(id)) return; visto.add(id); const x = mA.get(id), y = mB.get(id); out.push(x && y ? mergeData(x, y, bNovo, base, path + '/' + id) : (x || y)); };
      (bNovo ? b : a).forEach(x => add(String(x.id))); (bNovo ? a : b).forEach(x => add(String(x.id)));
      return out;
    }
    if (typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      const o = {}; new Set([...(bNovo ? Object.keys(b) : Object.keys(a)), ...Object.keys(a), ...Object.keys(b)]).forEach(k => { o[k] = mergeData(a[k], b[k], bNovo, base, path ? path + '.' + k : k); });
      return o;
    }
    return bNovo ? b : a;
  }

  return { todayISO, addDays, daysBetween, r2, parsePrecos, priceFor, soldBoxes, effCatalog, usoOf, makeEntry, devido, baseAvista, valorAvista, saldo, creditoCliente, creditRow, mortalidade, notaCorrigida,
    STATUS, situacao, msgCobranca, crossCheck, romaneio, painel, reposicao, ibamaRows, spokenToDigits, deriveKeys, encryptJSON, decryptJSON, cloudMod, mergeData, idIndex, mergeHist, mergeClientes, cloudPull, cloudPush, active };
});
