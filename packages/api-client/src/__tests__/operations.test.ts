import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import nock from "nock";
import { createNagApiClient } from "../client";
import {
  postEvents,
  registerDevice,
  upgradeAccount,
  type WriteEventEnvelope,
} from "../operations";

const BASE_URL = "https://api.example.test";
const API_KEY = "test-api-key";

const makeClient = () =>
  createNagApiClient({ baseUrl: BASE_URL, getToken: () => API_KEY });

const envelope: WriteEventEnvelope = {
  id: "11111111-1111-4111-8111-111111111111",
  timestamp: "2024-05-01T10:00:00.000Z",
  events: [
    {
      type: "HabitCreated",
      payload: {
        habitId: "22222222-2222-4222-8222-222222222222",
        title: "Read",
      },
    },
  ],
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

  describe("postEvents", () => {
    const responseBody = {
      id: "11111111-1111-4111-8111-111111111111",
      events: [
        {
          sequence: 42,
          id: "33333333-3333-4333-8333-333333333333",
          type: "HabitCreated",
          timestamp: "2024-05-01T10:00:00.000Z",
          payload: {
            habitId: "22222222-2222-4222-8222-222222222222",
            title: "Read",
          },
        },
      ],
    };

    it("returns ok with the appended events on 201", async () => {
      nock(BASE_URL).post("/events").reply(201, responseBody, {
        Location: "/events/by-envelope/11111111-1111-4111-8111-111111111111",
      });

      const result = await postEvents(makeClient(), envelope);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.sequence).toBe(42);
        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe("HabitCreated");
      }
    });

    it("returns the same events on a 200 duplicate replay", async () => {
      nock(BASE_URL).post("/events").reply(200, responseBody, {
        Location: "/events/by-envelope/11111111-1111-4111-8111-111111111111",
      });

      const result = await postEvents(makeClient(), envelope);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.sequence).toBe(42);
        expect(result.events).toHaveLength(1);
      }
    });

    it("returns sequence=0 and empty events for an empty envelope", async () => {
      nock(BASE_URL).post("/events").reply(201, {
        id: "11111111-1111-4111-8111-111111111111",
        events: [],
      });

      const result = await postEvents(makeClient(), envelope);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.sequence).toBe(0);
        expect(result.events).toEqual([]);
      }
    });

    it("classifies 400 as non-retriable", async () => {
      nock(BASE_URL)
        .post("/events")
        .reply(400, { errors: ["envelope.id is required"] });

      const result = await postEvents(makeClient(), envelope);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.kind).toBe("non-retriable");
        if (result.kind === "non-retriable") {
          expect(result.status).toBe(400);
        }
      }
    });

    it.each([429, 408, 425])("classifies %s as transient", async (status) => {
      nock(BASE_URL).post("/events").reply(status);

      const result = await postEvents(makeClient(), envelope);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("transient");
    });

    it("classifies 500 as transient", async () => {
      nock(BASE_URL).post("/events").reply(500);

      const result = await postEvents(makeClient(), envelope);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("transient");
    });

    it("classifies a network failure as transient", async () => {
      // delayConnection holds the response longer than axios's timeout, so
      // axios rejects with an AxiosError that has no `.response` — exactly
      // the shape the wrapper's network-error branch handles.
      nock(BASE_URL)
        .post("/events")
        .delayConnection(500)
        .reply(200, { accepted: true, sequence: 1 });

      const fastClient = createNagApiClient({
        baseUrl: BASE_URL,
        getToken: () => API_KEY,
        timeoutMs: 50,
      });

      const result = await postEvents(fastClient, envelope);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("transient");
    });
  });

  describe("registerDevice", () => {
    const deviceId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

    it("returns ok with the server-issued accountId and deviceToken on 200", async () => {
      nock(BASE_URL)
        .post("/devices/register", (body) => {
          expect(body).toEqual({ deviceId });
          return true;
        })
        .reply(200, {
          accountId: "ffffffff-1111-4222-8333-444444444444",
          deviceId,
          registeredAt: "2026-04-25T10:00:00.000Z",
          deviceToken: "device.tok",
        });

      const result = await registerDevice(makeClient(), { deviceId });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.accountId).toBe("ffffffff-1111-4222-8333-444444444444");
        expect(result.deviceToken).toBe("device.tok");
        expect(result.registeredAt).toBeInstanceOf(Date);
        expect(result.registeredAt.toISOString()).toBe(
          "2026-04-25T10:00:00.000Z",
        );
      }
    });

    it("treats a 200 with missing deviceToken as non-retriable", async () => {
      nock(BASE_URL).post("/devices/register").reply(200, {
        accountId: "ffffffff-1111-4222-8333-444444444444",
        deviceId,
        registeredAt: "2026-04-25T10:00:00.000Z",
      });

      const result = await registerDevice(makeClient(), { deviceId });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("non-retriable");
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

  describe("upgradeAccount", () => {
    const idpToken = "eyJ.fake.token";

    it("returns ok with the bound IdP subject on 201", async () => {
      nock(BASE_URL)
        .post("/accounts/me/identity", (body) => {
          expect(body).toEqual({ idpToken });
          return true;
        })
        .reply(
          201,
          {
            idpSubject: "user_abc",
            upgradedAt: "2026-04-25T10:00:00.000Z",
          },
          { Location: "/accounts/me/identity" },
        );

      const result = await upgradeAccount(makeClient(), { idpToken });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.idpSubject).toBe("user_abc");
        expect(result.upgradedAt).toBeInstanceOf(Date);
        expect(result.upgradedAt.toISOString()).toBe(
          "2026-04-25T10:00:00.000Z",
        );
      }
    });

    it("classifies 401 (invalid token) as non-retriable", async () => {
      nock(BASE_URL).post("/accounts/me/identity").reply(401);

      const result = await upgradeAccount(makeClient(), { idpToken });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.kind).toBe("non-retriable");
        if (result.kind === "non-retriable") {
          expect(result.status).toBe(401);
        }
      }
    });

    it("classifies 409 (identity collision) as non-retriable", async () => {
      nock(BASE_URL).post("/accounts/me/identity").reply(409);

      const result = await upgradeAccount(makeClient(), { idpToken });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.kind).toBe("non-retriable");
        if (result.kind === "non-retriable") {
          expect(result.status).toBe(409);
        }
      }
    });

    it("classifies 5xx as transient and retries up to 3 times total", async () => {
      // Server idempotency means a transient first attempt can be safely
      // retried — the wrapper does so up to twice before giving up. Each
      // attempt waits a backoff; fake timers skip the sleeps.
      vi.useFakeTimers({ shouldAdvanceTime: true });
      nock(BASE_URL).post("/accounts/me/identity").times(3).reply(503);

      const result = await upgradeAccount(makeClient(), { idpToken });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("transient");
      vi.useRealTimers();
    });

    it("retries a transient failure and succeeds on the second attempt", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      nock(BASE_URL).post("/accounts/me/identity").reply(503);
      nock(BASE_URL).post("/accounts/me/identity").reply(200, {
        idpSubject: "user_abc",
        upgradedAt: "2026-04-25T10:00:00.000Z",
      });

      const result = await upgradeAccount(makeClient(), { idpToken });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.idpSubject).toBe("user_abc");
      vi.useRealTimers();
    });

    it("treats a 200 with missing fields as non-retriable (no retry)", async () => {
      // A single interceptor — if the wrapper retried the call would fail
      // with an unfulfilled-mock at teardown.
      nock(BASE_URL)
        .post("/accounts/me/identity")
        .reply(200, { idpSubject: "user_abc" });

      const result = await upgradeAccount(makeClient(), { idpToken });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("non-retriable");
    });
  });
});
