# Quick Start Guide

This guide will help you get the Piper TTS Server up and running quickly.

## Prerequisites

Before you begin, ensure you have the following installed:

- Python 3.8 or higher
- pip (Python package manager)
- Piper TTS engine (must be in your PATH)
- Git (optional, for cloning the repository)

## Installation Steps

### 1. Clone or Download the Repository

```bash
git clone https://github.com/yourusername/piper-tts-server.git
cd piper-tts-server
```

Or download and extract the ZIP file from the repository.

### 2. Create a Virtual Environment

It's recommended to use a virtual environment:

```bash
python -m venv .venv
```

Activate the virtual environment:

- On Linux/macOS:
  ```bash
  source .venv/bin/activate
  ```
- On Windows:
  ```bash
  .venv\Scripts\activate
  ```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure the Server

Create a `.env` file by copying the example:

```bash
cp .env.example .env
```

Edit the `.env` file to configure your server settings:

```
HOST=0.0.0.0
PORT=5000
DEBUG=false
```

### 5. Download TTS Models

Create a `models` directory and download your preferred TTS models:

```bash
mkdir -p models
# Download models from your preferred source
```

Place each model in its own subdirectory under `models/`.

### 6. Start the Server

Use the provided run script:

```bash
./run.sh
```

Or start it manually:

```bash
uvicorn tts_server:app --host 0.0.0.0 --port 5000
```

### 7. Access the Server

- API documentation: http://localhost:5000/docs
- Health check: http://localhost:5000/health
- Server info: http://localhost:5000/info

## Next Steps

- [Configure your models](../configuration/models.md)
- [Learn about the API endpoints](../api/endpoints.md)
- [Set up the frontend](../frontend/usage.md)