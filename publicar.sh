#!/bin/sh
# Monta a pasta "dist" com exatamente o que vai para o ar (o Netlify roda isto sozinho).
# Tudo o que está na raiz é publicado, menos o que está na lista de fora.
set -e
rm -rf dist && mkdir dist
for f in * .??*; do
  case "$f" in
    dist|node_modules|out|test|.git|.gitignore|publicar.sh|netlify.toml|package.json|package-lock.json|LEIA-ME.txt|SQL_pp_files.sql|*.zip) continue ;;
  esac
  [ -e "$f" ] && cp -R "$f" dist/
done
echo "dist/ pronta com $(find dist -type f | wc -l) arquivo(s)."
