import Sound, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  type AudioSet,
  type RecordBackType,
} from 'react-native-nitro-sound';

const audioSet: AudioSet = {
  AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
  AudioSourceAndroid: AudioSourceAndroidType.MIC,
  AudioSamplingRate: 16000,
  AudioEncodingBitRate: 64000,
  AudioChannels: 1,
};

const SPEECH_START_DB = -30;
const SILENCE_DB = -42;
const SILENCE_DURATION_MS = 1000;
const MIN_SPEECH_DURATION_MS = 300;
const MAX_UTTERANCE_MS = 15000;
const MAX_WAIT_FOR_SPEECH_MS = 12000;
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

function getMeteringValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

/**
 * Manual recording.
 * Starts recording and returns the output file path.
 */
export async function startRecording(): Promise<string> {
  if (recordingOperationActive || recordingActive) {
    throw new Error('Recording is already in progress.');
  }

  recordingOperationActive = true;

  try {
    Sound.removeRecordBackListener();

    console.log('[AudioService] Starting manual recorder...');

    const path = await Sound.startRecorder(
      undefined,
      audioSet,
      false,
    );

    if (!path) {
      throw new Error('Recorder did not return a file path.');
    }

    recordingActive = true;

    console.log('[AudioService] Manual recorder started:', path);

    return path;
  } catch (error) {
    recordingActive = false;
    Sound.removeRecordBackListener();

    const normalized = normalizeError(
      error,
      'Unable to start recording.',
    );

    console.error(
      '[AudioService] Manual recorder error:',
      normalized,
    );

    throw normalized;
  } finally {
    recordingOperationActive = false;
  }
}

/**
 * Automatic voice recording.
 *
 * Waits for speech, detects silence, stops the recorder,
 * and returns the recorded path.
 *
 * Returns null when no speech is detected or recording is aborted.
 */
