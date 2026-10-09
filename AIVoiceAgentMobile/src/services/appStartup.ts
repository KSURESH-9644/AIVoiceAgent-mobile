import { getAvailableModels } from './api';
import { setRuntimeModels } from '../store/ModelStore';

export async function initializeApp(): Promise<void> {
  const result = await getAvailableModels();

  if (!result.success) {
    throw new Error('Unable to load available AI models.');
  }

  setRuntimeModels(result.data);
}