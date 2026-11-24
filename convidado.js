/* Prestige Pedidos — Modo convidado (v29.21).
   Serve para mostrar o sistema a outra pessoa SEM mostrar valores. Enquanto estiver ligado:
   - todo valor em dinheiro (R$, US$, € e colunas de preço/total/saldo) vira "•••";
   - Financeiro, Painel, Romaneio e relatórios e Configurações ficam escondidos;
   - downloads, impressão e escolha de pasta ficam bloqueados (os documentos têm valores);
   - para sair é preciso o PIN (ou a senha da conta, se esquecer o PIN).
   Fica só neste aparelho (não vai para a nuvem) e é lembrado se a página for recarregada.
   É um modo de apresentação: protege contra olhar a tela, não contra quem mexe no navegador. */
(function () {
  'use strict';
  const PP = window.PP, $ = PP.$, esc = PP.esc;
  const KEY = 'pp.guest', PINK = 'pp.guestpin';
  const HIDE_VIEWS = ['financeiro', 'painel', 'relat'];
  const rd = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const wr = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) { /* ok */ } };
  const isOn = () => rd(KEY) === '1';

  /* ---------- o que é "valor" ---------- */
  const SYM = /^(?:R\$|US\$|U\$S|\$|€|£)/i;
  const RE_MONEY = /(?:R\$|US\$|U\$S|\$|€|£)\s*[-−]?\s*\d[\d.,]*(?:\s?(?:mil|mi|k)\b)?|[-−]?\d[\d.,]*\s?(?:USD|EUR|BRL|reais)\b/gi;
  const MASK = '•••';
  // número com 2 casas decimais solto (ex.: 1.234,50 ou 12.50), menos peso, porcentagem, versão e data
  const DEC = /(^|[^\dvV\/.,])(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:,\d{3})*\.\d{2})(?![\d%.])(?!\s?(?:kg|g|cm|mm|m|°|h)\b)/gi;
  const TEM = /[$€£]|USD|EUR|BRL|reais|\d[.,]\d{2}/i;
  const maskText = s => s.replace(RE_MONEY, m => { const y = (m.match(SYM) || [''])[0]; return (y ? y + ' ' : '') + MASK; }).replace(DEC, '$1' + MASK);
  // cabeçalho de coluna que guarda dinheiro (qualquer tabela do app)
  const COL = /pre[çc]o|price|valor|subtotal|cr[ée]dito|saldo|desconto|custo|frete|pago|pagar|receber|devido|unit|r\$|us\$|\$|€|total(?!\s*(?:de\s*)?(?:caixas|fish|fishes|peixes|boxes|kg|cx))/i;
  const COL_SKIP_MAPA = /saldo/i; // em Notas de entrada "saldo" é quantidade de peixes, não dinheiro
  // campo (input) que guarda dinheiro, pelo rótulo
  const IN = /pre[çc]o|price|valor|desconto|custo|frete|cr[ée]dito|r\$|us\$|pagar|pago/i;

  /* ---------- varredura ---------- */
  let obs = null, tick = 0;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT']);
  function maskNodes(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentNode && !SKIP.has(n.parentNode.nodeName) && !(n.parentNode.closest && n.parentNode.closest('#gvModal, #gvBar')) && TEM.test(n.nodeValue)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    const L = []; while (w.nextNode()) L.push(w.currentNode);
    L.forEach(n => { const v = maskText(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; });
  }
  function maskAttrs(root) {
    root.querySelectorAll('[title],[aria-label],[placeholder]').forEach(el => {
      ['title', 'aria-label', 'placeholder'].forEach(a => { const v = el.getAttribute(a); if (v && TEM.test(v)) { const m = maskText(v); if (m !== v) el.setAttribute(a, m); } });
    });
  }
  const lblOf = el => {
    let t = '';
    try { if (el.labels) [...el.labels].forEach(l => { t += ' ' + l.textContent; }); } catch (_) { /* ok */ }
    if (!t) { const f = el.closest('.field'); const l = f && f.querySelector('label'); if (l) t = l.textContent; }
    return t + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('placeholder') || '') + ' ' + (el.id || '');
  };
  function maskInputs(root) {
    root.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=date]):not([type=hidden]),textarea,select').forEach(el => {
      if (el.closest('#gvModal')) return;
      const v = el.value || '';
      const lb = lblOf(el);
      if (IN.test(lb) || (v && maskText(v) !== v && !/kg|peso|weight/i.test(lb))) el.classList.add('gv-blur');
    });
  }
  function maskTables(root) {
    root.querySelectorAll('table').forEach(tb => {
      const th = tb.tHead && tb.tHead.rows[tb.tHead.rows.length - 1]; if (!th) return;
      const mapa = !!tb.closest('#vMapa');
      const idx = []; let c = 0;
      [...th.cells].forEach(h => { const t = h.textContent || ''; if (COL.test(t) && !(mapa && COL_SKIP_MAPA.test(t))) idx.push(c); c += h.colSpan || 1; });
      if (!idx.length) return;
      const n = c;
      tb.querySelectorAll('tbody tr, tfoot tr').forEach(tr => {
        if (tr.cells.length !== n) return; // linha com células mescladas: não arrisca errar a coluna
        idx.forEach(i => {
          const td = tr.cells[i]; if (!td) return;
          const w = document.createTreeWalker(td, NodeFilter.SHOW_TEXT); const L = [];
          while (w.nextNode()) L.push(w.currentNode);
          L.forEach(t => { if (/\d/.test(t.nodeValue) && t.nodeValue.trim() !== MASK) t.nodeValue = t.nodeValue.replace(/[-−]?\d[\d.,]*(?:\s?(?:mil|k)\b)?/g, MASK); });
          td.querySelectorAll('input,textarea,select').forEach(x => x.classList.add('gv-blur'));
        });
      });
    });
  }
  function pass() {
    tick = 0; if (!isOn()) return;
    if (obs) obs.disconnect();
    try {
      const root = document.body;
      maskNodes(root); maskTables(root); maskInputs(root); maskAttrs(root);
      if (HIDE_VIEWS.includes(document.body.dataset.view) && PP.go) PP.go('hoje');
    } catch (e) { /* nunca quebra o app */ }
    if (obs) watch();
  }
  function watch() { obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['value', 'data-view'] }); }
  function agenda() { if (!tick) tick = requestAnimationFrame(pass); }

  /* ---------- bloqueios (downloads, impressão, pasta) ---------- */
  const aviso = () => { try { PP.toast('Bloqueado no modo convidado: os documentos têm valores.', 'bad'); } catch (_) { /* ok */ } };
  document.addEventListener('click', e => {
    if (!isOn()) return;
    const a = e.target.closest && e.target.closest('a[download]'); if (a) { e.preventDefault(); e.stopImmediatePropagation(); aviso(); return; }
    const v = e.target.closest && e.target.closest('[data-view]'); // nenhuma rota leva às telas escondidas
    if (v && HIDE_VIEWS.includes(v.dataset.view)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  { const p = window.print; window.print = function () { if (isOn()) { aviso(); return; } return p.apply(this, arguments); }; }
  { const o = window.open; window.open = function (u) { if (isOn() && /^(blob:|data:)/.test(String(u || ''))) { aviso(); return null; } return o.apply(this, arguments); }; }
  ['showSaveFilePicker', 'showDirectoryPicker', 'showOpenFilePicker'].forEach(k => {
    if (typeof window[k] !== 'function') return; const f = window[k];
    window[k] = function () { if (isOn() && k !== 'showOpenFilePicker') { aviso(); return Promise.reject(new DOMException('Bloqueado no modo convidado', 'AbortError')); } return f.apply(this, arguments); };
  });
  document.addEventListener('keydown', e => { if (isOn() && (e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S')) { e.preventDefault(); aviso(); } }, true);

  /* ---------- PIN ---------- */
  async function hash(p) {
    try { if (crypto && crypto.subtle) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pp-guest:' + p)); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join(''); } } catch (_) { /* cai no simples */ }
    let h = 5381; const s = 'pp-guest:' + p; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return 'x' + h;
  }
  let erros = 0, bloq = 0;

  /* ---------- telas (janelinha) ---------- */
  function modal(html, onReady) {
    close();
    const m = document.createElement('div'); m.id = 'gvModal'; m.className = 'gvm'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<form class="gvbox" autocomplete="off">' + html + '</form>'; document.body.appendChild(m);
    m.addEventListener('mousedown', e => { if (e.target === m) close(); });
    if (onReady) onReady(m); const f = m.querySelector('input'); if (f) setTimeout(() => f.focus(), 20); return m;
  }
  function close() { const m = $('gvModal'); if (m) m.remove(); }
  const msg = (m, t) => { const e = m.querySelector('.gverr'); if (e) e.textContent = t || ''; };

  function ligar() {
    const tem = !!rd(PINK);
    const m = modal(`<h3>Ligar o modo convidado</h3>
      <p class="note">Todos os valores em dinheiro ficam escondidos e os downloads ficam bloqueados. Financeiro, Painel, Relatórios e Configurações somem do menu.</p>
      <div id="gvPinBox" ${tem ? 'hidden' : ''}>
        <div class="field"><label for="gvP1">Crie um PIN para sair do modo convidado (4 a 8 números)</label><input id="gvP1" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"></div>
        <div class="field"><label for="gvP2">Repita o PIN</label><input id="gvP2" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"></div>
      </div>
      ${tem ? '<p class="note">Para sair, o sistema vai pedir o PIN que você já criou. <button type="button" class="gvlk" id="gvNovoPin">Trocar o PIN</button></p>' : ''}
      <div class="gverr" role="alert"></div>
      <div class="row"><button type="submit" class="primary">Ligar o modo convidado</button><button type="button" id="gvCancel">Cancelar</button></div>`);
    m.querySelector('#gvCancel').onclick = close;
    const nb = m.querySelector('#gvNovoPin'); if (nb) nb.onclick = () => { m.querySelector('#gvPinBox').hidden = false; nb.remove(); m.querySelector('#gvP1').focus(); };
    m.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const box = m.querySelector('#gvPinBox');
      if (!box.hidden) {
        const a = m.querySelector('#gvP1').value, b = m.querySelector('#gvP2').value;
        if (!/^\d{4,8}$/.test(a)) return msg(m, 'O PIN precisa ter de 4 a 8 números.');
        if (a !== b) return msg(m, 'Os dois PINs são diferentes. Digite de novo.');
        wr(PINK, await hash(a));
      }
      close(); ativar();
    };
  }
  function sair() {
    const m = modal(`<h3>Sair do modo convidado</h3>
      <div class="field"><label for="gvPin">PIN</label><input id="gvPin" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></div>
      <div class="gverr" role="alert"></div>
      <div class="row"><button type="submit" class="primary">Sair do modo convidado</button><button type="button" id="gvCancel">Continuar no modo convidado</button></div>
      <p class="note"><button type="button" class="gvlk" id="gvEsq">Esqueci o PIN</button></p>
      <div id="gvSenhaBox" hidden>
        <p class="note">Entre com o e-mail e a senha da sua conta do sistema (a mesma do login). Precisa de internet.</p>
        <div class="field"><label for="gvEm">E-mail</label><input id="gvEm" type="email" autocomplete="username"></div>
        <div class="field"><label for="gvSn">Senha da conta</label><input id="gvSn" type="password" autocomplete="current-password"></div>
        <div class="row"><button type="button" id="gvSenhaGo" class="primary">Sair com a senha</button></div>
      </div>`);
    m.querySelector('#gvCancel').onclick = close;
    m.querySelector('#gvEm').value = ((PP.store.get('sync', {}) || {}).email) || '';
    m.querySelector('#gvEsq').onclick = () => { m.querySelector('#gvSenhaBox').hidden = false; m.querySelector('#gvSn').focus(); };
    m.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      if (Date.now() < bloq) return msg(m, 'Muitas tentativas. Espere ' + Math.ceil((bloq - Date.now()) / 1000) + ' segundos.');
      const p = m.querySelector('#gvPin').value;
      if (p && (await hash(p)) === rd(PINK)) { erros = 0; close(); desativar(); return; }
      erros++; if (erros >= 5) { bloq = Date.now() + 30000; erros = 0; return msg(m, 'PIN errado 5 vezes. Espere 30 segundos.'); }
      msg(m, 'PIN errado.'); m.querySelector('#gvPin').select();
    };
    m.querySelector('#gvSenhaGo').onclick = async () => {
      const em = m.querySelector('#gvEm').value.trim(), sn = m.querySelector('#gvSn').value; if (!em || !sn) return msg(m, 'Preencha o e-mail e a senha.');
      msg(m, 'Conferindo…');
      try { await PP.auth.login(em, sn, true); close(); desativar(); } catch (ex) { msg(m, ex && ex.code === 'AUTH' ? 'E-mail ou senha incorretos.' : 'Não consegui conferir. Veja a internet.'); }
    };
  }

  /* ---------- ligar / desligar ---------- */
  function barra() {
    if ($('gvBar')) return; const b = document.createElement('div'); b.id = 'gvBar';
    b.innerHTML = '<span>Modo convidado ligado · valores escondidos</span><button type="button" id="gvOff">Sair do modo convidado</button>'; document.body.appendChild(b);
    b.querySelector('#gvOff').onclick = sair;
  }
  function ativar() {
    wr(KEY, '1'); document.body.classList.add('gv'); barra();
    const c = $('config'); if (c && c.open) c.open = false;
    obs = obs || new MutationObserver(agenda); pass(); watch();
    if (HIDE_VIEWS.includes(PP.S.view)) PP.go('hoje');
    setTimeout(pass, 300);
  }
  function desativar() {
    wr(KEY, null); document.body.classList.remove('gv'); if (obs) obs.disconnect(); const b = $('gvBar'); if (b) b.remove();
    document.querySelectorAll('.gv-blur').forEach(x => x.classList.remove('gv-blur'));
    if (PP.reloadState) PP.reloadState(); PP.go(PP.S.view === 'financeiro' ? 'hoje' : PP.S.view); // redesenha tudo com os valores de volta
    try { PP.toast('Modo convidado desligado. Os valores voltaram.'); } catch (_) { /* ok */ }
  }

  /* ---------- botão no menu ---------- */
  function botao() {
    const f = document.querySelector('.sidefoot'); if (!f || $('gvOn')) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'gvOn'; b.textContent = 'Modo convidado';
    b.title = 'Esconde todos os valores em dinheiro e bloqueia downloads, para você mostrar o sistema a outra pessoa. Para sair precisa do PIN.';
    b.onclick = ligar; f.insertBefore(b, f.firstChild);
  }
  botao();
  PP.guest = { on: isOn, ligar, sair, pass };
  if (isOn()) ativar();
})();
