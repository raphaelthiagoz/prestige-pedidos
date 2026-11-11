/* Prestige Pedidos — painel lateral do Pedido nacional (tela larga): resumo ao vivo, cliente, pendências e vendas.
   Só mostra dados que o app já tem. Em telas pequenas ele não aparece. */
(function () {
  'use strict';
  const PP = window.PP, F = PP.Features, S = PP.S, esc = PP.esc, fmt = PP.fmt, fmtInt = PP.fmtInt;
  const UP = s => String(s || '').trim().toUpperCase();
  const dBR = iso => (iso ? iso.split('-').reverse().join('/') : '');
  const prazo = () => S.cfg.prazoPag || 7;
  function monday(iso) { const [y, m, d] = iso.split('-').map(Number), dt = new Date(y, m - 1, d); const k = (dt.getDay() + 6) % 7; return F.addDays(iso, -k); }
  function resumo() {
    const rows = (S.rows || []).filter(r => r.use);
    if (!rows.length) return '<p class="note" style="margin:8px 0 0">Cole o pedido e clique em <b>Ler pedido</b>. O resumo aparece aqui.</p>';
    let P = null; try { P = PP.currentPlan(); } catch (_) { P = null; }
    if (!P) return '';
    let bad = 0; rows.forEach(r => { try { if (PP.Core.status(r, PP.cat()).kind === 'bad') bad++; } catch (_) { /* ok */ } });
    return `<div class="sdRow"><div><b class="sdBig">${fmtInt(P.total)}</b><span>caixas</span></div><div><b class="sdBig">${fmtInt(P.peixes)}</b><span>peixes</span></div></div>
      <div class="sdVal">R$ ${fmt(P.valor)}</div><div class="sdNt">${rows.length} item(ns)${bad ? ` · <b class="sdBad">${bad} com problema</b> (sem estoque ou sem correspondência)` : ' · tudo certo com o estoque'}</div>`;
  }
  function cliente() {
    const c = PP.cliente(), nome = UP(c.nome), hoje = F.todayISO();
    const L = (S.hist || []).filter(e => UP(e.cliente && e.cliente.nome) === nome && e.id !== S.curId).sort((a, b) => (b.dataISO || '').localeCompare(a.dataISO || '') || (b.ts || 0) - (a.ts || 0));
    if (!L.length) return `<div class="sdNm">${esc(c.nome)}</div><p class="note" style="margin:6px 0 0">Sem pedidos anteriores deste cliente.</p>`;
    const ult = L[0], act = L.filter(F.active);
    const aberto = act.reduce((a, e) => a + F.saldo(e), 0), atr = act.filter(e => { const s = F.situacao(e, hoje, prazo()); return s.key === 'atrasado' && s.saldo > 0; }).length;
    const mes = L.filter(e => (e.dataISO || '').slice(0, 7) === hoje.slice(0, 7)).length, cred = F.creditoCliente(L, c.nome);
    return `<div class="sdNm">${esc(c.nome)}</div><div class="sdLn">Último pedido: <b>${dBR(ult.dataISO)}</b> · ${ult.totais.caixas} caixa(s) · R$ ${fmt(F.devido(ult))}</div>
      <div class="sdLn">Em aberto: <b class="${aberto > 0 ? 'sdWarn' : ''}">R$ ${fmt(aberto)}</b>${atr ? ` · <span class="sdBad">${atr} atrasado(s)</span>` : ''}</div>
      <div class="sdLn">Pedidos neste mês: <b>${mes}</b>${cred > 0 ? ` · crédito R$ ${fmt(cred)}` : ''}</div><button type="button" data-sp="repeat" data-id="${esc(ult.id)}" style="margin-top:10px">Repetir último pedido</button>`;
  }
  function pend() {
    let it = []; try { it = PP.assist ? PP.assist.items() : []; } catch (_) { it = []; }
    if (!it.length) return '<p class="note" style="margin:8px 0 0">Tudo em dia. Nada pendente agora.</p>';
    return `<ul class="sdUl">${it.slice(0, 4).map(a => `<li>${esc(a.title)}</li>`).join('')}</ul>${it.length > 4 ? `<p class="note" style="margin:6px 0 0">+ ${it.length - 4} outras. Clique no cardinal do menu para ver.</p>` : ''}`;
  }
  function vendas() {
    const hoje = F.todayISO(), m = monday(hoje), a = (S.hist || []).filter(F.active);
    const sum = f => { const L = a.filter(f); return { n: L.length, v: L.reduce((s, e) => s + F.devido(e), 0), cx: L.reduce((s, e) => s + (e.totais.caixas || 0), 0) }; };
    const sw = sum(e => e.dataISO >= m && e.dataISO <= F.addDays(m, 6)), sm = sum(e => (e.dataISO || '').slice(0, 7) === hoje.slice(0, 7));
    return `<div class="sdLn">Semana: <b>R$ ${fmt(sw.v)}</b> · ${sw.n} pedido(s) · ${sw.cx} cx</div><div class="sdLn">Mês: <b>R$ ${fmt(sm.v)}</b> · ${sm.n} pedido(s) · ${sm.cx} cx</div>`;
  }
  function render() {
    const el = document.getElementById('sideP'); if (!el) return;
    const on = S.view === 'pedido'; el.hidden = !on; if (!on) return;
    el.innerHTML = `<div class="card sdc"><div class="sdLb">Resumo ao vivo</div>${resumo()}</div>
      <div class="card sdc"><div class="sdLb">Cliente</div>${cliente()}</div>
      <div class="card sdc"><div class="sdLb">Pendências</div>${pend()}</div>
      <div class="card sdc"><div class="sdLb">Vendas nacionais</div>${vendas()}</div>`;
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-sp="repeat"]'); if (b && document.getElementById('sideP').contains(b)) { PP.loadEntry(b.dataset.id, 'repeat'); } });
  document.addEventListener('change', e => { if (e.target && e.target.id === 'cliente') setTimeout(render, 0); });
  PP.side = { render };
  render();
})();
