import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import RNFS from 'react-native-fs';
import { getAppSettings } from '../store/AppSettings';
import { getRuntimeModels } from '../store/ModelStore';
import { requestMicrophonePermission } from '../services/permissionService';
import { recordUntilSilence, startRecording, stopRecording, playAudioAndWait, stopAudio, cleanupAudio } from '../services/audioService';
import { fileToBase64 } from '../services/fileService';
import { sendVoiceChat } from '../services/api';
import type { AppSettings, ChatHistoryItem } from '../types/voice';

type AgentState = 'idle' | 'requestingPermission' | 'listening' | 'processing' | 'speaking' | 'stopped' | 'error';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}

const MAX_HISTORY_ITEMS = 8;

const AIVoiceScreen = () => {
  const [settings, setSettings] = useState<AppSettings>(getAppSettings());
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState<string>('');

  const runningRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const sessionAbortRef = useRef<AbortController | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const settingsRef = useRef<AppSettings>(getAppSettings());
  const historyRef = useRef<ChatHistoryItem[]>([]);
  const manualRecordingPathRef = useRef<string | null>(null);
  const stoppingRef = useRef<boolean>(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runningRef.current = false;
      sessionAbortRef.current?.abort();
      sessionAbortRef.current = null;
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;
      manualRecordingPathRef.current = null;
      cleanupAudio();
      void stopAudio();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const currentSettings = getAppSettings();
      settingsRef.current = currentSettings;
      if (mountedRef.current) {
        setSettings(currentSettings);
      }
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const safeSetState = useCallback((state: AgentState): void => {
    if (!mountedRef.current) return;
    setAgentState(state);
  }, []);

  const addMessage = useCallback((sender: 'user' | 'ai', text: string): void => {
    if (!mountedRef.current || !text.trim()) return;
    setMessages(previous => [
      ...previous,
      { id: `${Date.now()}-${Math.random()}`, sender, text: text.trim() },
    ]);
  }, []);

  const addHistory = useCallback((userText: string, aiText: string): void => {
    const updated: ChatHistoryItem[] = [
      ...historyRef.current,
      { role: 'user', content: userText },
      { role: 'assistant', content: aiText },
    ];
    historyRef.current = updated.slice(-MAX_HISTORY_ITEMS);
  }, []);

  const getModels = useCallback(() => {
    const catalog = getRuntimeModels();
    if (!catalog) {
      throw new Error('AI models are not loaded yet. Please wait a moment and try again.');
    }
    const sttModel = catalog.speechToText.find(model => model.id.toLowerCase().includes('whisper-large-v3-turbo'))?.id ?? catalog.speechToText[0]?.id;
    const chatModel = catalog.chat[0]?.id;
    const ttsModel = catalog.textToSpeech[0]?.id;

    if (!sttModel || !chatModel || !ttsModel) {
      throw new Error('Required AI models are not available. Please restart the app and try again.');
    }
    return { sttModel, chatModel, ttsModel };
  }, []);

  const processVoice = useCallback(async (recordingPath: string, currentSettings: AppSettings): Promise<void> => {
    if (!recordingPath) return;
    safeSetState('processing');
    const models = getModels();
    console.log('[AIVoiceScreen] Selected models:', models);

    const audioBase64 = await fileToBase64(recordingPath);
    if (!audioBase64) {
      throw new Error('Recorded audio is empty.');
    }

    const fileName = getFileName(recordingPath);
    console.log('[AIVoiceScreen] Sending audio:', fileName);

    const controller = new AbortController();
    requestAbortRef.current = controller;

    try {
      const result = await sendVoiceChat(
        audioBase64,
        fileName,
        currentSettings.conversationMode,
        currentSettings.voiceGender,
        currentSettings.character,
        models.sttModel,
        models.chatModel,
        models.ttsModel,
        historyRef.current,
        controller.signal
      );

      console.log('[AIVoiceScreen] Voice API response received.');
      if (!result.success) {
        throw new Error(result.error ?? 'Voice AI request failed.');
      }
      if (!runningRef.current) return;

      if (result.userText && currentSettings.textDisplayMode === 'voiceAndText') {
        addMessage('user', result.userText);
      }
      if (result.aiText && currentSettings.textDisplayMode === 'voiceAndText') {
        addMessage('ai', result.aiText);
      }
      if (result.userText && result.aiText) {
        addHistory(result.userText, result.aiText);
      }
      if (!result.audioBase64) {
        throw new Error('AI returned text but no voice audio.');
      }
      if (!runningRef.current) return;

      safeSetState('speaking');
      const audioFile = await writeBase64Audio(result.audioBase64);
      if (!runningRef.current) return;

      console.log('[AIVoiceScreen] Playing AI audio:', audioFile);
      await playAudioAndWait(audioFile);
      console.log('[AIVoiceScreen] AI audio completed.');
    } finally {
      if (requestAbortRef.current === controller) {
        requestAbortRef.current = null;
      }
    }
  }, [addHistory, addMessage, getModels, safeSetState]);

  const runAutoLoop = useCallback(async (): Promise<void> => {
    const sessionController = new AbortController();
    sessionAbortRef.current = sessionController;
    console.log('[AIVoiceScreen] AUTO LOOP STARTED');

    try {
      while (runningRef.current) {
        const currentSettings = settingsRef.current;
        safeSetState('listening');
        console.log('[AIVoiceScreen] Listening for speech...');

        const recordingPath = await recordUntilSilence(sessionController.signal);
        if (!runningRef.current) break;

        if (!recordingPath) {
          console.log('[AIVoiceScreen] No speech detected. Listening again...');
          continue;
        }

        console.log('[AIVoiceScreen] Recording completed:', recordingPath);
        await processVoice(recordingPath, currentSettings);
        if (!runningRef.current) break;
        await wait(250);
      }
    } catch (err) {
      if (!runningRef.current) return;
      if (err instanceof Error && (err.name === 'AbortError' || err.message.toLowerCase().includes('aborted'))) {
        return;
      }
      console.error('[AIVoiceScreen] AUTO LOOP ERROR:', err);
      safeSetState('error');
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Voice processing failed.');
      }
      runningRef.current = false;
      if (mountedRef.current) setIsRunning(false);
    } finally {
      if (sessionAbortRef.current === sessionController) {
        sessionAbortRef.current = null;
      }
      console.log('[AIVoiceScreen] AUTO LOOP FINISHED');
    }
  }, [processVoice, safeSetState]);

  const startAgent = async (): Promise<void> => {
    if (runningRef.current || stoppingRef.current) return;
    setError(null);
    safeSetState('requestingPermission');

    const permission = await requestMicrophonePermission();
    if (!permission) {
      safeSetState('error');
      setError('Microphone permission is required.');
      return;
    }

    runningRef.current = true;
    setIsRunning(true);
    historyRef.current = [];
    setMessages([]);
    manualRecordingPathRef.current = null;

    const currentSettings = settingsRef.current;
    console.log('[AIVoiceScreen] Starting agent:', {
      captureMode: currentSettings.captureMode,
      conversationMode: currentSettings.conversationMode,
      voiceGender: currentSettings.voiceGender,
      character: currentSettings.character,
    });

    if (currentSettings.captureMode === 'auto') {
      void runAutoLoop();
      return;
    }

    try {
      safeSetState('listening');
      console.log('[AIVoiceScreen] MANUAL recording started.');
      const path = await startRecording();
      if (!runningRef.current) {
        await stopRecording();
        return;
      }
      manualRecordingPathRef.current = path;
      console.log('[AIVoiceScreen] MANUAL recording path:', path);
    } catch (err) {
      console.error('[AIVoiceScreen] Manual start error:', err);
      runningRef.current = false;
      setIsRunning(false);
      safeSetState('error');
      setError(err instanceof Error ? err.message : 'Unable to start recording.');
    }
  };

  const stopAgent = async (): Promise<void> => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const currentSettings = settingsRef.current;
    console.log('[AIVoiceScreen] STOP pressed. Mode:', currentSettings.captureMode);

    if (currentSettings.captureMode === 'manual') {
      try {
        safeSetState('processing');
        const path = await stopRecording();
        manualRecordingPathRef.current = null;
        console.log('[AIVoiceScreen] Manual recording stopped:', path);

        if (path) {
          await processVoice(path, currentSettings);
        } else {
          console.log('[AIVoiceScreen] No manual recording path.');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('[AIVoiceScreen] Manual request aborted.');
        } else {
          console.error('[AIVoiceScreen] Manual processing error:', err);
          if (mountedRef.current) {
            setError(err instanceof Error ? err.message : 'Voice processing failed.');
            safeSetState('error');
          }
        }
      } finally {
        runningRef.current = false;
        if (mountedRef.current) setIsRunning(false);
        await stopAudio();
        if (mountedRef.current) safeSetState('stopped');
      }
      stoppingRef.current = false;
      return;
    }

    runningRef.current = false;
    if (mountedRef.current) setIsRunning(false);
    sessionAbortRef.current?.abort();
    sessionAbortRef.current = null;
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    await stopAudio();
    if (mountedRef.current) safeSetState('stopped');
    stoppingRef.current = false;
    console.log('[AIVoiceScreen] AUTO agent stopped.');
  };

  const sendText = async (): Promise<void> => {
    const text = textInput.trim();
    if (!text) return;
    setTextInput('');
    addMessage('user', text);
  };

  return (
    <View style={styles.container}>
      <View style={styles.glow} />
      <Text style={styles.title}>The mic is yours</Text>
      <Text style={styles.mode}>{settings.conversationMode === 'teacher' ? 'English Teacher' : 'Best Friend'}</Text>

      {settings.textDisplayMode === 'voiceAndText' ? (
        <View style={styles.messages}>
          {messages.map(message => (
            <View key={message.id} style={[styles.message, message.sender === 'user' ? styles.userMessage : styles.aiMessage]}>
              <Text style={styles.messageText}>{message.text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.voiceArea}>
        <View style={styles.circleOuter}>
          <View style={[styles.circle, agentState === 'listening' && styles.circleListening, agentState === 'speaking' && styles.circleSpeaking, agentState === 'processing' && styles.circleProcessing]}>
            <Text style={styles.mic}>
              {agentState === 'listening' ? '🎙' : agentState === 'speaking' ? '🔊' : agentState === 'processing' ? '✨' : '🎙'}
            </Text>
          </View>
        </View>
        <Text style={styles.status}>{getStatusText(agentState)}</Text>
      </View>

      {settings.textInputEnabled ? (
        <View style={styles.textInputRow}>
          <TextInput
            value={textInput}
            onChangeText={setTextInput}
            placeholder="Type something..."
            placeholderTextColor="#777D8D"
            style={styles.textInput}
            editable={!isRunning}
          />
          <TouchableOpacity style={styles.sendButton} onPress={() => void sendText()} disabled={!textInput.trim()}>
            <Text style={styles.sendText}>→</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.mainButton, isRunning && styles.stopButton]}
        onPress={() => {
          if (isRunning) {
            void stopAgent();
          } else {
            void startAgent();
          }
        }}
        disabled={agentState === 'requestingPermission' || stoppingRef.current}
      >
        {agentState === 'requestingPermission' ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.mainButtonText}>{isRunning ? 'Stop AI Voice' : 'Start AI Voice'}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

async function writeBase64Audio(base64: string): Promise<string> {
  if (!base64) {
    throw new Error('AI audio data is empty.');
  }
  const path = `${RNFS.CachesDirectoryPath}/ai-response-${Date.now()}.wav`;
  await RNFS.writeFile(path, base64, 'base64');
  return path;
}

function getFileName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || 'recording.m4a';
}

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

function getStatusText(state: AgentState): string {
  switch (state) {
    case 'requestingPermission': return 'Requesting microphone...';
    case 'listening': return 'Listening...';
    case 'processing': return 'Thinking...';
    case 'speaking': return 'AI is speaking...';
    case 'error': return 'Something went wrong';
    case 'stopped': return 'Stopped';
    case 'idle':
    default: return 'Ready to listen';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0E12', alignItems: 'center', paddingTop: 70, paddingHorizontal: 20 },
  glow: { position: 'absolute', width: 520, height: 520, borderRadius: 260, backgroundColor: '#172A78', opacity: 0.38, top: 90 },
  title: { color: '#F0F2FA', fontSize: 26, fontWeight: '400', zIndex: 1 },
  mode: { color: '#7F8CFF', fontSize: 13, marginTop: 8, zIndex: 1 },
  messages: { width: '100%', maxHeight: 220, marginTop: 20, zIndex: 2 },
  message: { maxWidth: '82%', borderRadius: 17, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  userMessage: { alignSelf: 'flex-end', backgroundColor: '#3156D8' },
  aiMessage: { alignSelf: 'flex-start', backgroundColor: '#20242E' },
  messageText: { color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  voiceArea: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  circleOuter: { width: 190, height: 190, borderRadius: 95, backgroundColor: '#172557', alignItems: 'center', justifyContent: 'center' },
  circle: { width: 135, height: 135, borderRadius: 68, backgroundColor: '#3156D8', alignItems: 'center', justifyContent: 'center' },
  circleListening: { transform: [{ scale: 1.12 }], backgroundColor: '#4165F0' },
  circleSpeaking: { backgroundColor: '#536EF0' },
  circleProcessing: { backgroundColor: '#445BC4' },
  mic: { fontSize: 42 },
  status: { color: '#B8BFCE', fontSize: 15, marginTop: 24 },
  textInputRow: { width: '100%', flexDirection: 'row', marginBottom: 15, zIndex: 3 },
  textInput: { flex: 1, height: 48, borderRadius: 24, backgroundColor: '#202126', color: '#FFFFFF', paddingHorizontal: 18 },
  sendButton: { width: 48, height: 48, borderRadius: 24, marginLeft: 8, backgroundColor: '#3156D8', alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#FFFFFF', fontSize: 24 },
  error: { color: '#FF7777', textAlign: 'center', fontSize: 12, marginBottom: 10, zIndex: 3 },
  mainButton: { width: '82%', height: 54, borderRadius: 28, backgroundColor: '#3156D8', alignItems: 'center', justifyContent: 'center', marginBottom: 20, zIndex: 3 },
  stopButton: { backgroundColor: '#9D3B4A' },
  mainButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default AIVoiceScreen;