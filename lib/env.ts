export function parsePositiveIntegerEnv(name: string, rawValue: unknown): number {
  if (typeof rawValue !== "string" || !/^[1-9]\d*$/.test(rawValue)) {
    throw new Error(`${name} must contain a positive integer in decimal form`);
  }

  const parsed = Number(rawValue);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a safe positive integer`);
  }

  return parsed;
}

export function readShippingOptionId(rawValue: unknown): number {
  return parsePositiveIntegerEnv("SHIPPING_OPTION_ID", rawValue);
}

export function readRequiredStringEnv(name: string, rawValue: unknown): string {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return rawValue.trim();
}

export function readIntegrationEndpoints(values: {
  STORE_INTEGRATION_ENDPOINT?: unknown;
  NOTIFICATION_INTEGRATION_ENDPOINT?: unknown;
}): {
  storeIntegrationEndpoint: string;
  notificationIntegrationEndpoint: string;
} {
  return {
    storeIntegrationEndpoint: readRequiredStringEnv(
      "STORE_INTEGRATION_ENDPOINT",
      values.STORE_INTEGRATION_ENDPOINT,
    ),
    notificationIntegrationEndpoint: readRequiredStringEnv(
      "NOTIFICATION_INTEGRATION_ENDPOINT",
      values.NOTIFICATION_INTEGRATION_ENDPOINT,
    ),
  };
}
