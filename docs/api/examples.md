# API Usage Examples

This page provides practical examples of how to use the Piper TTS Server API.

## Basic TTS Request

### Using cURL

```bash
curl -X POST "http://localhost:5000/tts" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test of the text-to-speech system.",
    "model": "en_GB-vctk-medium",
    "speaker_id": "0"
  }' \
  --output speech.wav
```

### Using Python with Requests

```python
import requests

url = "http://localhost:5000/tts"
payload = {
    "text": "Hello, this is a test of the text-to-speech system.",
    "model": "en_GB-vctk-medium",
    "speaker_id": "0"
}

response = requests.post(url, json=payload)

if response.status_code == 200:
    # Save the audio file
    with open("speech.wav", "wb") as f:
        f.write(response.content)
    print("Audio saved to speech.wav")
else:
    print(f"Error: {response.status_code}")
    print(response.text)
```

### Using JavaScript with Fetch

```javascript
async function generateSpeech() {
  const url = 'http://localhost:5000/tts';
  const payload = {
    text: 'Hello, this is a test of the text-to-speech system.',
    model: 'en_GB-vctk-medium',
    speaker_id: '0'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const blob = await response.blob();
    const audioUrl = URL.createObjectURL(blob);
    
    // Create audio element to play the speech
    const audio = new Audio(audioUrl);
    audio.play();
    
    // Or create a download link
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = 'speech.wav';
    a.textContent = 'Download speech';
    document.body.appendChild(a);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## Getting Available Voices

### Using cURL

```bash
curl -X GET "http://localhost:5000/voices"
```

### Using Python with Requests

```python
import requests
import json

url = "http://localhost:5000/voices"
response = requests.get(url)

if response.status_code == 200:
    voices = response.json()
    print(json.dumps(voices, indent=2))
    
    # Print available models and speakers
    for model, data in voices.items():
        print(f"Model: {model}")
        print("Speakers:")
        for speaker in data["speakers"]:
            print(f"  - {speaker['id']} (index: {speaker['index']})")
        print()
else:
    print(f"Error: {response.status_code}")
    print(response.text)
```

### Using JavaScript with Fetch

```javascript
async function getAvailableVoices() {
  const url = 'http://localhost:5000/voices';

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const voices = await response.json();
    console.log(voices);
    
    // Display available models and speakers
    for (const [model, data] of Object.entries(voices)) {
      console.log(`Model: ${model}`);
      console.log('Speakers:');
      data.speakers.forEach(speaker => {
        console.log(`  - ${speaker.id} (index: ${speaker.index})`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## Error Handling

When using the API, it's important to handle errors properly. Here are some common error responses and how to handle them:

### 400 Bad Request

This occurs when the request parameters are invalid.

```json
{
  "detail": "Speaker ID 'invalid' not available for model 'en_GB-vctk-medium'. Available: ['0', '1', '2']"
}
```

### 404 Not Found

This occurs when the requested model is not found.

```json
{
  "detail": "Model 'nonexistent-model' not found or .onnx file missing"
}
```

### 429 Too Many Requests

This occurs when you exceed the rate limit.

```json
{
  "detail": "Rate limit exceeded: 10 per 1 minute"
}
```

### 500 Internal Server Error

This occurs when there's an error during TTS generation.

```json
{
  "detail": "TTS generation failed: [error message]"
}
```

### Error Handling in Python

```python
import requests

url = "http://localhost:5000/tts"
payload = {
    "text": "Hello, this is a test.",
    "model": "nonexistent-model",
    "speaker_id": "0"
}

try:
    response = requests.post(url, json=payload)
    response.raise_for_status()  # Raise an exception for 4XX/5XX responses
    
    # Save the audio file
    with open("speech.wav", "wb") as f:
        f.write(response.content)
    print("Audio saved to speech.wav")
    
except requests.exceptions.HTTPError as e:
    if response.status_code == 404:
        print("Error: Model not found")
    elif response.status_code == 400:
        print("Error: Invalid request parameters")
    elif response.status_code == 429:
        print("Error: Rate limit exceeded")
    else:
        print(f"HTTP Error: {e}")
    
    # Print the error details
    try:
        error_detail = response.json().get("detail", "No detail provided")
        print(f"Detail: {error_detail}")
    except:
        print(f"Response: {response.text}")
        
except requests.exceptions.RequestException as e:
    print(f"Request Error: {e}")
```

### Error Handling in JavaScript

```javascript
async function generateSpeech() {
  const url = 'http://localhost:5000/tts';
  const payload = {
    text: 'Hello, this is a test.',
    model: 'nonexistent-model',
    speaker_id: '0'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      
      switch (response.status) {
        case 400:
          console.error('Bad Request:', errorData.detail);
          break;
        case 404:
          console.error('Not Found:', errorData.detail);
          break;
        case 429:
          console.error('Rate Limit Exceeded:', errorData.detail);
          break;
        case 500:
          console.error('Server Error:', errorData.detail);
          break;
        default:
          console.error(`HTTP error! Status: ${response.status}`, errorData);
      }
      return;
    }

    const blob = await response.blob();
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    audio.play();
    
  } catch (error) {
    console.error('Network Error:', error);
  }
}
```