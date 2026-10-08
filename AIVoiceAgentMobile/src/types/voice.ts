export type VoiceCaptureMode =
  | 'auto'
  | 'manual';

export type TextDisplayMode =
  | 'voiceOnly'
  | 'voiceAndText';

export type ConversationMode =
  | 'teacher'
  | 'friend';

export type VoiceGender =
  | 'male'
  | 'female';

export type Character =
  | 'friendly'
  | 'teacher'
  | 'calm'
  | 'energetic';

export interface AppSettings {
  captureMode: VoiceCaptureMode;
  textDisplayMode: TextDisplayMode;
  textInputEnabled: boolean;
  conversationMode: ConversationMode;
  voiceGender: VoiceGender;
  character: Character;
}

export interface ChatHistoryItem {
  role:
    | 'user'
    | 'assistant';

  content: string;
}

export interface VoiceChatResponse {
  success: boolean;

  userText: string;

  aiText: string;

  audioBase64: string;

  audioContentType: string;

  error?: string;
}