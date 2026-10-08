import Sound, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  type AudioSet,
  type RecordBackType,
} from 'react-native-nitro-sound';

/*
 * ============================================================
 * RECORDING CONFIGURATION
 * ============================================================
 */

const audioSet: AudioSet = {
  AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
  AudioSourceAndroid: AudioSourceAndroidType.MIC,
  AudioSamplingRate: 16000,
  AudioEncodingBitRate: 64000,
  AudioChannels: 1,
};

const SPEECH_START_DB = -25;
const SILENCE_DB = -40; // Adjusted threshold slightly to catch low emulator inputs
const SILENCE_DURATION_MS = 900;
const MAX_UTTERANCE_MS = 15000;
const MAX_WAIT_FOR_SPEECH_MS = 20000;
const METERING_INTERVAL_MS = 100;
const MAX_PLAYBACK_WAIT_MS = 60000;

let recordingActive = false;
let recordingOperationActive = false;
let playbackActive = false;

let playbackResolve: (() => void) | null = null;
let playbackReject: ((error: Error) => void) | null = null;
let playbackTimeout: ReturnType<typeof setTimeout> | null = null;

function normalizeError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string' && error.trim()) {
    return new Error(error);
  }
  return new Error(fallback);
}

export async function startRecording(): Promise<string> {
  if (recordingOperationActive) {
    throw new Error('Recording operation is already in progress.');
  }
  if (recordingActive) {
    throw new Error('Recording is already active.');
  }

  recordingOperationActive = true;

  try {
    Sound.removeRecordBackListener();
    console.log('[AudioService] Starting manual recorder...');

    const path = await Sound.startRecorder(undefined, audioSet, false);

    if (!path) {
      throw new Error('Recorder did not return a file path.');
    }

    recordingActive = true;
    console.log('[AudioService] Manual recorder started:', path);
    return path;
  } catch (error) {
    recordingActive = false;
    Sound.removeRecordBackListener();
    const normalized = normalizeError(error, 'Unable to start recording.');
    console.error('[AudioService] Manual recorder error:', normalized);
    throw normalized;
  } finally {
    recordingOperationActive = false;
  }
}

export async function recordUntilSilence(
  signal?: AbortSignal,
): Promise<string | null> {
  if (recordingOperationActive) {
    throw new Error('Recording operation is already in progress.');
  }
  if (recordingActive) {
    throw new Error('Recording is already active.');
  }

  recordingOperationActive = true;

  let finished = false;
  let speechDetected = false;
  let silenceStartedAt: number | null = null;

  let resolveRecording: ((path: string | null) => void) | null = null;
  let rejectRecording: ((error: Error) => void) | null = null;

  const recordingPromise = new Promise<string | null>((resolve, reject) => {
    resolveRecording = resolve;
    rejectRecording = reject;
  });

  const finish = async (success: boolean, error?: Error): Promise<void> => {
    if (finished) {
      return;
    }
    finished = true;

    Sound.removeRecordBackListener();

    let path = '';
    try {
      if (recordingActive) {
        path = await Sound.stopRecorder();
      }
    } catch (stopError) {
      console.warn('[AudioService] stopRecorder warning:', stopError);
    }

    recordingActive = false;
    recordingOperationActive = false;

    if (error) {
      rejectRecording?.(error);
      resolveRecording = null;
      rejectRecording = null;
      return;
    }

    if (!success || !path || path === 'recorder already stopped') {
      resolveRecording?.(null);
      resolveRecording = null;
      rejectRecording = null;
      return;
    }

    if (!speechDetected) {
      console.log('[AudioService] No speech detected.');
      resolveRecording?.(null);
      resolveRecording = null;
      rejectRecording = null;
      return;
    }

    resolveRecording?.(path);
    resolveRecording = null;
    rejectRecording = null;
  };

  const onAbort = (): void => {
    void finish(false);
  };

  try {
    if (signal?.aborted) {
      await finish(false);
      return recordingPromise;
    }

    signal?.addEventListener('abort', onAbort, { once: true });

    Sound.removeRecordBackListener();
    Sound.setSubscriptionDuration(METERING_INTERVAL_MS);

    Sound.addRecordBackListener((event: RecordBackType) => {
      if (finished) {
        return;
      }
      if (signal?.aborted) {
        void finish(false);
        return;
      }

      const position = Number(event.currentPosition ?? 0);
      const metering = event.currentMetering;

      if (speechDetected && position >= MAX_UTTERANCE_MS) {
        void finish(true);
        return;
      }

      if (!speechDetected && position >= MAX_WAIT_FOR_SPEECH_MS) {
        void finish(true);
        return;
      }

      if (typeof metering !== 'number' || !Number.isFinite(metering)) {
        return;
      }

      if (!speechDetected) {
        if (metering >= SPEECH_START_DB) {
          speechDetected = true;
          silenceStartedAt = null;
          console.log('[AudioService] >>> SPEECH DETECTED <<<', metering);
        }
        return;
      }

      if (metering <= SILENCE_DB) {
        if (silenceStartedAt === null) {
          silenceStartedAt = Date.now();
          return;
        }

        const silentFor = Date.now() - silenceStartedAt;
        if (silentFor >= SILENCE_DURATION_MS) {
          void finish(true);
        }
        return;
      }

      silenceStartedAt = null;
    });

    const path = await Sound.startRecorder(undefined, audioSet, true);

    if (!path) {
      await finish(false, new Error('Recorder did not return a file path.'));
      return recordingPromise;
    }

    recordingActive = true;
    return await recordingPromise;
  } catch (error) {
    const normalized = normalizeError(error, 'Unable to record audio.');
    await finish(false, normalized);
    return recordingPromise;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    Sound.removeRecordBackListener();
    recordingOperationActive = false;
  }
}