export async function recordUntilSilence(
  signal?: AbortSignal,
): Promise<string | null> {
  if (recordingOperationActive || recordingActive) {
    throw new Error('Recording operation is already in progress.');
  }

  if (signal?.aborted) {
    return null;
  }

  recordingOperationActive = true;

  // Session token to track stale startRecorder promises and prevent race conditions
  const sessionToken = {};
  let currentSession: object | null = sessionToken;

  let finished = false;
  let recorderReady = false;
  let speechDetected = false;
  let speechStartedAt: number | null = null;
  let silenceStartedAt: number | null = null;
  let lastLoggedSecond = -1;

  let resolveRecording:
    | ((path: string | null) => void)
    | null = null;

  let rejectRecording:
    | ((error: Error) => void)
    | null = null;

  const recordingPromise = new Promise<string | null>(
    (resolve, reject) => {
      resolveRecording = resolve;
      rejectRecording = reject;
    },
  );

  const settle = (
    path: string | null,
    error?: Error,
  ): void => {
    const resolve = resolveRecording;
    const reject = rejectRecording;

    resolveRecording = null;
    rejectRecording = null;

    if (error) {
      reject?.(error);
    } else {
      resolve?.(path);
    }
  };

  const finish = async (
    shouldKeepRecording: boolean,
    error?: Error,
  ): Promise<void> => {
    if (finished) {
      return;
    }

    finished = true;
    currentSession = null; // Invalidate session
    Sound.removeRecordBackListener();

    let path = '';

    try {
      if (recordingActive || recorderReady) {
        console.log('[AudioService] Stopping auto recorder...');
        path = await Sound.stopRecorder();
      }
    } catch (stopError) {
      console.warn(
        '[AudioService] stopRecorder warning:',
        stopError,
      );

      if (!error && shouldKeepRecording) {
        error = normalizeError(
          stopError,
          'Unable to stop the recorder.',
        );
      }
    } finally {
      recordingActive = false;
      recordingOperationActive = false;
    }

    if (error) {
      settle(null, error);
      return;
    }

    if (
      !shouldKeepRecording ||
      !path ||
      path === 'recorder already stopped'
    ) {
      console.log('[AudioService] Recording discarded.');
      settle(null);
      return;
    }

    if (!speechDetected) {
      console.log('[AudioService] No speech detected.');
      settle(null);
      return;
    }

    console.log('[AudioService] Recording finished:', path);
    settle(path);
  };

  const onAbort = (): void => {
    console.log('[AudioService] Recording aborted.');
    void finish(false);
  };

  try {
    signal?.addEventListener('abort', onAbort, {
      once: true,
    });

    if (signal?.aborted) {
      await finish(false);
      return await recordingPromise;
    }

    Sound.removeRecordBackListener();
    Sound.setSubscriptionDuration(METERING_INTERVAL_MS);

    Sound.addRecordBackListener((event: RecordBackType) => {
      if (finished || !recorderReady) {
        return;
      }

      if (signal?.aborted) {
        void finish(false);
        return;
      }

      const position = Number(event.currentPosition ?? 0);
      const metering = getMeteringValue(event.currentMetering);

      if (!Number.isFinite(position) || position < 0) {
        return;
      }

      const elapsedSeconds = Math.floor(position / 1000);

      if (elapsedSeconds !== lastLoggedSecond) {
        lastLoggedSecond = elapsedSeconds;

        console.log('[AudioService] Auto recording:', {
          seconds: elapsedSeconds,
          metering,
          speechDetected,
        });
      }

      // Maximum recording duration check
      if (position >= MAX_UTTERANCE_MS) {
        if (speechDetected) {
          console.log('[AudioService] Maximum speech duration reached.');
          void finish(true);
        } else {
          console.log('[AudioService] Speech was not detected before timeout.');
          void finish(false);
        }

        return;
      }

      if (metering === null) {
        return;
      }

      // Wait until the user's voice crosses threshold
      if (!speechDetected) {
        if (metering >= SPEECH_START_DB) {
          speechDetected = true;
          speechStartedAt = position;
          silenceStartedAt = null;

          console.log(
            '[AudioService] >>> SPEECH DETECTED <<<',
            {
              metering,
              position,
            },
          );
        } else if (position >= MAX_WAIT_FOR_SPEECH_MS) {
          console.log('[AudioService] Speech detection timed out.');
          void finish(false);
        }

        return;
      }

      const speechDuration =
        position - (speechStartedAt ?? position);

      if (speechDuration < MIN_SPEECH_DURATION_MS) {
        if (metering <= SILENCE_DB) {
          silenceStartedAt ??= position;
        } else {
          silenceStartedAt = null;
        }

        return;
      }

      // Detect continuous silence after speech
      if (metering <= SILENCE_DB) {
        if (silenceStartedAt === null) {
          silenceStartedAt = position;
          return;
        }

        const silentFor = position - silenceStartedAt;

        if (silentFor >= SILENCE_DURATION_MS) {
          console.log(
            '[AudioService] Silence detected. Finishing recording.',
            { silentFor },
          );

          void finish(true);
        }

        return;
      }

      silenceStartedAt = null;
    });

    console.log('[AudioService] Starting auto recorder...');

    const path = await Sound.startRecorder(
      undefined,
      audioSet,
      true,
    );

    // RACE CONDITION FIX: If session was aborted/finished while startRecorder was pending
    if (currentSession !== sessionToken || signal?.aborted) {
      console.log('[AudioService] Stale startRecorder resolved after abort. Cleaning up.');
      try {
        Sound.removeRecordBackListener();
        await Sound.stopRecorder();
      } catch (cleanupError) {
        console.warn('[AudioService] Stale recorder cleanup warning:', cleanupError);
      } finally {
        if (currentSession === sessionToken) {
          recordingActive = false;
          recordingOperationActive = false;
        }
      }

      if (!finished) {
        await finish(false);
      }

      return await recordingPromise;
    }

    if (!path) {
      await finish(
        false,
        new Error('Recorder did not return a file path.'),
      );
      return await recordingPromise;
    }

    recordingActive = true;
    recorderReady = true;

    console.log('[AudioService] Auto recorder ready:', path);

    return await recordingPromise;
  } catch (error) {
    const normalized = normalizeError(
      error,
      'Unable to record audio.',
    );

    console.error(
      '[AudioService] Auto recorder error:',
      normalized,
    );

    await finish(false, normalized);

    return await recordingPromise;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    Sound.removeRecordBackListener();
    
    if (currentSession === sessionToken) {
      recordingOperationActive = false;
    }
  }
}

/**
 * Stops a manually started recording.
 */
export async function stopRecording(): Promise<string> {
  Sound.removeRecordBackListener();

  if (!recordingActive) {
    return '';
  }

  try {
    console.log('[AudioService] Stopping manual recorder...');

    const path = await Sound.stopRecorder();

    if (!path || path === 'recorder already stopped') {
      return '';
    }

    console.log('[AudioService] Manual recording stopped:', path);

    return path;
  } catch (error) {
    console.warn('[AudioService] Manual stop warning:', error);
    return '';
  } finally {
    recordingActive = false;
    recordingOperationActive = false;
    Sound.removeRecordBackListener();
  }
}

/**
 * Plays an audio file and waits for playback to finish.
 */
export async function playAudioAndWait(
  filePath: string,
): Promise<void> {
  if (!filePath) {
    throw new Error('AI audio file path is empty.');
  }

  await stopAudio();

  playbackActive = true;

  return new Promise<void>((resolve, reject) => {
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
      console.log('[AudioService] Playback completed.');
      settle();
    });

    void Sound.startPlayer(filePath).catch((error: unknown) => {
      settle(
        normalizeError(error, 'Unable to play AI audio.'),
      );
    });
  });
}

export async function playAudio(filePath: string): Promise<void> {
  await playAudioAndWait(filePath);
}

/**
 * Stops AI audio playback.
 */
export async function stopAudio(): Promise<void> {
  Sound.removePlaybackEndListener();

  if (playbackTimeout) {
    clearTimeout(playbackTimeout);
    playbackTimeout = null;
  }

  try {
    if (playbackActive) {
      await Sound.stopPlayer();
    }
  } catch {
    // The player may already be stopped.
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

/**
 * Cleans up recording and playback resources.
 */
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