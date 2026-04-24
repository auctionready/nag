import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createNagApiClient } from "../client";

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

/** Axios's fetch adapter always calls `fetch(request)` with a Request. */
const firstRequest = (fetchMock: FetchMock): Request =>
  fetchMock.mock.calls[0]![0] as Request;

const envelope = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "CreateHabit" as const,
  timestamp: "2024-05-01T10:00:00.000Z",
  payload: {
    habitId: "22222222-2222-4222-8222-222222222222",
    title: "Read",
  },
};

const commandEnvelopeOut = {
  sequence: 1,
  id: "11111111-1111-4111-8111-111111111111",
  timestamp: "2024-05-01T10:00:00.000Z",
  type: "CreateHabit" as const,
  payload: {
    habitId: "22222222-2222-4222-8222-222222222222",
    title: "Read",
  },
};

describe("nagApiClient", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const makeClient = () =>
    createNagApiClient({
      baseUrl: "https://api.example.test",
      apiKey: "test-api-key",
    });

  describe("postCommands", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(
        jsonResponse({ accepted: true, sequence: 7 }),
      );
    });

    it("sends the envelope with bearer auth and JSON headers", async () => {
      const api = makeClient();
      const result = await api.postCommands(envelope);

      expect(fetchMock).toHaveBeenCalledOnce();
      const req = firstRequest(fetchMock);
      expect(req.url).toBe("https://api.example.test/commands");
      expect(req.method).toBe("POST");
      expect(req.headers.get("Authorization")).toBe("Bearer test-api-key");
      expect(req.headers.get("Content-Type")).toMatch(/^application\/json/);
      expect(JSON.parse(await req.text())).toEqual(envelope);
      expect(result).toEqual({ accepted: true, sequence: 7 });
    });

    it("rejects on 400", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ errors: ["envelope.id is required"] }, { status: 400 }),
      );
      const api = makeClient();

      await expect(api.postCommands(envelope)).rejects.toThrow();
    });

    it("rejects on 401", async () => {
      fetchMock.mockResolvedValue(new Response("", { status: 401 }));
      const api = makeClient();

      await expect(api.postCommands(envelope)).rejects.toThrow();
    });
  });

  describe("getCommands", () => {
    it("builds a query string from since and limit", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ commands: [], nextSince: null }),
      );
      const api = makeClient();
      await api.getCommands({ queries: { since: 0, limit: 10 } });

      const req = firstRequest(fetchMock);
      expect(req.url).toBe(
        "https://api.example.test/commands?since=0&limit=10",
      );
    });

    it("omits optional params when not provided", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ commands: [], nextSince: null }),
      );
      const api = makeClient();
      await api.getCommands({ queries: { since: 42 } });

      const req = firstRequest(fetchMock);
      expect(req.url).toBe("https://api.example.test/commands?since=42");
    });

    it("decodes ISO timestamps inside returned commands into Date instances", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ commands: [commandEnvelopeOut], nextSince: null }),
      );
      const api = makeClient();

      const page = await api.getCommands({ queries: { since: 0 } });

      const first = page.commands![0]!;
      expect(first.timestamp).toBeInstanceOf(Date);
      expect((first.timestamp as Date).toISOString()).toBe(
        "2024-05-01T10:00:00.000Z",
      );
    });
  });

  describe("getHealth", () => {
    // The OpenAPI doc declares no response body for /health; the generator's
    // sed pipeline rewrites z.void() → z.unknown() so zodios accepts the
    // real body ({status:"ok"}) without throwing.
    it("sends GET with bearer and returns the body as unknown", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ status: "ok" }));
      const api = makeClient();

      await api.getHealth();

      const req = firstRequest(fetchMock);
      expect(req.url).toBe("https://api.example.test/health");
      expect(req.method).toBe("GET");
      expect(req.headers.get("Authorization")).toBe("Bearer test-api-key");
    });
  });

  describe("getHomeBoard", () => {
    it("decodes periodCheckIn timestamps into Date instances", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          id: "00000000-0000-0000-0000-000000000000",
          lastSequence: 3,
          habits: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              title: "Read",
              schedules: [],
              periodCheckIns: [
                {
                  id: "44444444-4444-4444-8444-444444444444",
                  timestamp: "2024-05-01T10:00:00.000Z",
                  skipped: false,
                },
              ],
            },
          ],
        }),
      );
      const api = makeClient();

      const board = await api.getHomeBoard();

      expect(firstRequest(fetchMock).url).toBe(
        "https://api.example.test/home-board",
      );
      const ts = board.habits![0]!.periodCheckIns![0]!.timestamp;
      expect(ts).toBeInstanceOf(Date);
      expect((ts as Date).toISOString()).toBe("2024-05-01T10:00:00.000Z");
    });
  });
});
