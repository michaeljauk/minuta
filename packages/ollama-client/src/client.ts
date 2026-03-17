import type {
  OllamaConfig,
  GenerateRequest,
  GenerateResponse,
  ListModelsResponse,
} from "./types";

export class OllamaClient {
  private baseUrl: string;
  private model: string;

  constructor(config: OllamaConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.model = config.model;
  }

  async generate(prompt: string): Promise<string> {
    const request: GenerateRequest = {
      model: this.model,
      prompt,
      stream: false,
    };

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as GenerateResponse;
    return data.response;
  }

  async listModels(): Promise<ListModelsResponse> {
    const response = await fetch(`${this.baseUrl}/api/tags`);

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}`
      );
    }

    return (await response.json()) as ListModelsResponse;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl);
      return response.ok;
    } catch {
      return false;
    }
  }
}
