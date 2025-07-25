# Piper TTS Server

Welcome to the Piper TTS Server documentation. This server provides a multi-model, multi-speaker Text-to-Speech API built with FastAPI.

## Overview

Piper TTS Server is a robust backend for generating speech from text using various voice models. It offers:

- Multiple TTS models with different languages and voices
- REST API for easy integration
- Caching for improved performance
- Concurrency control for stability under load
- Web interface for easy interaction

## Key Features

- **Multiple Voice Models**: Support for various languages and voice styles
- **Speaker Selection**: Choose from multiple speakers for compatible models
- **REST API**: Simple HTTP API for integration with any application
- **Caching**: Efficient caching of generated audio to improve performance
- **Concurrency Control**: Stable operation even under heavy load
- **Web Interface**: User-friendly frontend for easy interaction

## Getting Started

To get started with Piper TTS Server, follow these steps:

1. [Install the server](installation/quickstart.md)
2. [Configure your models](configuration/models.md)
3. [Start using the API](api/endpoints.md)

## System Requirements

- Python 3.8 or higher
- Piper TTS engine installed and in PATH
- Sufficient disk space for TTS models
- At least 4GB RAM (8GB recommended for multiple models)

## License

This project is licensed under the MIT License - see the LICENSE file for details.