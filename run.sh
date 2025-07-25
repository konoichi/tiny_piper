#!/bin/bash
# Code-ID: Abby-Run-Script-04

# ======================================================
#  🚀 Start-Skript für den Piper TTS Server (V2.0) 🚀
# ======================================================
#
# Dieses Skript:
# 1. Prüft, ob es im richtigen Verzeichnis ausgeführt wird.
# 2. Prüft, ob eine .env-Datei existiert und erstellt sie ggf.
# 3. Sucht und aktiviert das virtuelle Environment (.venv).
# 4. Startet den FastAPI Server mit den konfigurierten Einstellungen.
#
# ======================================================

# --- Verzeichnis-Check ---
if [ ! -f "tts_server.py" ]; then
    echo "❌ Fehler: Du musst dieses Skript aus dem Hauptverzeichnis deines Projekts ausführen."
    echo "Stelle sicher, dass 'tts_server.py' im aktuellen Verzeichnis ist."
    exit 1
fi

# --- .env-Check ---
if [ ! -f ".env" ]; then
    echo "⚠️ Keine .env-Datei gefunden. Erstelle aus .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ .env-Datei erstellt. Bitte passe die Einstellungen an, falls nötig."
    else
        echo "❌ Keine .env.example gefunden. Bitte erstelle eine .env-Datei manuell."
        exit 1
    fi
fi

# --- Venv-Aktivierung ---
VENV_DIR=".venv"
if [ -d "$VENV_DIR" ]; then
    echo ">>> 🐍 Aktiviere virtuelles Environment aus '$VENV_DIR'..."
    source "$VENV_DIR/bin/activate"
else
    echo "⚠️ Warnung: Kein '$VENV_DIR'-Verzeichnis gefunden. Überspringe Aktivierung."
    echo "Stelle sicher, dass deine Dependencies global installiert sind oder erstelle ein venv mit:"
    echo "python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
fi

# --- Lade Konfiguration ---
# Extrahiere Host und Port aus .env-Datei, falls vorhanden
HOST="0.0.0.0"
PORT="5000"
DEBUG="false"

if [ -f ".env" ]; then
    # Extrahiere HOST, wenn definiert
    ENV_HOST=$(grep -E "^HOST=" .env | cut -d '=' -f2)
    if [ ! -z "$ENV_HOST" ]; then
        HOST=$ENV_HOST
    fi
    
    # Extrahiere PORT, wenn definiert
    ENV_PORT=$(grep -E "^PORT=" .env | cut -d '=' -f2)
    if [ ! -z "$ENV_PORT" ]; then
        PORT=$ENV_PORT
    fi
    
    # Extrahiere DEBUG, wenn definiert
    ENV_DEBUG=$(grep -E "^DEBUG=" .env | cut -d '=' -f2)
    if [ ! -z "$ENV_DEBUG" ]; then
        DEBUG=$ENV_DEBUG
    fi
fi

echo ""
echo ">>> 🔥 Starte Piper TTS FastAPI Server (V2.0)..."
echo ">>> Lausche auf http://$HOST:$PORT"
echo ">>> API-Dokumentation unter http://$HOST:$PORT/docs"
echo ">>> Debug-Modus: $DEBUG"
echo ">>> Drücke STRG+C zum Beenden."
echo ""

# --- Server-Start ---
# Starte den Uvicorn-Server mit den konfigurierten Einstellungen
RELOAD_FLAG=""
if [ "$DEBUG" = "true" ]; then
    RELOAD_FLAG="--reload"
fi

uvicorn tts_server:app --host $HOST --port $PORT $RELOAD_FLAG