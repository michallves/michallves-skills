#!/usr/bin/env bash
# Prepara o kit (uma vez) e, se passar uma pasta, o projeto de gravação nela. Idempotente.
# Uso: setup.sh [pasta-do-projeto]
set -euo pipefail
KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REG="--registry https://registry.npmjs.org"   # o registry padrão da VM pode estar fora do ar

(cd "$KIT" && npm i $REG --no-audit --no-fund --silent)   # versão do Playwright fixada no package.json (igual ao Chromium em cache)
if [ ! -x "$KIT/.venv/bin/edge-tts" ]; then
  python3 -m venv "$KIT/.venv" && "$KIT/.venv/bin/pip" install -q edge-tts
fi
(cd "$KIT" && npx playwright install chromium)   # no-op quando o Chromium dessa versão já está em ~/.cache/ms-playwright
echo "kit ok: $KIT"

if [ $# -ge 1 ]; then
  P="$1"; mkdir -p "$P/out" "$P/work"
  touch "$P/.gitignore"
  for l in work/ out/ .auth/ node_modules/ .venv/; do grep -qxF "$l" "$P/.gitignore" || echo "$l" >> "$P/.gitignore"; done
  [ -f "$P/roteiro.yaml" ] || cp "$KIT/exemplos/roteiro-exemplo.yaml" "$P/roteiro.yaml"
  echo "projeto ok: $P (edite roteiro.yaml; gravar: node $KIT/bin/gravar.mjs roteiro.yaml saida.mp4)"
fi
