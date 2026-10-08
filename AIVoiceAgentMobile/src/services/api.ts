import axios from 'axios';

import type {
  ModelApiResponse,
} from '../types/models';

import type {
  ChatHistoryItem,
  VoiceChatResponse,
} from '../types/voice';

// export const api = axios.create({
//   baseURL:
//     'http://10.0.2.2:5279/api',

//   timeout: 120000,
// });
export const api = axios.create({
  baseURL:
    'https://aivoiceagent-mobile.onrender.com/api',

  timeout: 120000,
});
export async function getAvailableModels():
  Promise<ModelApiResponse> {
  const response =
    await api.get<ModelApiResponse>(
      '/models',
    );

  return response.data;
}

interface VoiceChatPayload {
  audioBase64: string;
  fileName: string;

  mode: string;
  voiceGender: string;
  character: string;

  sttModel: string;
  chatModel: string;
  ttsModel: string;

  history: ChatHistoryItem[];

  language?: string;
}

export async function sendVoiceChat(
  audioBase64: string,
  fileName: string,
  mode: string,
  gender: string,
  character: string,
  sttModel: string,
  chatModel: string,
  ttsModel: string,
  history: ChatHistoryItem[],
  signal?: AbortSignal,
  language?: string,
): Promise<VoiceChatResponse> {
  const payload: VoiceChatPayload = {
    audioBase64,
    fileName,

    mode,
    voiceGender: gender,
    character,

    sttModel,
    chatModel,
    ttsModel,

    history,
  };

  if (language) {
    payload.language = language;
  }

  const response =
    await api.post<VoiceChatResponse>(
      '/voice/chat',
      payload,
      {
        signal,
      },
    );

  return response.data;
}