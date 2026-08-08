import { describe, expect, it, vi } from "vitest";
import offerMappings from "../../config/offer-options.json" with { type: "json" };
import {
  deriveOfferEnvironment,
  exportOfferEnvironment,
  mergeGeneratedEnvironment,
  renderGitHubEnvironment,
  toVendorCartItem,
} from "../../scripts/export-offer-env.mjs";
import {
  assertStaticOutput,
  buildDnsRecord,
  buildWranglerDeployCommand,
  cloudflareRequest,
  deployCloudflarePages,
  deploymentNames,
  dnsRecordMatches,
  readDeployConfiguration,
  validateAppName,
} from "../../scripts/deploy-cloudflare-pages.mjs";

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
  };
}

describe("offer environment export", () => {
  it("preserves mapping order and converts cart keys exactly", () => {
    const entries = deriveOfferEnvironment(offerMappings);
    expect(entries.map((entry) => entry.offerOptionKey)).toEqual(["1", "2", "3"]);
    expect(entries.map((entry) => entry.environmentKey)).toEqual([
      "OFFER_OPTION__1",
      "OFFER_OPTION__2",
      "OFFER_OPTION__3",
    ]);
    expect(entries[1].value).toBe(
      '[{"Listing":1,"Option":"Default","Quantity":2},{"Listing":2,"Option":"Default","Quantity":4}]',
    );
    expect(renderGitHubEnvironment(entries)).toContain(`OFFER_OPTION__3=${entries[2].value}\n`);
  });

  it("validates item and mapping contracts", () => {
    expect(toVendorCartItem({ listing: 1, option: "Default", quantity: 2 })).toEqual({
      Listing: 1,
      Option: "Default",
      Quantity: 2,
    });
    expect(() => toVendorCartItem(null)).toThrow("must be an object");
    expect(() => toVendorCartItem({ listing: 1, option: "Default", quantity: 1, extra: true })).toThrow("only");
    expect(() => toVendorCartItem({ listing: 0, option: "Default", quantity: 1 })).toThrow("listing");
    expect(() => toVendorCartItem({ listing: 1, option: "", quantity: 1 })).toThrow("option");
    expect(() => toVendorCartItem({ listing: 1, option: "Default", quantity: 0 })).toThrow("quantity");
    expect(() => deriveOfferEnvironment([])).toThrow("non-empty array");
    expect(() => deriveOfferEnvironment([{ ...offerMappings[0], offer_option_key: "0" }])).toThrow("positive decimal");
    expect(() => deriveOfferEnvironment([offerMappings[0], offerMappings[0]])).toThrow("duplicate");
  });

  it("updates only generated offer keys in the local environment", () => {
    const entries = deriveOfferEnvironment(offerMappings);
    const merged = mergeGeneratedEnvironment(
      "CUSTOM_SECRET=preserved\nOFFER_OPTION__2=old\nOFFER_OPTION__2=duplicate\n",
      entries,
    );
    expect(merged).toContain("CUSTOM_SECRET=preserved");
    expect(merged.match(/OFFER_OPTION__2=/g)).toHaveLength(1);
    expect(merged.indexOf("OFFER_OPTION__1=")).toBeLessThan(merged.indexOf("OFFER_OPTION__3="));
  });

  it("writes GitHub environment output through injected file operations", async () => {
    const appendFile = vi.fn().mockResolvedValue(undefined);
    const fileSystem = {
      readFile: vi.fn().mockResolvedValue(JSON.stringify(offerMappings)),
      appendFile,
      rename: vi.fn(),
      writeFile: vi.fn(),
    };
    const result = await exportOfferEnvironment({
      cwd: ".",
      environment: { GITHUB_ENV: "github-env" },
      fileSystem,
    });
    expect(result.target).toBe("github");
    expect(appendFile).toHaveBeenCalledOnce();
    expect(fileSystem.writeFile).not.toHaveBeenCalled();
  });
});

