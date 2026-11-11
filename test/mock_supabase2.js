// Supabase simulado (Auth por senha + PostgREST mínimo) para testar login e sincronização entre aparelhos
const http=require('http'); const port=+process.argv[2]||9012;
const files={}, db={}, toks=new Set(), refs=new Set(); let n=0, posts=0, gets=0;
const H='authorization, apikey, content-type, prefer';
http.createServer((q,r)=>{
  r.setHeader('Access-Control-Allow-Origin','*');r.setHeader('Access-Control-Allow-Headers',H);r.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  if(q.method==='OPTIONS'){r.writeHead(204);return r.end();}
  const u=new URL(q.url,'http://x'); let b='';
  q.on('data',d=>b+=d); q.on('end',()=>{
    const js=(c,o)=>{r.writeHead(c,{'Content-Type':'application/json'});r.end(JSON.stringify(o));};
    if(u.pathname==='/__db')return js(200,{db,posts,gets,files:Object.keys(files)});
    if(u.pathname==='/__reset'){for(const k in db)delete db[k];posts=0;gets=0;return js(200,{});}
    if(!q.headers.apikey)return js(401,{});
    if(u.pathname==='/auth/v1/token'){
      const o=JSON.parse(b||'{}'), g=u.searchParams.get('grant_type');
      if(g==='password'){ if(o.email==='raphael@prestige.com'&&o.password==='senha123'){const t='at'+(++n),rt='rt'+n;toks.add(t);refs.add(rt);return js(200,{access_token:t,refresh_token:rt,expires_in:3600,user:{email:o.email}});} return js(400,{error:'invalid_grant'}); }
      if(g==='refresh_token'&&refs.has(o.refresh_token)){const t='at'+(++n),rt='rt'+n;toks.add(t);refs.add(rt);return js(200,{access_token:t,refresh_token:rt,expires_in:3600,user:{email:'raphael@prestige.com'}});}
      return js(400,{});
    }
    if(u.pathname==='/rest/v1/pp_sync'){
      const a=(q.headers.authorization||'').replace('Bearer ','');
      if(!toks.has(a))return js(401,{message:'JWT required'});
      if(q.method==='GET'){gets++;const id=(u.searchParams.get('id')||'').replace('eq.','');const sel=(u.searchParams.get('select')||'data,updated_at').split(',');const row=db[id];return js(200,row?[Object.fromEntries(sel.map(k=>[k,row[k]]))]:[]);}
      if(q.method==='POST'){posts++;const o=JSON.parse(b);db[o.id]=o;r.writeHead(201);return r.end();}
    }
    if(u.pathname==='/rest/v1/pp_files'){
      const a=(q.headers.authorization||'').replace('Bearer ','');
      if(!toks.has(a))return js(401,{message:'JWT required'});
      if(q.method==='GET'){const id=(u.searchParams.get('id')||'').replace('eq.','');const row=files[id];return js(200,row?[row]:[]);}
      if(q.method==='POST'){const o=JSON.parse(b);files[o.id]=o;r.writeHead(201);return r.end();}
    }
    js(404,{});
  });
}).listen(port,()=>console.log('mock supabase na porta',port));
