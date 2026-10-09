import type { AppSettings } from '../types/voice';

let settings: AppSettings = {
  captureMode: 'auto',
  textDisplayMode: 'voiceOnly',
  textInputEnabled: false,
  conversationMode: 'teacher',
  voiceGender: 'female',
  character: 'friendly',
};

export function getAppSettings(): AppSettings {
  return { ...settings };
}

export function updateAppSettings(partial: Partial<AppSettings>): AppSettings {
  settings = {
    ...settings,
    ...partial,
  };

  return { ...settings };
}