describe("Cloudflare Pages deployment", () => {
  const accountKey = ["CLOUDFLARE", "ACCOUNT", "ID"].join("_");
  const tokenKey = ["CLOUDFLARE", "API", "TOKEN"].join("_");
  const environment = {
    APP_NAME: "niobiumecomm-ptrb-vol-test",
    [accountKey]: "account-id",
    [tokenKey]: "api-token-value",
  };

  it("validates names and builds deterministic deployment values", () => {
    expect(validateAppName(environment.APP_NAME)).toBe(environment.APP_NAME);
    expect(() => validateAppName("Bad_Name")).toThrow("valid lowercase");
    expect(() => readDeployConfiguration({})).toThrow("APP_NAME");
    const names = deploymentNames(environment.APP_NAME);
    expect(names.customDomain).toBe("niobiumecomm-ptrb-vol-test.listings.niobium.co.nz");
    expect(names.pagesHostname).toBe("niobiumecomm-ptrb-vol-test.pages.dev");
    expect(buildWranglerDeployCommand(environment.APP_NAME, "linux")).toEqual({
      command: "npx",
      args: [
        "wrangler", "pages", "deploy", "out", "--project-name",
        environment.APP_NAME, "--branch", "main", "--commit-dirty=true",
      ],
    });
    expect(buildWranglerDeployCommand(environment.APP_NAME, "win32").command).toBe("npx.cmd");
  });

  it("builds and compares the expected proxied CNAME", () => {
    const desired = buildDnsRecord("shop.listings.niobium.co.nz", "shop.pages.dev");
    expect(desired).toEqual({
      type: "CNAME",
      name: "shop.listings.niobium.co.nz",
      content: "shop.pages.dev",
      ttl: 1,
      proxied: true,
    });
    expect(dnsRecordMatches({ ...desired, id: "record-id" }, desired)).toBe(true);
    expect(dnsRecordMatches({ ...desired, content: "old.pages.dev" }, desired)).toBe(false);
  });

  it("parses API responses exactly once and rejects unsafe response states", async () => {
    const success = jsonResponse(200, { success: true, result: { id: "value" } });
    await expect(cloudflareRequest({
      accountId: "account",
      apiToken: "token",
      path: "/test",
      fetchImpl: vi.fn().mockResolvedValue(success),
    })).resolves.toEqual({ id: "value" });
    expect(success.text).toHaveBeenCalledOnce();

    await expect(cloudflareRequest({
      accountId: "account",
      apiToken: "token",
      path: "/test",
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 500, text: vi.fn().mockResolvedValue("not json") }),
    })).rejects.toThrow("malformed JSON");
    await expect(cloudflareRequest({
      accountId: "account",
      apiToken: "token",
      path: "/test",
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse(403, { success: false, result: null })),
    })).rejects.toThrow("status 403");
  });

  it("requires an existing static output directory", async () => {
    await expect(assertStaticOutput(".", vi.fn().mockRejectedValue(new Error("missing")))).rejects.toThrow("out/ is missing");
    await expect(assertStaticOutput(".", vi.fn().mockResolvedValue({ isDirectory: () => false }))).rejects.toThrow("not a directory");
    await expect(assertStaticOutput(".", vi.fn().mockResolvedValue({ isDirectory: () => true }))).resolves.toMatch(/out$/);
  });

  it("provisions, deploys, creates DNS, and registers the custom domain with mocks", async () => {
    const responses = [
      jsonResponse(404, { success: false, result: null }),
      jsonResponse(200, { success: true, result: { name: environment.APP_NAME } }),
      jsonResponse(200, { success: true, result: [{ id: "zone-id", name: "niobium.co.nz" }] }),
      jsonResponse(200, { success: true, result: [] }),
      jsonResponse(200, { success: true, result: { id: "dns-id" } }),
      jsonResponse(200, { success: true, result: [] }),
      jsonResponse(200, { success: true, result: { name: `${environment.APP_NAME}.listings.niobium.co.nz` } }),
    ];
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(responses.shift()));
    const commandRunner = vi.fn().mockResolvedValue(undefined);
    const result = await deployCloudflarePages({
      cwd: ".",
      environment,
      fetchImpl,
      commandRunner,
      statImpl: vi.fn().mockResolvedValue({ isDirectory: () => true }),
    });
    expect(result).toEqual({
      appName: environment.APP_NAME,
      customDomain: `${environment.APP_NAME}.listings.niobium.co.nz`,
      projectCreated: true,
      dnsAction: "created",
      domainCreated: true,
    });
    expect(commandRunner).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledTimes(7);
    expect(JSON.stringify(result)).not.toContain(environment[tokenKey]);
    expect(JSON.stringify(commandRunner.mock.calls[0][1])).not.toContain(environment[tokenKey]);
  });
});
