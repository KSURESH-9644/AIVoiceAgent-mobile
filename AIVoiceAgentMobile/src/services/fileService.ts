import RNFS from 'react-native-fs';

export async function fileToBase64(filePath: string): Promise<string> {
  let normalizedPath = filePath;

  if (normalizedPath.startsWith('file://')) {
    normalizedPath = normalizedPath.substring(7);
  }

  const exists = await RNFS.exists(normalizedPath);
  if (!exists) {
    throw new Error(`Recording file does not exist: ${normalizedPath}`);
  }

  const base64 = await RNFS.readFile(normalizedPath, 'base64');
  if (!base64) {
    throw new Error('Recording file is empty.');
  }

  return base64;
}