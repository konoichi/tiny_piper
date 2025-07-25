# API Integration Documentation

This document describes the API integration approach used in the TTS frontend application.

## Architecture

The API integration follows a layered architecture:

1. **API Service Layer** (`apiService.ts`): Handles direct communication with the backend API
2. **React Query Hooks** (`useModels.ts`, `useTTS.ts`): Provides React components with data fetching capabilities
3. **Component Layer**: Consumes the hooks to display and interact with data

## Features

### Enhanced Error Handling

- Consistent error format across all API calls
- Detailed error messages extracted from API responses
- Automatic handling of common error scenarios (401 unauthorized, network issues)

### Retry Logic

- Automatic retry for transient failures
- Exponential backoff to prevent overwhelming the server
- Smart retry decisions based on error type (retries server errors but not client errors)

### Authentication Support

- Automatic token inclusion in requests
- Token storage in localStorage
- Handling of authentication failures

### React Query Integration

- Efficient data fetching with caching
- Automatic refetching of stale data
- Loading and error states
- Devtools for debugging (in development mode)

## Usage Examples

### Fetching Models

```tsx
// In a component
const { models, isLoading, isError, error } = useModels();

if (isLoading) return <LoadingSpinner />;
if (isError) return <ErrorMessage error={error} />;

return <ModelList models={models} />;
```

### Generating Speech

```tsx
// In a component
const { generateSpeech, isGenerating, progress, error } = useTTS();

const handleGenerate = async () => {
  try {
    const audioBlob = await generateSpeech({
      text: "Hello world",
      model: "en_US-model",
      speaker_id: "speaker1"
    });
    // Handle the audio blob
  } catch (err) {
    // Error already handled by the hook
  }
};
```

## Testing

The API integration is thoroughly tested:

- Unit tests for the API service
- Integration tests for the React Query hooks
- Mock implementations for testing components in isolation

## Error Codes

Common error codes and their meanings:

- `401`: Authentication required or token expired
- `403`: Permission denied
- `404`: Resource not found
- `429`: Rate limit exceeded (will automatically retry)
- `500`: Server error (will automatically retry)