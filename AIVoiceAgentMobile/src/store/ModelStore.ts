import type { CategorizedModelCatalog } from '../types/models';

let runtimeModels: CategorizedModelCatalog | null = null;

export function setRuntimeModels(models: CategorizedModelCatalog): void {
  runtimeModels = models;
}

export function getRuntimeModels(): CategorizedModelCatalog | null {
  return runtimeModels;
}

export function clearRuntimeModels(): void {
  runtimeModels = null;
}