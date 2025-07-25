# Troubleshooting Guide

This guide helps you diagnose and fix common issues with the Piper TTS Server.

## Common Issues and Solutions

### Server Won't Start

#### Issue: ModuleNotFoundError

```
ModuleNotFoundError: No module named 'fastapi'
```

**Solution**: Install the required dependencies:

```bash
pip install -r requirements.txt
```

#### Issue: Address Already in Use

```
ERROR: [Errno 98] Address already in use
```

**Solution**: Either stop the process using the port or change the port in your `.env` file:

```
PORT=5001
```

#### Issue: Permission Denied

```
Permission denied: '/path/to/models'
```

**Solution**: Check the permissions of your models directory:

```bash
chmod -R 755 models
```

### Model-Related Issues

#### Issue: Model Not Found

```
Model 'en_GB-vctk-medium' not found or .onnx file missing
```

**Solution**: 
1. Check if the model directory exists:
   ```bash
   ls -la models/en_GB-vctk-medium
   ```
2. Ensure the model files are present:
   ```bash
   ls -la models/en_GB-vctk-medium/*.onnx
   ```
3. Download or restore the missing model.

#### Issue: Invalid Model Format

```
Error loading model: Invalid ONNX file
```

**Solution**: Verify that the model file is a valid ONNX file and not corrupted. Try re-downloading the model.

#### Issue: Speaker ID Not Found

```
Speaker ID '5' not available for model 'en_GB-vctk-medium'. Available: ['0', '1', '2', '3', '4']
```

**Solution**: Use a valid speaker ID for the model. You can check available speakers with:

```bash
curl http://localhost:5000/voices
```

### TTS Generation Issues

#### Issue: Piper Command Not Found

```
FileNotFoundError: Piper TTS engine not installed or not in PATH
```

**Solution**: Install Piper TTS and ensure it's in your PATH:

```bash
# Check if piper is in PATH
which piper

# If not, install it following the Piper installation instructions
# and add it to your PATH
```

#### Issue: TTS Generation Timeout

```
TTS generation timed out
```

**Solution**: 
1. Try with a shorter text
2. Increase the timeout setting in your code
3. Check system resources (CPU, memory)

#### Issue: Empty Audio Output

```
TTS generation produced no audio output
```

**Solution**: 
1. Check if the input text is valid
2. Verify that the model is working correctly with a simple test
3. Check the Piper logs for errors

### Performance Issues

#### Issue: Slow Response Times

**Solution**:
1. Enable caching:
   ```
   ENABLE_CACHING=true
   CACHE_TTL=3600
   ```
2. Reduce the maximum concurrent requests if your server has limited resources:
   ```
   MAX_CONCURRENT_REQUESTS=5
   ```
3. Use smaller models if available
4. Consider upgrading your server hardware

#### Issue: High Memory Usage

**Solution**:
1. Reduce the number of loaded models
2. Implement a model unloading strategy
3. Increase server memory or use swap space
4. Monitor memory usage with tools like `htop` or `ps`

### API Usage Issues

#### Issue: Rate Limit Exceeded

```
Rate limit exceeded: 10 per 1 minute
```

**Solution**:
1. Reduce the frequency of your requests
2. Increase the rate limit in your configuration (not recommended for production):
   ```
   RATE_LIMIT_REQUESTS=20
   ```

#### Issue: Request Validation Error

```
Validation error: Text too long (max 500 characters)
```

**Solution**:
1. Reduce the length of your text
2. Increase the maximum text length in your configuration (if appropriate):
   ```
   MAX_TEXT_LENGTH=1000
   ```

## Error Reference

| Error Code | Description | Possible Solutions |
|------------|-------------|-------------------|
| 400 | Bad Request | Check your request parameters |
| 404 | Not Found | Verify model name and existence |
| 429 | Too Many Requests | Reduce request frequency |
| 500 | Internal Server Error | Check server logs for details |
| 504 | Gateway Timeout | Try with shorter text or optimize server |

## Logging and Debugging

### Enabling Debug Mode

Set the `DEBUG` environment variable to `true`:

```
DEBUG=true
```

This will increase the verbosity of logs and help diagnose issues.

### Checking Logs

```bash
# If running directly
tail -f logs/server.log

# If running with Docker
docker logs -f piper-tts-container

# If running with systemd
journalctl -u piper-tts.service -f
```

### Testing the API

Use the health check endpoint to verify the server is running:

```bash
curl http://localhost:5000/health
```

Test TTS generation with a simple request:

```bash
curl -X POST "http://localhost:5000/tts" \
  -H "Content-Type: application/json" \
  -d '{"text": "Test", "model": "en_GB-vctk-medium", "speaker_id": "0"}' \
  --output test.wav
```

## Frequently Asked Questions

### Q: How do I add a new TTS model?

A: Place the model files in a subdirectory under the `models` directory. The directory name should match the model name, and it should contain at least an `.onnx` file and an `.onnx.json` file.

### Q: How do I change the default model?

A: Set the `DEFAULT_MODEL` environment variable in your `.env` file:

```
DEFAULT_MODEL=en_US-kristin-medium
```

### Q: How do I increase the maximum text length?

A: Set the `MAX_TEXT_LENGTH` environment variable in your `.env` file:

```
MAX_TEXT_LENGTH=1000
```

### Q: How do I disable CORS for local development?

A: Set the `ENABLE_CORS` environment variable to `false` in your `.env` file:

```
ENABLE_CORS=false
```

### Q: How do I optimize the server for production?

A: Consider the following:
1. Use a production ASGI server like Gunicorn with Uvicorn workers
2. Set up a reverse proxy like Nginx
3. Enable caching
4. Tune the concurrency settings
5. Monitor performance with tools like Prometheus

### Q: How do I backup my models?

A: Simply copy the `models` directory to a safe location:

```bash
cp -r models /path/to/backup
```

## Getting Help

If you're still experiencing issues after trying the solutions in this guide, you can:

1. Check the GitHub issues for similar problems
2. Open a new issue with detailed information about your problem
3. Reach out to the community on the project's discussion forum