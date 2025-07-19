from fastapi import FastAPI, Request, BackgroundTasks, Response
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse, PlainTextResponse, StreamingResponse
from pydantic import BaseModel
import subprocess
import tempfile
import os
import logging
import json
from typing import List, Dict, Optional

def find_first_with_ext(folder, ext):
    files = [f for f in os.listdir(folder) if f.endswith(ext)]
    return files[0] if files else None

app = FastAPI(title="Piper TTS Service", description="Multi-Model, Multi-Speaker Piper TTS API (beliebiger Dateiname)")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
MODEL_DIR = "models"

def cleanup_file(path):
    try:
        os.remove(path)
    except Exception as e:
        logging.warning(f"Cleanup failed: {e}")

def get_models():
    # Nur Ordner, die mindestens eine .onnx-Datei enthalten
    return [
        d for d in os.listdir(MODEL_DIR)
        if os.path.isdir(os.path.join(MODEL_DIR, d)) and find_first_with_ext(os.path.join(MODEL_DIR, d), ".onnx")
    ]

def get_model_files(model):
    model_dir = os.path.join(MODEL_DIR, model)
    onnx_file = find_first_with_ext(model_dir, ".onnx")
    json_file = find_first_with_ext(model_dir, ".onnx.json")
    card_file = find_first_with_ext(model_dir, ".md")  # Model Card
    demo_file = find_first_with_ext(model_dir, ".wav") # Demo
    return {
        "onnx": os.path.join(model_dir, onnx_file) if onnx_file else None,
        "json": os.path.join(model_dir, json_file) if json_file else None,
        "card": os.path.join(model_dir, card_file) if card_file else None,
        "demo": os.path.join(model_dir, demo_file) if demo_file else None,
        "onnx_name": onnx_file,
        "json_name": json_file,
        "card_name": card_file,
        "demo_name": demo_file,
    }

def get_speakers_for_model(model):
    files = get_model_files(model)
    json_path = files["json"]
    if not json_path or not os.path.isfile(json_path):
        return [], []
    with open(json_path, "r") as f:
        meta = json.load(f)
        if "speaker_id_map" in meta:
            return list(meta["speaker_id_map"].values()), list(meta["speaker_id_map"].keys())
        return [], []

@app.get("/health", tags=["Service"])
def health():
    return {"status": "ok"}

@app.get("/info", tags=["Service"])
def info():
    models = get_models()
    return {
        "service": "Piper TTS",
        "models": models,
        "api": "/docs"
    }

@app.get("/voices", tags=["Models"])
def voices():
    result = {}
    for model in get_models():
        files = get_model_files(model)
        idx_list, name_list = get_speakers_for_model(model)
        card = None
        if files["card"] and os.path.isfile(files["card"]):
            with open(files["card"], "r") as f:
                card = f.read()
        has_demo = files["demo"] and os.path.isfile(files["demo"])
        demo_url = f"/demo/{model}" if has_demo else None
        card_url = f"/model_card/{model}" if card else None
        result[model] = {
            "speakers": [{"index": str(idx), "id": name} for idx, name in zip(idx_list, name_list)],
            "model_card": card_url,
            "demo": demo_url,
            "files": {
                "onnx": files["onnx_name"],
                "json": files["json_name"],
                "card": files["card_name"],
                "demo": files["demo_name"]
            }
        }
    return result

@app.get("/model_card/{model}", tags=["Models"])
def model_card(model: str):
    files = get_model_files(model)
    if not files["card"]:
        return PlainTextResponse("No model_card.md found.", status_code=404)
    with open(files["card"], "r") as f:
        card = f.read()
    return PlainTextResponse(card, media_type="text/markdown")

@app.get("/demo/{model}", tags=["Models"])
def demo(model: str):
    files = get_model_files(model)
    if not files["demo"]:
        return JSONResponse({"error": "No demo .wav found."}, status_code=404)
    audio_player = f"""
    <html><body>
    <h3>Demo for model: {model}</h3>
    <audio controls autoplay>
      <source src="/demo/{model}/raw" type="audio/wav">
      Your browser does not support the audio element.
    </audio>
    </body></html>
    """
    return HTMLResponse(content=audio_player, status_code=200)

@app.get("/demo/{model}/raw", tags=["Models"])
def demo_raw(model: str):
    files = get_model_files(model)
    if not files["demo"]:
        return JSONResponse({"error": "No demo .wav found."}, status_code=404)
    return FileResponse(files["demo"], media_type="audio/wav")

class TTSRequest(BaseModel):
    text: str
    model: str = "en_GB-vctk-medium"
    speaker_id: str = "0"

@app.post("/tts", tags=["TTS"])
async def tts(req: TTSRequest, background_tasks: BackgroundTasks):
    text = req.text
    model = req.model
    speaker_id = req.speaker_id
    files = get_model_files(model)
    model_path = files["onnx"]
    json_path = files["json"]
    if not text or len(text) > 500:
        msg = "Text is empty or too long (max 500 chars)."
        logging.error(msg)
        return JSONResponse({"error": msg}, status_code=400)
    if not model_path or not os.path.isfile(model_path):
        msg = f"Model .onnx not found in '{model}'."
        logging.error(msg)
        return JSONResponse({"error": msg}, status_code=400)
    if not json_path or not os.path.isfile(json_path):
        msg = f"Model JSON .onnx.json not found in '{model}'."
        logging.error(msg)
        return JSONResponse({"error": msg}, status_code=400)
    idx_list, name_list = get_speakers_for_model(model)
    valid_speakers = [str(i) for i in idx_list]
    if idx_list and speaker_id not in valid_speakers:
        msg = f"Speaker '{speaker_id}' not valid for model '{model}'."
        logging.error(msg)
        return JSONResponse({"error": msg, "valid_speakers": valid_speakers}, status_code=400)
    logging.info(f"TTS request: Model={model_path}, Speaker={speaker_id}, Text='{text}'")
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        tf.close()
        cmd = [
            "piper", "-m", model_path,
            "--output_file", tf.name,
            "--text", text,
            "--speaker", speaker_id
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                logging.error(f"Piper error: {result.stderr}")
                return JSONResponse({"error": result.stderr}, status_code=500)
            background_tasks.add_task(cleanup_file, tf.name)
            return FileResponse(tf.name, media_type="audio/wav")
        except Exception as e:
            logging.error(f"Exception: {e}")
            return JSONResponse({"error": str(e)}, status_code=500)
