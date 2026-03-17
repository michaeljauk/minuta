export interface OllamaConfig {
  baseUrl: string;
  model: string;
}

export interface GenerateRequest {
  model: string;
  prompt: string;
  stream: false;
}

export interface GenerateResponse {
  model: string;
  response: string;
  done: boolean;
}

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

export interface ListModelsResponse {
  models: OllamaModel[];
}
