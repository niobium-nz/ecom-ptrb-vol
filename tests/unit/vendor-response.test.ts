import { describe, expect, it, vi } from "vitest";

import {
  VendorResponseError,
  callVendorJson,
  parseVendorJsonResponse,
  vendorHttpUserMessage,
  type VendorOperation,
} from "@/lib/vendor-response";

const isQuoteBody = (body: unknown): body is { total: number } =>
  typeof body === "object" &&
  body !== null &&
  Number.isSafeInteger((body as { total?: unknown }).total);

describe("vendor response handling", () => {
  it("returns validated JSON only for a successful HTTP response and reads JSON once", async () => {
    const response = new Response(JSON.stringify({ total: 2495 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const jsonSpy = vi.spyOn(response, "json");

    const body = await parseVendorJsonResponse(response, "quote", isQuoteBody);

    expect(body).toEqual({ total: 2495 });
    expect(jsonSpy).toHaveBeenCalledTimes(1);
  });

  it("returns parsed JSON through callVendorJson when no body validator is needed", async () => {
    await expect(
      callVendorJson("subscribe", async () =>
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      ),
    ).resolves.toEqual({ success: true });
  });

  it.each([
    null,
    undefined,
    "not a response",
    {},
    { ok: true },
    { ok: true, status: 200 },
    { ok: "true", status: 200, json: async () => ({}) },
    { ok: true, status: "200", json: async () => ({}) },
    { ok: true, status: 200, json: "not a function" },
  ])("rejects a non-Response-like value %#", async (value) => {
    await expect(
      parseVendorJsonResponse(value as unknown as Response, "quote"),
    ).rejects.toMatchObject({ kind: "protocol", status: null });
  });

  it.each([400, 401, 403, 404, 409, 422, 429, 500])(
    "rejects HTTP status %s with a user-facing error",
    async (status) => {
      await expect(
        parseVendorJsonResponse(
          new Response(JSON.stringify({ internal: "do not display" }), {
            status,
            headers: { "content-type": "application/json" },
          }),
          "track_order",
        ),
      ).rejects.toMatchObject({
        name: "VendorResponseError",
        kind: "http",
        status,
      });
    },
  );

  it.each<[VendorOperation, number]>([
    ["quote", 418],
    ["order", 400],
    ["track_order", 404],
    ["subscribe", 409],
    ["contact", 422],
    ["contact", 401],
    ["contact", 403],
    ["quote", 429],
    ["quote", 500],
  ])("provides safe status copy for %s/%s", (operation, status) => {
    const message = vendorHttpUserMessage(operation, status);
    expect(message.length).toBeGreaterThan(10);
    expect(message).not.toMatch(/stack|endpoint|authorization|internal/i);
  });

  it("keeps an HTTP-status error user friendly even when its error body is not JSON", async () => {
    await expect(
      parseVendorJsonResponse(
        new Response("gateway failure", { status: 502 }),
        "quote",
      ),
    ).rejects.toMatchObject({ kind: "http", status: 502 });
  });

  it("rejects malformed JSON on a successful response", async () => {
    await expect(
      parseVendorJsonResponse(
        new Response("not json", { status: 200 }),
        "contact",
      ),
    ).rejects.toMatchObject({ kind: "invalid_json", status: 200 });
  });

  it.each([null, undefined])("rejects an empty parsed JSON body %s", async (body) => {
    const json = vi.fn().mockResolvedValue(body);
    const response = { ok: true, status: 200, json } as unknown as Response;

    await expect(
      parseVendorJsonResponse(response, "subscribe"),
    ).rejects.toMatchObject({ kind: "protocol", status: 200 });
    expect(json).toHaveBeenCalledTimes(1);
  });

  it("rejects a 2xx body that does not match the expected operation shape", async () => {
    await expect(
      parseVendorJsonResponse(
        new Response(JSON.stringify({ total: "2495" }), { status: 200 }),
        "quote",
        isQuoteBody,
      ),
    ).rejects.toMatchObject({ kind: "invalid_body", status: 200 });
  });

  it("converts a throwing body validator into the same safe invalid-body error", async () => {
    const throwingValidator = (
      body: unknown,
    ): body is { total: number } => {
      void body;
      throw new Error("validator implementation detail");
    };

    await expect(
      parseVendorJsonResponse(
        new Response(JSON.stringify({ total: 2495 }), { status: 200 }),
        "quote",
        throwingValidator,
      ),
    ).rejects.toMatchObject({ kind: "invalid_body", status: 200 });
  });

  it("converts a rejected fetch into a user-safe network error", async () => {
    await expect(
      callVendorJson("quote", async () => {
        throw new Error("offline endpoint detail");
      }),
    ).rejects.toMatchObject({
      name: "VendorResponseError",
      kind: "network",
      status: null,
      userMessage: expect.not.stringContaining("endpoint detail"),
    });
  });

  it("uses the dedicated error type", () => {
    const error = new VendorResponseError({
      operation: "contact",
      kind: "invalid_body",
      status: 200,
      userMessage: "Please try again.",
      responseBody: { internal: true },
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("VendorResponseError");
    expect(error.responseBody).toEqual({ internal: true });
  });
});
