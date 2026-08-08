import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  auditRenderedHtml,
  checkCustomerFacingCopy,
  routeForHtml,
} from "../../scripts/check-customer-facing-copy.mjs";
import {
  checkDependencyFreshness,
  compareVersions as compareFreshVersions,
  parseStableVersion,
} from "../../scripts/check-dependency-freshness.mjs";
import {
  checkDependencyHealth,
  parsePendingScripts,
  parseVersion,
} from "../../scripts/check-dependency-health.mjs";
import {
  generatePublicEnvironment,
  parseEnvFile,
  renderPublicEnvironmentModule,
  resolvePublicEnvironment,
} from "../../scripts/generate-public-env.mjs";

const temporaryDirectories = [];

async function temporaryProject() {
  const root = await mkdtemp(join(tmpdir(), "ptrb-local-script-"));
  temporaryDirectories.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

describe("check-customer-facing-copy.mjs", () => {
  it("audits operator copy and derives static routes", () => {
    expect(auditRenderedHtml("A focused guest checkout", "checkout.html")).toContain(
      "checkout.html contains owner-facing checkout phrase",
    );
    expect(auditRenderedHtml("Complete your order")).toEqual([]);
    expect(routeForHtml("/site/out", "/site/out/index.html")).toBe("/");
    expect(routeForHtml("/site/out", "/site/out/contact/index.html")).toBe("/contact");
  });

  it("fails clearly when the static output is absent", async () => {
    const root = await temporaryProject();
    await mkdir(join(root, "out"));
    await expect(checkCustomerFacingCopy({ outDir: join(root, "out"), projectDir: root })).rejects.toThrow(
      "No static HTML files",
    );
  });
});

describe("check-dependency-freshness.mjs", () => {
  it("parses and compares stable versions", () => {
    expect(parseStableVersion("1.2.3")).toMatchObject({ major: 1, minor: 2, patch: 3 });
    expect(compareFreshVersions(parseStableVersion("1.2.3"), parseStableVersion("1.2.4"))).toBe(-1);
    expect(() => parseStableVersion("1.2.3-beta.1")).toThrow("stable semantic version");
  });

  it("rejects projects without direct dependencies", async () => {
    const root = await temporaryProject();
    await writeFile(join(root, "package.json"), "{}\n");
    await writeFile(join(root, "package-lock.json"), '{"packages":{}}\n');
    await expect(checkDependencyFreshness({ cwd: root, exec: vi.fn() })).rejects.toThrow("no direct dependencies");
  });
});

describe("check-dependency-health.mjs", () => {
  it("parses versions and pending script output", () => {
    expect(parseVersion("v24.15.0")).toEqual([24, 15, 0]);
    expect(parsePendingScripts("No packages with unreviewed install scripts.")).toEqual([]);
    expect(parsePendingScripts('{"pending":["sharp@0.35.3"]}')).toEqual(["sharp@0.35.3"]);
  });

  it("rejects a missing Node engine before invoking package checks", async () => {
    const root = await temporaryProject();
    await writeFile(join(root, "package.json"), '{"allowScripts":{}}\n');
    await writeFile(join(root, "package-lock.json"), '{"packages":{}}\n');
    await expect(checkDependencyHealth({ cwd: root, runner: vi.fn() })).rejects.toThrow("engines.node is required");
  });
});

describe("generate-public-env.mjs", () => {
  it("parses dotenv syntax and renders a typed public module", () => {
    expect(parseEnvFile("# note\nAPP_NAME='sample'\nexport TARGET_COUNTRY=AU\n")).toEqual({
      APP_NAME: "sample",
      TARGET_COUNTRY: "AU",
    });
    expect(renderPublicEnvironmentModule({ APP_NAME: "sample" })).toContain('APP_NAME: "sample"');
  });

  it("resolves defaults and atomically generates the browser-safe module", async () => {
    const root = await temporaryProject();
    const values = await resolvePublicEnvironment({ cwd: root, environment: {} });
    expect(values.SHIPPING_OPTION_ID).toBe("1");
    const result = await generatePublicEnvironment({ cwd: root, environment: {} });
    expect(result.keys).toContain("APP_NAME");
    expect(await readFile(result.outputPath, "utf8")).toContain("rawPublicEnv");
  });
});
