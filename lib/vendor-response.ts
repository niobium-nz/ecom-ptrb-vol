export type VendorOperation =
  | "quote"
  | "order"
  | "track_order"
  | "subscribe"
  | "contact";

export type VendorFailureKind =
  | "network"
  | "protocol"
  | "http"
  | "invalid_json"
  | "invalid_body";

export class VendorResponseError extends Error {
  readonly operation: VendorOperation;
  readonly kind: VendorFailureKind;
  readonly status: number | null;
  readonly userMessage: string;
  readonly responseBody: unknown;

  constructor(options: {
    operation: VendorOperation;
    kind: VendorFailureKind;
    status?: number | null;
    userMessage: string;
    responseBody?: unknown;
  }) {
    super(options.userMessage);
    this.name = "VendorResponseError";
    this.operation = options.operation;
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.userMessage = options.userMessage;
    this.responseBody = options.responseBody;
  }
}

function operationMessage(operation: VendorOperation): string {
  switch (operation) {
    case "quote":
      return "We could not refresh the current price. Please try again.";
    case "order":
      return "We could not create your order. Please review your details and try again.";
    case "track_order":
      return "We could not retrieve tracking details. Please check the information and try again.";
    case "subscribe":
      return "We could not complete your subscription. Please try again.";
    case "contact":
      return "We could not send your message. Please try again.";
  }
}

export function vendorHttpUserMessage(
  operation: VendorOperation,
  status: number,
): string {
  if (status === 429) {
    return "Too many attempts were made. Please wait a moment and try again.";
  }

  if (status >= 500) {
    return "This service is temporarily unavailable. Please try again shortly.";
  }

  if (operation === "track_order" && [400, 404, 422].includes(status)) {
    return "We could not find an order matching those details. Please check them and try again.";
  }

  if ([400, 409, 422].includes(status)) {
    return operationMessage(operation);
  }

  if ([401, 403].includes(status)) {
    return "This service is temporarily unavailable. Please try again or contact support.";
  }

  return operationMessage(operation);
}

function isResponseLike(value: unknown): value is Response {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Response>;
  return (
    typeof candidate.ok === "boolean" &&
    typeof candidate.status === "number" &&
    typeof candidate.json === "function"
  );
}

export type VendorBodyValidator<T> = (body: unknown) => body is T;

export async function parseVendorJsonResponse<T>(
  response: Response,
  operation: VendorOperation,
  validateBody?: VendorBodyValidator<T>,
): Promise<T> {
  if (!isResponseLike(response)) {
    throw new VendorResponseError({
      operation,
      kind: "protocol",
      userMessage: "The service returned an unexpected response. Please try again.",
    });
  }

  const succeeded = response.ok && response.status >= 200 && response.status < 300;
  let body: unknown;
  try {
    // Read the body exactly once. A Response body cannot be consumed twice safely.
    body = await response.json();
  } catch {
    if (!succeeded) {
      throw new VendorResponseError({
        operation,
        kind: "http",
        status: response.status,
        userMessage: vendorHttpUserMessage(operation, response.status),
      });
    }
    throw new VendorResponseError({
      operation,
      kind: "invalid_json",
      status: response.status,
      userMessage: "The service returned an unreadable response. Please try again.",
    });
  }

  if (!succeeded) {
    throw new VendorResponseError({
      operation,
      kind: "http",
      status: response.status,
      userMessage: vendorHttpUserMessage(operation, response.status),
      responseBody: body,
    });
  }

  if (body === null || body === undefined) {
    throw new VendorResponseError({
      operation,
      kind: "protocol",
      status: response.status,
      userMessage: "The service returned an empty response. Please try again.",
    });
  }

  let bodyIsValid = true;
  if (validateBody) {
    try {
      bodyIsValid = validateBody(body);
    } catch {
      bodyIsValid = false;
    }
  }
  if (!bodyIsValid) {
    throw new VendorResponseError({
      operation,
      kind: "invalid_body",
      status: response.status,
      userMessage: "The service returned incomplete information. Please try again.",
      responseBody: body,
    });
  }

  return body as T;
}

export async function callVendorJson<T>(
  operation: VendorOperation,
  request: () => Promise<Response>,
  validateBody?: VendorBodyValidator<T>,
): Promise<T> {
  let response: Response;
  try {
    response = await request();
  } catch {
    throw new VendorResponseError({
      operation,
      kind: "network",
      userMessage: "We could not reach the service. Check your connection and try again.",
    });
  }

  return parseVendorJsonResponse(response, operation, validateBody);
}
