"""
Tests für den Piper TTS Server
"""
import pytest
from fastapi.testclient import TestClient
import os
import json
from unittest.mock import patch, MagicMock

from tts_server import app
from config import settings

# Test-Client für FastAPI
client = TestClient(app)

def test_health_endpoint():
    """Test des Health-Endpoints"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "version" in response.json()

def test_info_endpoint():
    """Test des Info-Endpoints"""
    response = client.get("/info")
    assert response.status_code == 200
    assert response.json()["service"] == "Piper TTS"
    assert "models" in response.json()
    assert "settings" in response.json()

@pytest.mark.asyncio
async def test_voices_endpoint():
    """Test des Voices-Endpoints"""
    # Mock für get_models, damit wir nicht auf echte Modelle angewiesen sind
    with patch("tts_server.get_models") as mock_get_models:
        mock_get_models.return_value = ["test-model"]
        
        # Mock für get_model_files
        with patch("tts_server.get_model_files") as mock_get_files:
            mock_get_files.return_value = {
                "onnx": "test.onnx",
                "json": "test.json",
                "card": "test.md",
                "demo": "test.wav"
            }
            
            # Mock für get_speakers_for_model
            with patch("tts_server.get_speakers_for_model") as mock_get_speakers:
                mock_get_speakers.return_value = (["0"], ["speaker1"])
                
                response = client.get("/voices")
                assert response.status_code == 200
                assert "test-model" in response.json()
                assert "speakers" in response.json()["test-model"]
                assert len(response.json()["test-model"]["speakers"]) == 1

def test_tts_request_validation():
    """Test der Validierung von TTS-Anfragen"""
    # Test mit leerem Text
    response = client.post("/tts", json={"text": "", "model": "test-model", "speaker_id": "0"})
    assert response.status_code == 422  # Validation Error
    
    # Test mit zu langem Text
    long_text = "a" * (settings.max_text_length + 1)
    response = client.post("/tts", json={"text": long_text, "model": "test-model", "speaker_id": "0"})
    assert response.status_code == 422  # Validation Error
    
    # Test mit ungültigem Speaker-ID
    response = client.post("/tts", json={"text": "Test", "model": "test-model", "speaker_id": "invalid"})
    assert response.status_code == 422  # Validation Error

@pytest.mark.asyncio
async def test_tts_endpoint_with_cache():
    """Test des TTS-Endpoints mit Cache"""
    # Mock für tts_cache.get
    with patch("tts_server.tts_cache.get") as mock_cache_get:
        # Simuliere Cache-Hit
        mock_audio = b"RIFF....WAVE"  # Dummy WAV-Daten
        mock_cache_get.return_value = mock_audio
        
        response = client.post("/tts", json={"text": "Test", "model": "test-model", "speaker_id": "0"})
        assert response.status_code == 200
        assert response.headers["X-Cache"] == "HIT"
        assert response.content == mock_audio
        
        # Simuliere Cache-Miss und TTS-Generierung
        mock_cache_get.return_value = None
        
        # Mock für get_model_files
        with patch("tts_server.get_model_files") as mock_get_files:
            mock_get_files.return_value = {"onnx": "test.onnx", "json": "test.json"}
            
            # Mock für get_speakers_for_model
            with patch("tts_server.get_speakers_for_model") as mock_get_speakers:
                mock_get_speakers.return_value = ([], [])
                
                # Mock für os.path.isfile
                with patch("os.path.isfile") as mock_isfile:
                    mock_isfile.return_value = True
                    
                    # Mock für asyncio.create_subprocess_exec
                    process_mock = MagicMock()
                    process_mock.communicate = MagicMock(return_value=(mock_audio, b""))
                    process_mock.returncode = 0
                    
                    with patch("asyncio.create_subprocess_exec", return_value=process_mock):
                        # Mock für tts_cache.set
                        with patch("tts_server.tts_cache.set") as mock_cache_set:
                            response = client.post("/tts", json={"text": "Test", "model": "test-model", "speaker_id": "0"})
                            
                            # Überprüfe, ob der Cache aktualisiert wurde
                            mock_cache_set.assert_called_once()
                            
                            assert response.status_code == 200
                            assert response.headers["X-Cache"] == "MISS"

if __name__ == "__main__":
    pytest.main(["-xvs", "test_tts_server.py"])