#!/usr/bin/env bash
# Vigilancia: comprueba que el sitio responda y avisa si falla.
# Uso: scripts/monitoreo.sh [url]   (pensado para cron cada 5 minutos)
set -uo pipefail

URL="${1:-https://vecinal.apioai.online/api/salud}"
LOG="/var/log/vecinal-monitoreo.log"
ESTADO="/tmp/vecinal-ultimo-estado"
TOKEN_FILE="/root/.vecinal-alerta"   # opcional: telegram_bot_token chat_id

CODIGO=$(curl -s -o /tmp/vecinal-salud.json -w "%{http_code}" --max-time 15 "$URL" || echo "000")

if [ "$CODIGO" = "200" ] && grep -q '"ok":true' /tmp/vecinal-salud.json 2>/dev/null; then
  if [ -f "$ESTADO" ] && [ "$(cat "$ESTADO")" != "ok" ]; then
    echo "$(date -Is) recuperado" >> "$LOG"
    if [ -f "$TOKEN_FILE" ]; then
      read -r BOT CHAT < "$TOKEN_FILE"
      curl -s -X POST "https://api.telegram.org/bot$BOT/sendMessage" \
        -d chat_id="$CHAT" -d text="✅ App Vecinal Solidaria volvió a responder." >/dev/null
    fi
  fi
  echo ok > "$ESTADO"
  exit 0
fi

echo "$(date -Is) FALLO código=$CODIGO" >> "$LOG"
if [ ! -f "$ESTADO" ] || [ "$(cat "$ESTADO")" != "fallo" ]; then
  echo fallo > "$ESTADO"
  if [ -f "$TOKEN_FILE" ]; then
    read -r BOT CHAT < "$TOKEN_FILE"
    curl -s -X POST "https://api.telegram.org/bot$BOT/sendMessage" \
      -d chat_id="$CHAT" \
      -d text="🚨 App Vecinal Solidaria no responde (código $CODIGO). Revisa: systemctl status vecinal" >/dev/null
  fi
fi
exit 1
