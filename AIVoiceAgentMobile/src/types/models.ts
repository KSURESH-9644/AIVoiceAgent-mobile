export interface GroqModel {
  id: string;
  object: string;
  created: number;
  ownedBy: string;
  active: boolean;
  contextWindow: number;
}

export interface CategorizedModelCatalog {
  chat: GroqModel[];
  speechToText: GroqModel[];
  textToSpeech: GroqModel[];
}

export interface ModelApiResponse {
  success: boolean;
  data: CategorizedModelCatalog;
}