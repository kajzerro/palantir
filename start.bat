@echo off
rem Uruchamia demo lokalnie: prosty serwer + otwarcie przegladarki.
cd /d "%~dp0"
set PORT=8080
echo SENTINEL-CI demo: http://localhost:%PORT%   (zatrzymanie: Ctrl+C lub zamknij okno)
start "" http://localhost:%PORT%
where python >nul 2>nul && (python -m http.server %PORT% & goto :eof)
where py >nul 2>nul && (py -m http.server %PORT% & goto :eof)
where npx >nul 2>nul && (npx --yes http-server -p %PORT% -c-1 . & goto :eof)
echo Brak Pythona i Node. Otworz plik index.html bezposrednio w Chrome/Edge.
pause
