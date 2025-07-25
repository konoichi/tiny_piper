# Docker Installation

This guide explains how to deploy the Piper TTS Server using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose (optional, for multi-container deployment)

## Quick Start with Docker

### 1. Create a Dockerfile

Create a file named `Dockerfile` in your project root:

```dockerfile
FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Piper TTS
RUN pip install --no-cache-dir piper-tts

# Set up working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create models directory
RUN mkdir -p models

# Expose the port
EXPOSE 5000

# Command to run the server
CMD ["uvicorn", "tts_server:app", "--host", "0.0.0.0", "--port", "5000"]
```

### 2. Create a .dockerignore File

Create a `.dockerignore` file to exclude unnecessary files:

```
.git
.github
.venv
__pycache__
*.pyc
*.pyo
*.pyd
.Python
.pytest_cache
.coverage
htmlcov
.env
```

### 3. Build the Docker Image

```bash
docker build -t piper-tts-server .
```

### 4. Run the Docker Container

```bash
docker run -p 5000:5000 -v $(pwd)/models:/app/models piper-tts-server
```

This command:
- Maps port 5000 from the container to port 5000 on your host
- Mounts your local `models` directory to the container's `/app/models` directory

## Using Docker Compose

For a more complete setup, you can use Docker Compose.

### 1. Create a docker-compose.yml File

```yaml
version: '3'

services:
  tts-server:
    build: .
    ports:
      - "5000:5000"
    volumes:
      - ./models:/app/models
    environment:
      - HOST=0.0.0.0
      - PORT=5000
      - DEBUG=false
      - MAX_CONCURRENT_REQUESTS=10
      - ENABLE_CACHING=true
      - CACHE_TTL=3600
    restart: unless-stopped
```

### 2. Start the Services

```bash
docker-compose up -d
```

### 3. View Logs

```bash
docker-compose logs -f
```

### 4. Stop the Services

```bash
docker-compose down
```

## Advanced Docker Configuration

### Environment Variables

You can configure the server using environment variables in your Docker run command or docker-compose.yml:

```bash
docker run -p 5000:5000 \
  -e HOST=0.0.0.0 \
  -e PORT=5000 \
  -e DEBUG=false \
  -e MAX_CONCURRENT_REQUESTS=10 \
  -e ENABLE_CACHING=true \
  -e CACHE_TTL=3600 \
  -v $(pwd)/models:/app/models \
  piper-tts-server
```

### Using a Custom .env File

You can also mount a custom .env file:

```bash
docker run -p 5000:5000 \
  -v $(pwd)/.env:/app/.env \
  -v $(pwd)/models:/app/models \
  piper-tts-server
```

### Health Check

Add a health check to your docker-compose.yml:

```yaml
version: '3'

services:
  tts-server:
    build: .
    ports:
      - "5000:5000"
    volumes:
      - ./models:/app/models
    environment:
      - HOST=0.0.0.0
      - PORT=5000
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    restart: unless-stopped
```

## Production Deployment Considerations

For production deployments, consider the following:

1. **Use a reverse proxy** like Nginx or Traefik to handle SSL termination and load balancing
2. **Set up monitoring** using Prometheus and Grafana
3. **Configure proper logging** with a centralized logging solution
4. **Set up automatic restarts** using Docker's restart policies
5. **Use Docker Swarm or Kubernetes** for orchestration in larger deployments

### Example Nginx Configuration

```nginx
server {
    listen 80;
    server_name tts.example.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Troubleshooting Docker Deployments

### Container Won't Start

Check the logs:

```bash
docker logs <container_id>
```

### Models Not Found

Ensure your models are correctly mounted:

```bash
docker exec -it <container_id> ls -la /app/models
```

### Performance Issues

Check resource usage:

```bash
docker stats <container_id>
```

Consider adjusting the container's resource limits:

```bash
docker run --cpus=2 --memory=4g -p 5000:5000 -v $(pwd)/models:/app/models piper-tts-server
```