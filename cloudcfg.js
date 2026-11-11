/* Nuvem embutida: o endereço do servidor e a chave pública (publishable) ficam dentro do app.
   Quem protege os dados é o LOGIN (e-mail + senha) e as regras (RLS) da tabela pp_sync, não o sigilo desta chave.
   Em navegadores automatizados (testes) a nuvem fica desligada, a menos que o teste a ligue de propósito. */
(function () {
  'use strict';
  const PP = window.PP, store = PP.store;
  let C = { url: 'https://vyymjshuyydogsvvftng.supabase.co', key: 'sb_publishable_dI_iQCO3kJq0h-eR7d-ANQ_NTLwbMI9', esp: 'prestige', pollMs: 20000 };
  try { if (navigator.webdriver) { const t = localStorage.getItem('pp.cloudtest'); C = t ? Object.assign({}, C, JSON.parse(t)) : null; } } catch (_) { /* ok */ }
  PP.CLOUD = C;
  // configuração viva: constantes + o que muda (e-mail, última sincronização)
  PP.cloudCfg = () => {
    if (!C) return null;
    const s = store.get('sync', null) || {};
    return Object.assign({}, s, { url: C.url, key: C.key, esp: C.esp, pollMs: C.pollMs, on: true, auth: true, plain: true, pass: '', last: s.last || 0, email: s.email || '' });
  };
})();
