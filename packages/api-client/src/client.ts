import { z } from "zod";
import { endpoints as defaultEndpoints } from "./endpoint-definition";
import { ApiError, ApiValidationError } from "./errors";

type ParamType = "Body" | "Query" | "Path";

interface EndpointParameter {
  readonly name: string;
  readonly type: ParamType;
  readonly schema: z.ZodType;
}

interface EndpointErrorSpec {
  readonly status: number;
  readonly schema: z.ZodType;
}

interface EndpointSpec {
  readonly method: string;
  readonly path: string;
  readonly alias: string;
  readonly parameters: readonly EndpointParameter[];
  readonly response: z.ZodType;
  readonly errors: readonly EndpointErrorSpec[];
}

type EndpointList = readonly EndpointSpec[];

type OptionalKeys<P extends readonly EndpointParameter[]> = {
  [K in keyof P]: P[K] extends { schema: infer S }
    ? S extends z.ZodOptional<z.ZodType>
      ? P[K]["name"]
      : never
    : never;
}[number];

type RequiredKeys<P extends readonly EndpointParameter[]> = Exclude<
  P[number]["name"],
  OptionalKeys<P>
>;

type InputOf<S> = S extends z.ZodType ? z.input<S> : never;
/**
 * For endpoints whose OpenAPI spec doesn't describe a response body, the
 * generator emits `z.void()`. In that case the server still returns data,
 * so we surface it as `unknown` (the caller can narrow) and at runtime we
 * pass the raw JSON through without validation.
 */
type OutputOf<S> = S extends z.ZodVoid
  ? unknown
  : S extends z.ZodType
    ? z.output<S>
    : never;

type SchemaFor<
  P extends readonly EndpointParameter[],
  N extends string,
> = Extract<P[number], { name: N }>["schema"];

type ArgsOf<E extends EndpointSpec> = E["parameters"] extends readonly []
  ? []
  : [
      {
        [K in RequiredKeys<E["parameters"]>]: InputOf<
          SchemaFor<E["parameters"], K>
        >;
      } & {
        [K in OptionalKeys<E["parameters"]>]?: InputOf<
          SchemaFor<E["parameters"], K>
        >;
      },
    ];

type MethodFor<E extends EndpointSpec> = (
  ...args: ArgsOf<E>
) => Promise<OutputOf<E["response"]>>;

export type NagApiClient<
  Endpoints extends EndpointList = typeof defaultEndpoints,
> = {
  [E in Endpoints[number] as E["alias"]]: MethodFor<E>;
};

export type ValidateMode = "none" | "request" | "response" | "both";

export interface NagApiClientOptions {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
  /** When to run zod `parse` on the wire payloads. Default `"response"`. */
  validate?: ValidateMode;
}

const validatesRequest = (m: ValidateMode) => m === "request" || m === "both";
const validatesResponse = (m: ValidateMode) => m === "response" || m === "both";

const joinUrl = (base: string, path: string) =>
  `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

const buildUrl = (
  base: string,
  endpoint: EndpointSpec,
  args: Record<string, unknown>,
): string => {
  let path = endpoint.path;
  const query = new URLSearchParams();
  for (const param of endpoint.parameters) {
    const value = args[param.name];
    if (param.type === "Path") {
      if (value === undefined)
        throw new TypeError(`Missing path parameter "${param.name}"`);
      path = path.replace(`:${param.name}`, encodeURIComponent(String(value)));
      path = path.replace(`{${param.name}}`, encodeURIComponent(String(value)));
    } else if (param.type === "Query" && value !== undefined) {
      query.append(param.name, String(value));
    }
  }
  const qs = query.toString();
  return qs ? `${joinUrl(base, path)}?${qs}` : joinUrl(base, path);
};

const resolveBody = (
  endpoint: EndpointSpec,
  args: Record<string, unknown>,
  validate: ValidateMode,
): string | undefined => {
  const bodyParam = endpoint.parameters.find((p) => p.type === "Body");
  if (!bodyParam) return undefined;
  const raw = args[bodyParam.name];
  if (raw === undefined) return undefined;
  const toSend = validatesRequest(validate) ? bodyParam.schema.parse(raw) : raw;
  return JSON.stringify(toSend);
};

const raiseFromErrorResponse = (
  endpoint: EndpointSpec,
  status: number,
  body: unknown,
): never => {
  const match = endpoint.errors.find((e) => e.status === status);
  const parsed = match ? match.schema.safeParse(body) : undefined;
  const payload = parsed?.success ? parsed.data : body;

  if (
    status === 400 &&
    payload &&
    typeof payload === "object" &&
    "errors" in payload &&
    Array.isArray((payload as { errors: unknown }).errors)
  ) {
    throw new ApiValidationError(payload as { errors: readonly string[] });
  }
  throw new ApiError(
    status,
    `${endpoint.method.toUpperCase()} ${endpoint.path} failed with ${status}`,
    payload,
  );
};

export const createNagApiClient = <
  E extends EndpointList = typeof defaultEndpoints,
>(
  opts: NagApiClientOptions,
  endpoints: E = defaultEndpoints as unknown as E,
): NagApiClient<E> => {
  const validate: ValidateMode = opts.validate ?? "response";
  const doFetch = opts.fetch ?? globalThis.fetch;

  const client: Record<string, (...args: unknown[]) => Promise<unknown>> = {};

  for (const endpoint of endpoints) {
    client[endpoint.alias] = async (...rawArgs: unknown[]) => {
      const args = (rawArgs[0] as Record<string, unknown> | undefined) ?? {};
      const url = buildUrl(opts.baseUrl, endpoint, args);
      const body = resolveBody(endpoint, args, validate);

      const headers: Record<string, string> = {
        Authorization: `Bearer ${opts.apiKey}`,
        Accept: "application/json",
      };
      if (body !== undefined) headers["Content-Type"] = "application/json";

      const res = await doFetch(url, {
        method: endpoint.method.toUpperCase(),
        headers,
        body,
      });

      const text = await res.text();
      const json: unknown = text.length ? JSON.parse(text) : undefined;

      if (!res.ok) {
        raiseFromErrorResponse(endpoint, res.status, json);
      }

      const shouldValidate =
        validatesResponse(validate) &&
        !(endpoint.response instanceof z.ZodVoid);
      return shouldValidate ? endpoint.response.parse(json) : json;
    };
  }

  return client as unknown as NagApiClient<E>;
};
