import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import nock from "nock";
import { createNagApiClient } from "../client";
import {
  postCommands,
  registerDevice,
  type CommandEnvelope,
} from "../operations";

const BASE_URL = "https://api.example.test";
const API_KEY = "test-api-key";

const makeClient = () =>
  createNagApiClient({ baseUrl: BASE_URL, apiKey: API_KEY });

const envelope: CommandEnvelope = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "CreateHabit",
  timestamp: "2024-05-01T10:00:00.000Z",
  payload: {
    habitId: "22222222-2222-4222-8222-222222222222",
    title: "Read",
  },
};

describe("operations", () => {
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
    it("returns ok with the server-assigned sequence on 200", async () => {
      nock(BASE_URL)
        .post("/commands")
        .reply(200, { accepted: true, sequence: 42 });

      const result = await postCommands(makeClient(), envelope);

      expect(result).toEqual({ ok: true, sequence: 42 });
    });

    it("classifies 400 as non-retriable", async () => {
      nock(BASE_URL)
        .post("/commands")
        .reply(400, { errors: ["envelope.id is required"] });

      const result = await postCommands(makeClient(), envelope);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.kind).toBe("non-retriable");
        if (result.kind === "non-retriable") {
          expect(result.status).toBe(400);
        }
      }
    });

    it.each([429, 408, 425])("classifies %s as transient", async (status) => {
      nock(BASE_URL).post("/commands").reply(status);

      const result = await postCommands(makeClient(), envelope);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("transient");
    });

    it("classifies 500 as transient", async () => {
      nock(BASE_URL).post("/commands").reply(500);

      const result = await postCommands(makeClient(), envelope);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("transient");
    });

    it("classifies a network failure as transient", async () => {
      nock(BASE_URL)
        .post("/commands")
        .replyWithError({ code: "ECONNREFUSED", message: "no connection" });

      const result = await postCommands(makeClient(), envelope);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("transient");
    });
  });

  describe("registerDevice", () => {
    const deviceId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

    it("returns ok with the server-issued accountId on 200", async () => {
      nock(BASE_URL)
        .post("/devices/register", (body) => {
          expect(body).toEqual({ deviceId });
          return true;
        })
        .reply(200, {
          accountId: "ffffffff-1111-4222-8333-444444444444",
          deviceId,
          registeredAt: "2026-04-25T10:00:00.000Z",
        });

      const result = await registerDevice(makeClient(), { deviceId });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.accountId).toBe("ffffffff-1111-4222-8333-444444444444");
        expect(result.registeredAt).toBeInstanceOf(Date);
        expect(result.registeredAt.toISOString()).toBe(
          "2026-04-25T10:00:00.000Z",
        );
      }
    });

    it("treats a 200 with missing fields as non-retriable", async () => {
      nock(BASE_URL).post("/devices/register").reply(200, { deviceId });

      const result = await registerDevice(makeClient(), { deviceId });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.kind).toBe("non-retriable");
      }
    });

    it("classifies 5xx as transient", async () => {
      nock(BASE_URL).post("/devices/register").reply(503);

      const result = await registerDevice(makeClient(), { deviceId });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("transient");
    });
  });
});
