// Model and Speaker types
export interface Speaker {
  id: string;
  name: string;
}

export interface Model {
  id: string;
  name: string;
  speakers: Speaker[];
  hasModelCard: boolean;
  hasDemo: boolean;
}

// TTS Request and Response types
export interface TTSRequest {
  text: string;
  model: string;
  speaker_id: string;
  output_format?: string;
}

export interface TTSResponse {
  audio_url: string;
  duration: number;
  format: string;
}

// History item type
export interface HistoryItem {
  id: string;
  text: string;
  model: string;
  speaker: string;
  timestamp: number;
  audioUrl: string;
}

// App state type
export interface AppState {
  text: string;
  selectedModel: string;
  selectedSpeaker: string;
  availableModels: Model[];
  audioBlob: Blob | null;
  isPlaying: boolean;
  isGenerating: boolean;
  history: HistoryItem[];
}