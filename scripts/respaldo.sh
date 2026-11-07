#!/usr/bin/env bash
# Respaldo diario de la base y de las fotos, con verificación de integridad.
# Uso: scripts/respaldo.sh [directorio_de_datos]
set -euo pipefail

DATOS="${1:-/root/proyectos/app-vecinal/data}"
DESTINO="/root/respaldos/vecinal"
RETENER=14
PY="${PY:-python3}"

mkdir -p "$DESTINO"
FECHA="$(date +%Y%m%d-%H%M)"

if [ ! -f "$DATOS/app.db" ]; then
  echo "No existe $DATOS/app.db" >&2
  exit 1
fi

# Copia consistente aunque haya escrituras en curso (API de respaldo de SQLite)
"$PY" - "$DATOS/app.db" "$DESTINO/app-$FECHA.db" <<'PY'
import sqlite3, sys
origen, destino = sys.argv[1], sys.argv[2]
src = sqlite3.connect(origen)
dst = sqlite3.connect(destino)
with dst:
    src.backup(dst)
ok = dst.execute("PRAGMA integrity_check").fetchone()[0]
dst.close(); src.close()
if ok != "ok":
    print(f"RESPALDO CORRUPTO: {destino} ({ok})", file=sys.stderr)
    sys.exit(2)
PY

if [ -d "$DATOS/fotos" ]; then
  tar czf "$DESTINO/fotos-$FECHA.tar.gz" -C "$DATOS" fotos
fi

# Conservar solo los últimos N
ls -1t "$DESTINO"/app-*.db 2>/dev/null | tail -n +$((RETENER + 1)) | xargs -r rm -f
ls -1t "$DESTINO"/fotos-*.tar.gz 2>/dev/null | tail -n +$((RETENER + 1)) | xargs -r rm -f

echo "$(date -Is) respaldo ok: $DESTINO/app-$FECHA.db ($(du -h "$DESTINO/app-$FECHA.db" | cut -f1))"