export async function stopRecording(): Promise<string> {
  Sound.removeRecordBackListener();
  if (!recordingActive) {
    return '';
  }

  try {
    const path = await Sound.stopRecorder();
    return path === 'recorder already stopped' ? '' : path;
  } catch {
    return '';
  } finally {
    recordingActive = false;
    recordingOperationActive = false;
    Sound.removeRecordBackListener();
  }
}

export async function playAudioAndWait(filePath: string): Promise<void> {
  if (!filePath) {
    throw new Error('AI audio file path is empty.');
  }

  await stopAudio();
  playbackActive = true;

  return new Promise<void>(async (resolve, reject) => {
    let settled = false;

    const settle = (error?: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      Sound.removePlaybackEndListener();

      if (playbackTimeout) {
        clearTimeout(playbackTimeout);
        playbackTimeout = null;
      }

      playbackResolve = null;
      playbackReject = null;
      playbackActive = false;

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    playbackResolve = () => settle();
    playbackReject = (error: Error) => settle(error);

    playbackTimeout = setTimeout(() => {
      settle(new Error('AI audio playback timed out.'));
    }, MAX_PLAYBACK_WAIT_MS);

    Sound.addPlaybackEndListener(() => {
      settle();
    });

    try {
      await Sound.startPlayer(filePath);
    } catch (error) {
      settle(normalizeError(error, 'Unable to play AI audio.'));
    }
  });
}

export async function playAudio(filePath: string): Promise<void> {
  await playAudioAndWait(filePath);
}

export async function stopAudio(): Promise<void> {
  Sound.removePlaybackEndListener();
  if (playbackTimeout) {
    clearTimeout(playbackTimeout);
    playbackTimeout = null;
  }

  try {
    await Sound.stopPlayer();
  } catch {
    // Player may already be stopped.
  }

  playbackActive = false;
  const resolve = playbackResolve;
  playbackResolve = null;
  playbackReject = null;
  resolve?.();
}

export function isRecording(): boolean {
  return recordingActive;
}

export function isPlaying(): boolean {
  return playbackActive;
}

export function cleanupAudio(): void {
  Sound.removeRecordBackListener();
  Sound.removePlayBackListener();
  Sound.removePlaybackEndListener();

  if (playbackTimeout) {
    clearTimeout(playbackTimeout);
    playbackTimeout = null;
  }

  if (recordingActive) {
    void Sound.stopRecorder().catch(() => {});
  }
  if (playbackActive) {
    void Sound.stopPlayer().catch(() => {});
  }

  recordingActive = false;
  recordingOperationActive = false;
  playbackActive = false;

  const resolve = playbackResolve;
  playbackResolve = null;
  playbackReject = null;
  resolve?.();
}