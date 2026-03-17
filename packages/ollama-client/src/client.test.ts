import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OllamaClient } from "./client";

function makeFetch(response: Response) {
  return vi.fn().mockResolvedValue(response);
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Internal Server Error",
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("OllamaClient", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("constructor", () => {
    it("strips trailing slashes from baseUrl", () => {
      const client = new OllamaClient({ baseUrl: "http://localhost:11434//", model: "llama3" });
      // Access via generate to verify URL construction
      const mockFetch = makeFetch(jsonResponse({ response: "ok", model: "llama3", done: true }));
      globalThis.fetch = mockFetch;

      return client.generate("test").then(() => {
        const [url] = mockFetch.mock.calls[0] as [string, ...unknown[]];
        expect(url).toBe("http://localhost:11434/api/generate");
      });
    });
  });

  describe("generate", () => {
    it("sends a POST to /api/generate with model and prompt", async () => {
      const mockFetch = makeFetch(
        jsonResponse({ response: "result", model: "llama3", done: true }),
      );
      globalThis.fetch = mockFetch;

      const client = new OllamaClient({ baseUrl: "http://localhost:11434", model: "llama3" });
      await client.generate("hello");

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:11434/api/generate");
      expect(options.method).toBe("POST");

      const body = JSON.parse(options.body as string);
      expect(body.model).toBe("llama3");
      expect(body.prompt).toBe("hello");
      expect(body.stream).toBe(false);
    });

    it("returns the response text", async () => {
      globalThis.fetch = makeFetch(
        jsonResponse({ response: "Meeting went well.", model: "llama3", done: true }),
      );

      const client = new OllamaClient({ baseUrl: "http://localhost:11434", model: "llama3" });
      const result = await client.generate("summarize");
      expect(result).toBe("Meeting went well.");
    });

    it("throws on a non-ok response", async () => {
      globalThis.fetch = makeFetch(jsonResponse({}, false, 500));

      const client = new OllamaClient({ baseUrl: "http://localhost:11434", model: "llama3" });
      await expect(client.generate("hello")).rejects.toThrow("Ollama API error: 500");
    });
  });

  describe("listModels", () => {
    it("fetches /api/tags", async () => {
      const mockFetch = makeFetch(jsonResponse({ models: [] }));
      globalThis.fetch = mockFetch;

      const client = new OllamaClient({ baseUrl: "http://localhost:11434", model: "llama3" });
      await client.listModels();

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe("http://localhost:11434/api/tags");
    });

    it("returns the parsed model list", async () => {
      const models = [{ name: "llama3", size: 1000, digest: "abc", modified_at: "2024-01-01" }];
      globalThis.fetch = makeFetch(jsonResponse({ models }));

      const client = new OllamaClient({ baseUrl: "http://localhost:11434", model: "llama3" });
      const result = await client.listModels();
      expect(result.models).toEqual(models);
    });

    it("throws on a non-ok response", async () => {
      globalThis.fetch = makeFetch(jsonResponse({}, false, 503));

      const client = new OllamaClient({ baseUrl: "http://localhost:11434", model: "llama3" });
      await expect(client.listModels()).rejects.toThrow("Ollama API error: 503");
    });
  });

  describe("healthCheck", () => {
    it("returns true when the server responds ok", async () => {
      globalThis.fetch = makeFetch({ ok: true } as Response);

      const client = new OllamaClient({ baseUrl: "http://localhost:11434", model: "llama3" });
      expect(await client.healthCheck()).toBe(true);
    });

    it("returns false when the server responds with an error", async () => {
      globalThis.fetch = makeFetch({ ok: false } as Response);

      const client = new OllamaClient({ baseUrl: "http://localhost:11434", model: "llama3" });
      expect(await client.healthCheck()).toBe(false);
    });

    it("returns false when the request throws (server unreachable)", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      const client = new OllamaClient({ baseUrl: "http://localhost:11434", model: "llama3" });
      expect(await client.healthCheck()).toBe(false);
    });
  });
});
