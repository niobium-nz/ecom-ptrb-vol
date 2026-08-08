import { describe, expect, it } from "vitest";

import {
  parsePositiveIntegerEnv,
  readIntegrationEndpoints,
  readRequiredStringEnv,
  readShippingOptionId,
} from "@/lib/env";

describe("public environment parsing", () => {
  it("parses SHIPPING_OPTION_ID into a JavaScript number", () => {
    expect(readShippingOptionId("1")).toBe(1);
    expect(parsePositiveIntegerEnv("SHIPPING_OPTION_ID", "9007199254740991")).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([undefined, null, 1, "", " 1", "+1", "-1", "0", "1.0", "1e2", "9007199254740992"])(
    "rejects an invalid SHIPPING_OPTION_ID value %#",
    (value) => {
      expect(() => readShippingOptionId(value)).toThrow(/positive integer|safe positive integer/i);
    },
  );

  it("requires and trims public strings", () => {
    expect(readRequiredStringEnv("VALUE", " yes ")).toBe("yes");
    expect(() => readRequiredStringEnv("VALUE", " ")).toThrow(/non-empty/i);
    expect(() => readRequiredStringEnv("VALUE", 1)).toThrow(/non-empty/i);
  });

  it("reads the two distinct integration endpoints", () => {
    expect(readIntegrationEndpoints({
      STORE_INTEGRATION_ENDPOINT: " https://store.example.test ",
      NOTIFICATION_INTEGRATION_ENDPOINT: "https://notification.example.test",
    })).toEqual({
      storeIntegrationEndpoint: "https://store.example.test",
      notificationIntegrationEndpoint: "https://notification.example.test",
    });
  });
});
