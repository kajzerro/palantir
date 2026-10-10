#!/usr/bin/env bash
# Uruchamia demo lokalnie: prosty serwer + otwarcie przeglądarki.
cd "$(dirname "$0")"
PORT="${1:-8081}"
URL="http://localhost:$PORT"
echo "SPEKTRE AIR demo: $URL   (zatrzymanie: Ctrl+C)"
( sleep 1; (xdg-open "$URL" || open "$URL") >/dev/null 2>&1 ) &
if command -v python3 >/dev/null 2>&1; then python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then python -m http.server "$PORT"
elif command -v npx >/dev/null 2>&1; then npx --yes http-server -p "$PORT" -c-1 .
else echo "Brak Pythona i Node. Otwórz plik index.html bezpośrednio w Chrome/Edge."; fi
