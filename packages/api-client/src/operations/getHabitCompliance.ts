import { type ZodiosResponseByAlias } from "@zodios/core";
import type { NagApiClient } from "../client";
import { failureFromError, type Endpoints, type WrapperLog } from "./shared";

type GetHabitComplianceResponse = ZodiosResponseByAlias<
  Endpoints,
  "getHabitCompliance"
>;

export type GetHabitComplianceResult =
  | { ok: true; response: GetHabitComplianceResponse }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

/**
 * GETs `/habits/{habitId}/compliance` — the per-day compliance history
 * for the habit detail screen's "How am I doing" section. Unknown
 * habit ids return an empty doc at 200 (server convention), so a
 * successful response with empty `days` is "no data yet" rather than
 * "habit not found." Never throws on HTTP/network errors — caller
 * reads `result.ok`.
 */
export const getHabitCompliance = async (
  client: NagApiClient,
  habitId: string,
  log?: WrapperLog,
): Promise<GetHabitComplianceResult> => {
  log?.debug?.(`GET /habits/${habitId}/compliance`);
  const start = Date.now();
  try {
    const response: GetHabitComplianceResponse =
      await client.getHabitCompliance({ params: { habitId } });
    const elapsed = Date.now() - start;
    log?.debug?.(
      `GET /habits/${habitId}/compliance ok (${elapsed}ms) days=${response.days?.length ?? 0}`,
    );
    return { ok: true, response };
  } catch (error: unknown) {
    return failureFromError(
      `GET /habits/${habitId}/compliance`,
      log,
      Date.now() - start,
      error,
      () => undefined,
    );
  }
};
