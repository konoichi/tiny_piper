# API Endpoints

This page documents the available API endpoints in the Piper TTS Server.

## Base URL

All endpoints are relative to the base URL of your server:

```
http://<host>:<port>/
```

By default, this is `http://localhost:5000/` if you're running the server locally.

## Service Endpoints

### Health Check

```
GET /health
```

Checks if the server is running properly.

#### Response

```json
{
  "status": "ok",
  "version": "2.0.0",
  "models_available": 6
}
```

### Service Information

```
GET /info
```

Returns information about the service, including available models and configuration.

#### Response

```json
{
  "service": "Piper TTS",
  "version": "2.0.0",
  "models": ["en_GB-vctk-medium", "en_US-kristin-medium"],
  "api": "/docs",
  "settings": {
    "max_text_length": 500,
    "max_concurrent_requests": 10
  }
}
```

## Model Endpoints

### List Available Voices

```
GET /voices
```

Returns all available voice models and their speakers.

#### Response

```json
{
  "en_GB-vctk-medium": {
    "speakers": [
      {"index": "0", "id": "speaker1"},
      {"index": "1", "id": "speaker2"}
    ],
    "model_card": "/model_card/en_GB-vctk-medium",
    "demo": "/demo/en_GB-vctk-medium"
  },
  "en_US-kristin-medium": {
    "speakers": [
      {"index": "0", "id": "kristin"}
    ],
    "model_card": "/model_card/en_US-kristin-medium",
    "demo": "/demo/en_US-kristin-medium"
  }
}
```

### Get Model Card

```
GET /model_card/{model}
```

Returns documentation for a specific model.

#### Parameters

- `model`: The model identifier (e.g., `en_GB-vctk-medium`)

#### Response

Returns the model card as Markdown text.

### Get Model Demo Audio

```
GET /demo/{model}/raw
```

Returns a demo audio file for a specific model.

#### Parameters

- `model`: The model identifier (e.g., `en_GB-vctk-medium`)

#### Response

Returns a WAV audio file.

## TTS Endpoint

### Generate Speech

```
POST /tts
```

Generates speech from text using the specified model and speaker.

#### Request Body

```json
{
  "text": "Hello, this is a test of the text-to-speech system.",
  "model": "en_GB-vctk-medium",
  "speaker_id": "0"
}
```

#### Parameters

- `text`: The text to convert to speech (required, max 500 characters by default)
- `model`: The model to use (optional, defaults to server configuration)
- `speaker_id`: The speaker ID to use (optional, defaults to "0")

#### Response

Returns a WAV audio file with the following headers:

- `Content-Type`: `audio/wav`
- `Content-Disposition`: `attachment; filename=tts_{model}_{speaker_id}.wav`
- `X-Cache`: `HIT` or `MISS` (indicates whether the response was served from cache)

#### Error Responses

- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Model not found
- `500 Internal Server Error`: TTS generation failed
- `504 Gateway Timeout`: TTS generation timed out

## Rate Limiting

All endpoints are rate-limited to prevent abuse. The default limits are:

- Service endpoints: 60 requests per minute
- TTS endpoint: 10 requests per minute

Exceeding these limits will result in a `429 Too Many Requests` response.