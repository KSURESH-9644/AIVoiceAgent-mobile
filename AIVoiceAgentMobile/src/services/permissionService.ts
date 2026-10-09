import { PermissionsAndroid, Platform } from 'react-native';

export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
  const alreadyGranted = await PermissionsAndroid.check(permission);

  if (alreadyGranted) {
    return true;
  }

  const result = await PermissionsAndroid.request(permission, {
    title: 'Microphone Permission',
    message: 'AI Voice Agent needs microphone access to listen to your voice.',
    buttonPositive: 'Allow',
    buttonNegative: 'Cancel',
    buttonNeutral: 'Ask Me Later',
  });

  return result === PermissionsAndroid.RESULTS.GRANTED;
}