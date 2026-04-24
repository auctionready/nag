import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import nock from "nock";
import { createNagApiClient } from "../client";

const BASE_URL = "https://api.example.test";
const API_KEY = "test-api-key";

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

const makeClient = () =>
  createNagApiClient({ baseUrl: BASE_URL, apiKey: API_KEY });

describe("nagApiClient", () => {
  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    if (!nock.isDone()) {
      const pending = nock.pendingMocks();
      nock.cleanAll();
      throw new Error(`unfulfilled nock interceptors: ${pending.join(", ")}`);
    }
  });

  afterAll(() => {
    nock.enableNetConnect();
    nock.restore();
  });

  describe("postCommands", () => {
    it("sends the envelope with bearer auth and JSON headers", async () => {
      const scope = nock(BASE_URL, {
        reqheaders: {
          authorization: `Bearer ${API_KEY}`,
          "content-type": /^application\/json/,
        },
      })
        .post("/commands", (body) => {
          expect(body).toEqual(envelope);
          return true;
        })
        .reply(200, { accepted: true, sequence: 7 });

      const result = await makeClient().postCommands(envelope);

      expect(result).toEqual({ accepted: true, sequence: 7 });
      expect(scope.isDone()).toBe(true);
    });

    it("rejects on 400", async () => {
      nock(BASE_URL)
        .post("/commands")
        .reply(400, { errors: ["envelope.id is required"] });

      await expect(makeClient().postCommands(envelope)).rejects.toThrow();
    });

    it("rejects on 401", async () => {
      nock(BASE_URL).post("/commands").reply(401);

      await expect(makeClient().postCommands(envelope)).rejects.toThrow();
    });
  });

  describe("getCommands", () => {
    it("builds a query string from since and limit", async () => {
      const scope = nock(BASE_URL)
        .get("/commands")
        .query({ since: "0", limit: "10" })
        .reply(200, { commands: [], nextSince: null });

      await makeClient().getCommands({ queries: { since: 0, limit: 10 } });

      expect(scope.isDone()).toBe(true);
    });

    it("omits optional params when not provided", async () => {
      const scope = nock(BASE_URL)
        .get("/commands")
        .query({ since: "42" })
        .reply(200, { commands: [], nextSince: null });

      await makeClient().getCommands({ queries: { since: 42 } });

      expect(scope.isDone()).toBe(true);
    });

    it("decodes ISO timestamps inside returned commands into Date instances", async () => {
      nock(BASE_URL)
        .get("/commands")
        .query({ since: "0" })
        .reply(200, { commands: [commandEnvelopeOut], nextSince: null });

      const page = await makeClient().getCommands({ queries: { since: 0 } });

      const first = page.commands![0]!;
      expect(first.timestamp).toBeInstanceOf(Date);
      expect((first.timestamp as Date).toISOString()).toBe(
        "2024-05-01T10:00:00.000Z",
      );
    });
  });

  describe("getHealth", () => {
    // /health returns 204 No Content; the generated response schema is
    // z.void(), so the backend must send no body.
    it("sends GET with bearer and handles a 204", async () => {
      const scope = nock(BASE_URL, {
        reqheaders: { authorization: `Bearer ${API_KEY}` },
      })
        .get("/health")
        .reply(204);

      await makeClient().getHealth();

      expect(scope.isDone()).toBe(true);
    });
  });

  describe("getHomeBoard", () => {
    it("decodes periodCheckIn timestamps into Date instances", async () => {
      const scope = nock(BASE_URL)
        .get("/home-board")
        .reply(200, {
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
        });

      const board = await makeClient().getHomeBoard();

      expect(scope.isDone()).toBe(true);
      const ts = board.habits![0]!.periodCheckIns![0]!.timestamp;
      expect(ts).toBeInstanceOf(Date);
      expect((ts as Date).toISOString()).toBe("2024-05-01T10:00:00.000Z");
    });
  });
});
