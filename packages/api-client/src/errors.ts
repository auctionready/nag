export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export class ApiValidationError extends ApiError {
  readonly errors: readonly string[];

  constructor(body: { errors: readonly string[] }) {
    super(400, `Request rejected: ${body.errors.join("; ")}`, body);
    this.name = "ApiValidationError";
    this.errors = body.errors;
  }
}
