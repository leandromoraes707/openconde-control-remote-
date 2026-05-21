#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/leandromoraes707/openconde-control-remote-.git}"
INSTALL_DIR="${INSTALL_DIR:-openconde-control-remote}"
DRY_RUN="${BOOTSTRAP_DRY_RUN:-0}"
START_AFTER_SETUP="1"

usage() {
  cat <<'EOF'
Uso: curl -fsSL https://raw.githubusercontent.com/leandromoraes707/openconde-control-remote-/main/scripts/bootstrap.sh | bash

Opções:
  --dir <pasta>  instala em outra pasta
  --no-start     roda setup, mas não inicia o bot no final
  --dry-run      mostra os comandos sem executar
  -h, --help     mostra esta ajuda

Variáveis opcionais:
  INSTALL_DIR=<pasta>
  REPO_URL=<url>
  BOOTSTRAP_DRY_RUN=1
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)
      INSTALL_DIR="${2:-}"
      if [[ -z "$INSTALL_DIR" ]]; then
        echo "Erro: --dir precisa de uma pasta." >&2
        exit 1
      fi
      shift 2
      ;;
    --no-start)
      START_AFTER_SETUP="0"
      shift
      ;;
    --dry-run)
      DRY_RUN="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Erro: '$1' não encontrado. Instale antes de continuar." >&2
    exit 1
  fi
}

show_cmd() {
  printf '+ '
  printf '%q ' "$@"
  printf '\n'
}

run() {
  show_cmd "$@"
  if [[ "$DRY_RUN" == "1" ]]; then
    return 0
  fi
  "$@"
}

run_in_project() {
  show_cmd bash -lc "cd $(printf '%q' "$INSTALL_DIR") && $*"
  if [[ "$DRY_RUN" == "1" ]]; then
    return 0
  fi
  (cd "$INSTALL_DIR" && bash -lc "$*")
}

echo "Instalador Telegram OpenCode Bot"

need git
need npm

if [[ -d "$INSTALL_DIR/.git" ]]; then
  run git -C "$INSTALL_DIR" pull --ff-only
elif [[ -e "$INSTALL_DIR" ]]; then
  echo "Erro: '$INSTALL_DIR' já existe e não parece ser um clone Git." >&2
  exit 1
else
  run git clone "$REPO_URL" "$INSTALL_DIR"
fi

run_in_project "npm run setup"

if [[ "$START_AFTER_SETUP" == "1" ]]; then
  run_in_project "npm start"
else
  echo "Setup concluído. Para iniciar depois: cd $INSTALL_DIR && npm start"
fi
