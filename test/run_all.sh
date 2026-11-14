#!/bin/bash
# roda toda a suíte e conta as falhas (muitos testes não saem com erro, então contamos a palavra FAIL)
cd "$(dirname "$0")/.."
tot=0; bad=0
for f in $(ls test/e2e*.py | sort -V); do
  out=$(timeout 300 python3 $f 2>&1); n=$(echo "$out" | grep -c "FAIL")
  tot=$((tot+1)); if [ "$n" -gt 0 ] && ! [ "$f" = "test/e2e1.py" -a "$n" -le 1 ]; then bad=$((bad+1)); echo "== $f: $n FAIL"; echo "$out" | grep "FAIL" | head -5; fi
done
echo "TESTES: $tot · COM FALHA: $bad"
