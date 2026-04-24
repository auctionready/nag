import { describe, it, expect, beforeEach, vi } from "vitest";
import { createNagApiClient } from "../client";
import { ApiError, ApiValidationError } from "../errors";

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

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
  });

  const makeClient = (
    overrides: Partial<Parameters<typeof createNagApiClient>[0]> = {},
  ) =>
    createNagApiClient({
      baseUrl: "https://api.example.test",
      apiKey: "test-api-key",
      fetch: fetchMock,
      ...overrides,
    });

  describe("postCommands", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(
        jsonResponse({ accepted: true, sequence: 7 }),
      );
    });

    it("sends the envelope with bearer auth and JSON headers", async () => {
      const client = makeClient();
      const result = await client.postCommands({ body: envelope });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("https://api.example.test/commands");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer test-api-key",
        "Content-Type": "application/json",
      });
      expect(JSON.parse(init?.body as string)).toEqual(envelope);
      expect(result).toEqual({ accepted: true, sequence: 7 });
    });

    it("throws ApiValidationError on 400 with errors body", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ errors: ["envelope.id is required"] }, { status: 400 }),
      );
      const client = makeClient();

      await expect(
        client.postCommands({ body: envelope }),
      ).rejects.toBeInstanceOf(ApiValidationError);
    });

    it("throws ApiError on 401", async () => {
      fetchMock.mockResolvedValue(new Response("", { status: 401 }));
      const client = makeClient();

      const err = await client
        .postCommands({ body: envelope })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(401);
    });
  });

  describe("getCommands", () => {
    it("builds a query string from since and limit", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ commands: [], nextSince: null }),
      );
      const client = makeClient();
      await client.getCommands({ since: 0, limit: 10 });

      const [url] = fetchMock.mock.calls[0]!;
      expect(url).toBe("https://api.example.test/commands?since=0&limit=10");
    });

    it("omits optional params when not provided", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ commands: [], nextSince: null }),
      );
      const client = makeClient();
      await client.getCommands({ since: 42 });

      const [url] = fetchMock.mock.calls[0]!;
      expect(url).toBe("https://api.example.test/commands?since=42");
    });

    it("decodes ISO timestamps inside returned commands into Date instances", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ commands: [commandEnvelopeOut], nextSince: null }),
      );
      const client = makeClient();

      const page = await client.getCommands({ since: 0 });

      const first = page.commands![0]!;
      expect(first.timestamp).toBeInstanceOf(Date);
      expect((first.timestamp as Date).toISOString()).toBe(
        "2024-05-01T10:00:00.000Z",
      );
    });
  });

  describe("validate: none", () => {
    it("returns the raw JSON unchanged (timestamps stay as strings)", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ commands: [commandEnvelopeOut], nextSince: null }),
      );

      const client = makeClient({ validate: "none" });
      const page = (await client.getCommands({ since: 0 })) as {
        commands: { timestamp: unknown }[];
      };

      expect(page.commands[0]!.timestamp).toBe("2024-05-01T10:00:00.000Z");
    });
  });

  describe("void-response endpoints (getHealth, getHomeBoard)", () => {
    // The backend OpenAPI currently describes these with no response body,
    // so the generator emits `response: z.void()`. The client passes the
    // actual body through unchanged rather than failing runtime validation.
    it("getHealth: sends GET and returns the raw body", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ status: "ok" }));
      const client = makeClient();

      const result = await client.getHealth();

      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("https://api.example.test/health");
      expect(init?.method).toBe("GET");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer test-api-key",
      });
      expect(result).toEqual({ status: "ok" });
    });

    it("getHomeBoard: sends GET and returns the raw body", async () => {
      const board = {
        id: "00000000-0000-0000-0000-000000000000",
        lastSequence: 3,
        habits: [],
      };
      fetchMock.mockResolvedValue(jsonResponse(board));
      const client = makeClient();

      const result = await client.getHomeBoard();

      expect(fetchMock.mock.calls[0]![0]).toBe(
        "https://api.example.test/home-board",
      );
      expect(result).toEqual(board);
    });
  });
});
