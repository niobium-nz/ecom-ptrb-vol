import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { isDirectExecution, runCli } from "../../scripts/cli.mjs";
import {
  auditRenderedHtml,
  checkCustomerFacingCopy,
  collectHtml,
  formatCustomerFacingCopyResult,
  initialTestimonialCount,
  routeForHtml,
} from "../../scripts/check-customer-facing-copy.mjs";
import {
  CARET_STABLE_SEMVER,
  STABLE_SEMVER,
  checkDependencyFreshness,
  collectDirectDependencies,
  compareVersions as compareFreshVersions,
  formatDependencyFreshnessResults,
  isCaretCompatible,
  parseNpmVersionOutput,
  parseStableVersion,
  queryLatestStable,
  queryLatestStableWithinRange,
  resolvedLockVersion,
  validateCaretStableRange,
} from "../../scripts/check-dependency-freshness.mjs";
import {
  assertHealthyCommand,
  checkDependencyHealth,
  compareVersions as compareHealthVersions,
  formatDependencyHealthResult,
  minimumEngineVersion,
  parsePendingScripts,
  parseVersion,
  runHealthCommand,
  validateAllowScripts,
} from "../../scripts/check-dependency-health.mjs";
import {
  checkProjectBoundaries,
  findAbsoluteLocalReferences,
  findEscapingRelativeReferences,
  formatProjectBoundaryResult,
  isInsideRoot,
  walkProjectFiles,
} from "../../scripts/check-project-boundaries.mjs";
import {
  DEPLOY_ONLY_ENV_KEYS,
  PUBLIC_ENV_DEFAULTS,
  formatPublicEnvironmentResult,
  generatePublicEnvironment,
  parseEnvFile,
  renderPublicEnvironmentModule,
  resolvePublicEnvironment,
} from "../../scripts/generate-public-env.mjs";
import {
  deriveOfferEnvironment,
  exportOfferEnvironment,
  formatOfferEnvironmentResult,
  mergeGeneratedEnvironment,
  renderGitHubEnvironment,
  toVendorCartItem,
} from "../../scripts/export-offer-env.mjs";
import {
  assertStaticOutput,
  buildDnsRecord,
  buildWranglerDeployCommand,
  cloudflareRequest,
  deploymentNames,
  dnsRecordMatches,
  ensureDnsRecord,
  ensurePagesDomain,
  ensurePagesProject,
  findAccountZone,
  formatDeploymentResult,
  readDeployConfiguration,
  requireDeployValue,
  runCommand,
  validateAppName,
} from "../../scripts/deploy-cloudflare-pages.mjs";
import {
  assertInsideProject,
  atomicWrite,
  calculateRasterDimensions,
  formatLogoManifest,
  generateLogoVariant,
  normalizeHexColor,
  prepareLogoAssets,
  resolveSourcePath,
  validateSvgSource,
} from "../../scripts/prepare-logo-assets.mjs";

const temporaryDirectories = [];

async function temporaryDirectory(label = "script-coverage-") {
  const root = await mkdtemp(join(tmpdir(), label));
  temporaryDirectories.push(root);
  return root;
}

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

describe("shared CLI execution", () => {
  it("detects direct execution and runs successful tasks", async () => {
    const moduleUrl = "file:///test-script.mjs";
    expect(isDirectExecution(moduleUrl, "/test-script.mjs")).toBe(true);
    expect(isDirectExecution(moduleUrl, "different.mjs")).toBe(false);

    const stdout = { write: vi.fn() };
    const result = await runCli({
      direct: true,
      task: vi.fn().mockResolvedValue({ value: 2 }),
      format: ({ value }) => `value=${value}\n`,
      stdout,
      stderr: { write: vi.fn() },
      processRef: {},
    });
    expect(result).toBe(true);
    expect(stdout.write).toHaveBeenCalledWith("value=2\n");
    await expect(runCli({ direct: false, task: vi.fn(), format: vi.fn() })).resolves.toBe(false);
  });

  it("reports Error and non-Error task failures", async () => {
    for (const failure of [new Error("broken"), "plain failure"]) {
      const stderr = { write: vi.fn() };
      const processRef = {};
      await runCli({
        direct: true,
        task: vi.fn().mockRejectedValue(failure),
        format: vi.fn(),
        stdout: { write: vi.fn() },
        stderr,
        processRef,
      });
      expect(stderr.write).toHaveBeenCalledWith(expect.stringContaining(String(failure instanceof Error ? failure.message : failure)));
      expect(processRef.exitCode).toBe(1);
    }
  });
});

async function writeCopyFixture(root, testimonialTotal = 10) {
  const out = join(root, "out");
  await mkdir(join(out, "contact"), { recursive: true });
  await mkdir(join(root, "config"), { recursive: true });
  await mkdir(join(root, "content", "policies"), { recursive: true });
  const testimonials = Array.from({ length: testimonialTotal }, (_, index) => ({ name: `Name ${index}`, text: `Text ${index}` }));
  await writeFile(join(root, "config", "testimonials.json"), JSON.stringify(testimonials));
  const policy = Buffer.from("binding policy\n");
  await writeFile(join(root, "content", "policies", "privacy.txt"), policy);
  await writeFile(join(root, "config", "legal-content-manifest.json"), JSON.stringify({
    privacy: {
      project_path: "content/policies/privacy.txt",
      sha256: createHash("sha256").update(policy).digest("hex"),
    },
  }));
  const initial = initialTestimonialCount(testimonialTotal);
  const testimonialCards = Array.from({ length: initial }, () => '<article data-testimonial="true"></article>').join("");
  const loadMore = testimonialTotal > initial ? '<button data-load-more-testimonials="true">Load more</button>' : "";
  await writeFile(join(out, "index.html"), `<main data-testimonials="true" data-testimonials-total="${testimonialTotal}">${testimonialCards}${loadMore}</main>`);
  await writeFile(join(out, "contact", "index.html"), '<a href="/" data-home-link="true">Home</a>');
  await writeFile(join(out, "asset.txt"), "ignored");
  return out;
}

describe("rendered customer copy audit", () => {
  it("covers testimonial thresholds, routes, forbidden phrases, and output formatting", () => {
    expect([0, 3, 7, 10].map(initialTestimonialCount)).toEqual([0, 3, 4, 6]);
    expect(routeForHtml("site/out", "site/out/index.html")).toBe("/");
    expect(routeForHtml("site/out", "site/out/contact/index.html")).toBe("/contact");
    expect(routeForHtml("site/out", "site/out/contact.html")).toBe("/contact");
    const forbidden = "— A focused guest checkout. Conversion-focused low-friction offer stack message matched purchase flow for website owner. Active coupon.";
    expect(auditRenderedHtml(forbidden, "page.html")).toHaveLength(8);
    expect(auditRenderedHtml("Complete your order", "page.html")).toEqual([]);
    expect(formatCustomerFacingCopyResult({ htmlFiles: 9, testimonialCount: 6, testimonialTotal: 10 })).toContain("9 HTML files with 6/10");
  });

  it("passes a nested static fixture and collects only HTML", async () => {
    const root = await temporaryDirectory();
    const out = await writeCopyFixture(root, 10);
    expect((await collectHtml(out)).map((file) => file.slice(out.length)).sort()).toEqual(["/contact/index.html", "/index.html"]);
    await expect(checkCustomerFacingCopy({ outDir: out, projectDir: root })).resolves.toEqual({
      htmlFiles: 2,
      testimonialCount: 6,
      testimonialTotal: 10,
    });
  });

  it("aggregates copy, navigation, coupon, testimonial, and legal defects", async () => {
    const root = await temporaryDirectory();
    const out = await writeCopyFixture(root, 7);
    await writeFile(join(out, "contact", "index.html"), '<p data-coupon-applied="true">Active coupon</p>');
    await writeFile(join(out, "index.html"), '<main data-testimonials-total="8"><article data-testimonial="true">— guest checkout</article></main>');
    await writeFile(join(root, "config", "testimonials.json"), "{}\n");
    await writeFile(join(root, "config", "legal-content-manifest.json"), JSON.stringify({
      invalid: null,
      mismatched: { project_path: "content/policies/privacy.txt", sha256: "wrong" },
    }));
    await expect(checkCustomerFacingCopy({ outDir: out, projectDir: root })).rejects.toThrow(/missing a visible project-local home link[\s\S]*applied-coupon marker[\s\S]*testimonial total[\s\S]*binding legal-content hash/);
  });

  it("requires load-more when configured testimonials exceed the initial set", async () => {
    const root = await temporaryDirectory();
    const out = await writeCopyFixture(root, 7);
    const cards = Array.from({ length: 4 }, () => '<article data-testimonial="true"></article>').join("");
    await writeFile(join(out, "index.html"), `<main data-testimonials="true" data-testimonials-total="7">${cards}</main>`);
    await expect(checkCustomerFacingCopy({ outDir: out, projectDir: root })).rejects.toThrow("missing the load-more testimonial control");
  });
});

describe("dependency freshness", () => {
  it("parses, compares, and validates every caret compatibility shape", () => {
    expect(STABLE_SEMVER.test("1.2.3+build.1")).toBe(true);
    expect(CARET_STABLE_SEMVER.test("^1.2.3")).toBe(true);
    expect(parseStableVersion(" 1.2.3+build ")).toEqual({ raw: "1.2.3+build", major: 1, minor: 2, patch: 3 });
    expect(() => parseStableVersion("1.2")).toThrow("stable semantic version");
    expect(compareFreshVersions(parseStableVersion("1.0.0"), parseStableVersion("2.0.0"))).toBe(-1);
    expect(compareFreshVersions(parseStableVersion("1.2.0"), parseStableVersion("1.1.9"))).toBe(1);
    expect(compareFreshVersions(parseStableVersion("1.2.3"), parseStableVersion("1.2.3"))).toBe(0);
    expect(validateCaretStableRange("pkg", "^1.2.3").raw).toBe("1.2.3");
    expect(() => validateCaretStableRange("pkg", "~1.2.3")).toThrow("stable caret range");

    expect(isCaretCompatible(parseStableVersion("1.1.9"), parseStableVersion("1.2.0"))).toBe(false);
    expect(isCaretCompatible(parseStableVersion("1.9.9"), parseStableVersion("1.2.0"))).toBe(true);
    expect(isCaretCompatible(parseStableVersion("2.0.0"), parseStableVersion("1.2.0"))).toBe(false);
    expect(isCaretCompatible(parseStableVersion("0.2.9"), parseStableVersion("0.2.1"))).toBe(true);
    expect(isCaretCompatible(parseStableVersion("0.3.0"), parseStableVersion("0.2.1"))).toBe(false);
    expect(isCaretCompatible(parseStableVersion("0.0.2"), parseStableVersion("0.0.2"))).toBe(true);
    expect(isCaretCompatible(parseStableVersion("0.0.3"), parseStableVersion("0.0.2"))).toBe(false);
  });

  it("collects direct dependencies and parses every npm output form", () => {
    expect([...collectDirectDependencies({ dependencies: { z: "^1.0.0" }, devDependencies: { a: "^2.0.0" } }).keys()]).toEqual(["a", "z"]);
    expect([...collectDirectDependencies({}).entries()]).toEqual([]);
    expect(parseNpmVersionOutput('["1.0.0-beta.1","1.2.0","1.1.0"]', "pkg").raw).toBe("1.2.0");
    expect(parseNpmVersionOutput("'2.0.0'", "pkg").raw).toBe("2.0.0");
    expect(() => parseNpmVersionOutput("[]", "pkg")).toThrow("no stable versions");
    expect(resolvedLockVersion({ packages: { "node_modules/pkg": { version: "1.2.3" } } }, "pkg").raw).toBe("1.2.3");
    expect(resolvedLockVersion({ dependencies: { pkg: { version: "1.2.4" } } }, "pkg").raw).toBe("1.2.4");
    expect(() => resolvedLockVersion({}, "pkg")).toThrow("no resolved version");
  });

  it("queries npm through an injected executor and rejects stderr", async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: '"1.2.3"\n', stderr: "" });
    await expect(queryLatestStable("pkg", { cwd: ".", exec })).resolves.toMatchObject({ raw: "1.2.3" });
    await expect(queryLatestStableWithinRange("pkg", "^1.0.0", { cwd: ".", exec })).resolves.toMatchObject({ raw: "1.2.3" });
    expect(exec.mock.calls[0][1]).toEqual(["view", "pkg", "dist-tags.latest", "--json"]);
    await expect(queryLatestStable("pkg", {
      cwd: ".",
      exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "warning" }),
    })).rejects.toThrow("emitted stderr");
    await queryLatestStable("pkg", { cwd: ".", exec, platform: "win32" });
    expect(exec).toHaveBeenLastCalledWith("npm.cmd", expect.any(Array), expect.any(Object));
  });

  it("passes current compatible dependencies and formats incompatible-latest notes", async () => {
    const root = await temporaryDirectory();
    await writeFile(join(root, "package.json"), JSON.stringify({ dependencies: { pkg: "^1.2.0" } }));
    await writeFile(join(root, "package-lock.json"), JSON.stringify({ packages: { "node_modules/pkg": { version: "1.2.4" } } }));
    const exec = vi.fn().mockImplementation((_command, args) => Promise.resolve({
      stdout: args[2] === "version" ? '["1.2.3","1.2.4"]' : '"2.0.0"',
      stderr: "",
    }));
    const result = await checkDependencyFreshness({ cwd: root, exec });
    expect(result).toHaveLength(1);
    expect(formatDependencyFreshnessResults(result)).toContain("newer incompatible release 2.0.0");
    expect(formatDependencyFreshnessResults([{ ...result[0], latestOverall: "1.2.4" }])).not.toContain("incompatible release");
  });

  it("aggregates range, lock, registry-range, stale-lock, and executor failures", async () => {
    const cases = [
      { range: "1.0.0", lock: "1.0.0", exec: vi.fn() },
      { range: "^1.0.0", lock: "2.0.0", exec: vi.fn() },
      { range: "^1.0.0", lock: "1.0.0", compatible: "2.0.0", overall: "2.0.0" },
      { range: "^1.0.0", lock: "1.0.0", compatible: "1.0.1", overall: "1.0.1" },
      { range: "^1.0.0", lock: "1.0.0", reject: "network" },
    ];
    for (const [index, item] of cases.entries()) {
      const root = await temporaryDirectory();
      await writeFile(join(root, "package.json"), JSON.stringify({ dependencies: { [`pkg${index}`]: item.range } }));
      await writeFile(join(root, "package-lock.json"), JSON.stringify({ packages: { [`node_modules/pkg${index}`]: { version: item.lock } } }));
      const exec = item.exec ?? vi.fn().mockImplementation((_command, args) => {
        if (item.reject) return Promise.reject(item.reject);
        return Promise.resolve({ stdout: JSON.stringify(args[2] === "version" ? item.compatible : item.overall), stderr: "" });
      });
      await expect(checkDependencyFreshness({ cwd: root, exec })).rejects.toThrow(`pkg${index}`);
    }
  });
});

describe("dependency health", () => {
  it("parses versions, compares components, and derives strict engine minima", () => {
    expect(parseVersion("v24.15.0-alpha")).toEqual([24, 15, 0]);
    expect(() => parseVersion("latest")).toThrow("Unsupported semantic version");
    expect(compareHealthVersions([1, 0, 0], [2, 0, 0])).toBe(-1);
    expect(compareHealthVersions([2, 1, 0], [2, 0, 9])).toBe(1);
    expect(compareHealthVersions([2, 1, 0], [2, 1, 0])).toBe(0);
    expect(minimumEngineVersion(">=20.0.0 || >=24.1.0")).toEqual([24, 1, 0]);
    expect(() => minimumEngineVersion("latest")).toThrow("Unsupported engines.node range");
  });

  it("validates every install-script decision path", () => {
    expect(() => validateAllowScripts({}, {})).toThrow("allowScripts object");
    expect(() => validateAllowScripts({ allowScripts: [] }, {})).toThrow("allowScripts object");
    expect(validateAllowScripts({ allowScripts: {} }, {})).toEqual([]);
    const lockfile = { packages: {
      "": {},
      "node_modules/no-script": { version: "1.0.0" },
      "node_modules/no-version": { hasInstallScript: true },
      local: { hasInstallScript: true, version: "1.0.0" },
      "node_modules/sharp": { name: "sharp", hasInstallScript: true, version: "1.0.0" },
      "node_modules/workerd": { hasInstallScript: true, version: "2.0.0" },
    } };
    expect(() => validateAllowScripts({ allowScripts: {} }, lockfile)).toThrow("no reviewed decision");
    expect(() => validateAllowScripts({ allowScripts: { "sharp@1.0.0": true, "workerd@2.0.0": false } }, lockfile)).toThrow("workerd install script");
    expect(validateAllowScripts({ allowScripts: { "sharp@1.0.0": true, "workerd@2.0.0": true } }, lockfile)).toEqual(["sharp@1.0.0", "workerd@2.0.0"]);
  });

  it("parses pending-script command output", () => {
    expect(parsePendingScripts(" ")).toEqual([]);
    expect(parsePendingScripts("No packages with unreviewed install scripts.")).toEqual([]);
    expect(parsePendingScripts('{"allowScripts":["a@1",""]}')).toEqual(["a@1"]);
    expect(parsePendingScripts('{"pending":{"b@1":true}}')).toEqual(["b@1"]);
    expect(parsePendingScripts('{"packages":["c@1"]}')).toEqual(["c@1"]);
    expect(parsePendingScripts('{"d@1":true}')).toEqual(["d@1"]);
    expect(parsePendingScripts("null")).toEqual([]);
    expect(() => parsePendingScripts("not json")).toThrow("valid JSON");
  });

  it("captures child output, launch errors, and exit codes", async () => {
    await expect(runHealthCommand(process.execPath, ["-e", "process.stdout.write('ok'); process.stderr.write('note')"])).resolves.toEqual({
      code: 0,
      stdout: "ok",
      stderr: "note",
    });
    await expect(runHealthCommand(process.execPath, ["-e", "process.exit(2)"], { cwd: process.cwd(), env: process.env })).resolves.toMatchObject({ code: 2 });
    await expect(runHealthCommand("command-that-does-not-exist-for-test", [])).rejects.toBeTruthy();
  });

  it("rejects unhealthy output and passes clean commands", () => {
    expect(() => assertHealthyCommand("clean", { code: 0, stdout: "ok", stderr: "" })).not.toThrow();
    expect(() => assertHealthyCommand("bad", { code: 1, stdout: "", stderr: "" })).toThrow("exit 1");
    expect(() => assertHealthyCommand("warn", { code: 0, stdout: "npm warn bad", stderr: "" })).toThrow("unhealthy output");
    expect(formatDependencyHealthResult({ reviewedScripts: 3 })).toContain("3 reviewed");
  });

  async function healthProject(engine = ">=1.0.0") {
    const root = await temporaryDirectory();
    await writeFile(join(root, "package.json"), JSON.stringify({ engines: { node: engine }, allowScripts: { "sharp@1.0.0": true } }));
    await writeFile(join(root, "package-lock.json"), JSON.stringify({ packages: { "node_modules/sharp": { hasInstallScript: true, version: "1.0.0" } } }));
    return root;
  }

  it("passes all three dependency commands", async () => {
    const root = await healthProject();
    const runner = vi.fn()
      .mockResolvedValueOnce({ code: 0, stdout: "clean", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "No packages with unreviewed install scripts.", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "tree", stderr: "" });
    await expect(checkDependencyHealth({ cwd: root, runner })).resolves.toEqual({ reviewedScripts: 1 });
    expect(runner).toHaveBeenCalledTimes(3);
    const windowsRunner = vi.fn()
      .mockResolvedValueOnce({ code: 0, stdout: "clean", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "[]", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "clean", stderr: "" });
    await checkDependencyHealth({ cwd: root, runner: windowsRunner, platform: "win32" });
    expect(windowsRunner).toHaveBeenCalledWith("npm.cmd", expect.any(Array), expect.any(Object));
  });

  it("rejects engine, pending command, pending entries, and unhealthy trees", async () => {
    await expect(checkDependencyHealth({ cwd: await healthProject(">=999.0.0"), runner: vi.fn() })).rejects.toThrow("does not satisfy");
    for (const pending of [
      { code: 1, stdout: "failed", stderr: "" },
      { code: 0, stdout: "[]", stderr: "unexpected" },
      { code: 0, stdout: '["sharp@1"]', stderr: "" },
    ]) {
      const runner = vi.fn()
        .mockResolvedValueOnce({ code: 0, stdout: "clean", stderr: "" })
        .mockResolvedValueOnce(pending);
      await expect(checkDependencyHealth({ cwd: await healthProject(), runner })).rejects.toThrow();
    }
    const treeRunner = vi.fn()
      .mockResolvedValueOnce({ code: 0, stdout: "clean", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "[]", stderr: "" })
      .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "bad" });
    await expect(checkDependencyHealth({ cwd: await healthProject(), runner: treeRunner })).rejects.toThrow("npm ls --all");
  });
});

describe("public environment generation", () => {
  it("parses dotenv variants and rejects invalid syntax", () => {
    expect(parseEnvFile("\n# comment\nexport APP_NAME='one'\nTARGET_COUNTRY=\"AU\"\nPLAIN=value\n")).toEqual({
      APP_NAME: "one",
      TARGET_COUNTRY: "AU",
      PLAIN: "value",
    });
    expect(() => parseEnvFile("INVALID")).toThrow("Invalid environment line");
    expect(() => parseEnvFile("bad=value")).toThrow("Invalid environment key");
    expect(renderPublicEnvironmentModule({ APP_NAME: "quoted\"value" })).toContain('APP_NAME: "quoted\\\"value"');
    expect(DEPLOY_ONLY_ENV_KEYS).toHaveLength(2);
    expect(PUBLIC_ENV_DEFAULTS.APP_NAME).toContain("ptrb-vol");
    expect(formatPublicEnvironmentResult({ keys: ["A", "B"] })).toContain("2 values");
  });

  it("applies file precedence, environment precedence, and defaults", async () => {
    const root = await temporaryDirectory();
    await writeFile(join(root, ".env"), "APP_NAME=from-env\nTARGET_COUNTRY=NZ\n");
    await writeFile(join(root, ".env.local"), "APP_NAME=from-local\n");
    await writeFile(join(root, ".env.generated"), "APP_NAME=from-generated\n");
    const result = await resolvePublicEnvironment({ cwd: root, environment: { APP_NAME: "from-process" } });
    expect(result.APP_NAME).toBe("from-process");
    expect(result.TARGET_COUNTRY).toBe("NZ");
    expect(result.SHIPPING_OPTION_ID).toBe("1");
  });

  it("rejects invalid values, unsafe shipping IDs, and non-missing read failures", async () => {
    const root = await temporaryDirectory();
    await expect(resolvePublicEnvironment({ cwd: root, environment: { APP_NAME: " " } })).rejects.toThrow("non-empty string");
    await expect(resolvePublicEnvironment({ cwd: root, environment: { SHIPPING_OPTION_ID: "0" } })).rejects.toThrow("positive integer");
    await expect(resolvePublicEnvironment({ cwd: root, environment: { SHIPPING_OPTION_ID: "999999999999999999999" } })).rejects.toThrow("safe positive integer");
    await mkdir(join(root, ".env"));
    await expect(resolvePublicEnvironment({ cwd: root, environment: {} })).rejects.toBeTruthy();
  });

  it("writes the generated TypeScript module", async () => {
    const root = await temporaryDirectory();
    const result = await generatePublicEnvironment({ cwd: root, environment: {} });
    expect(result.keys).toEqual(Object.keys(PUBLIC_ENV_DEFAULTS));
    expect(await readFile(result.outputPath, "utf8")).toBe(renderPublicEnvironmentModule(PUBLIC_ENV_DEFAULTS));
  });
});

const validMappings = [
  {
    source_offer_key: "first",
    offer_option_key: "2",
    option_configuration: [{ listing: 1, option: " Default ", quantity: 2 }],
  },
  {
    source_offer_key: "second",
    offer_option_key: "1",
    option_configuration: [{ listing: 2, option: "Default", quantity: 1 }],
  },
];

describe("offer environment export", () => {
  it("validates every cart-item and mapping condition", () => {
    expect(toVendorCartItem(validMappings[0].option_configuration[0])).toEqual({ Listing: 1, Option: " Default ", Quantity: 2 });
    for (const item of [null, [], "value"]) expect(() => toVendorCartItem(item)).toThrow("must be an object");
    expect(() => toVendorCartItem({ listing: 1, option: "Default" })).toThrow("contain only");
    expect(() => toVendorCartItem({ listing: 1, option: "Default", quantity: 1, extra: 1 })).toThrow("contain only");
    expect(() => toVendorCartItem({ listing: 1.2, option: "Default", quantity: 1 })).toThrow("listing");
    expect(() => toVendorCartItem({ listing: 0, option: "Default", quantity: 1 })).toThrow("listing");
    expect(() => toVendorCartItem({ listing: 1, option: 2, quantity: 1 })).toThrow("option");
    expect(() => toVendorCartItem({ listing: 1, option: " ", quantity: 1 })).toThrow("option");
    expect(() => toVendorCartItem({ listing: 1, option: "Default", quantity: 1.2 })).toThrow("quantity");
    expect(() => toVendorCartItem({ listing: 1, option: "Default", quantity: 0 })).toThrow("quantity");

    for (const mappings of [null, []]) expect(() => deriveOfferEnvironment(mappings)).toThrow("non-empty array");
    for (const mapping of [null, [], "value"]) expect(() => deriveOfferEnvironment([mapping])).toThrow("must be an object");
    expect(() => deriveOfferEnvironment([{ ...validMappings[0], source_offer_key: 2 }])).toThrow("source_offer_key");
    expect(() => deriveOfferEnvironment([{ ...validMappings[0], source_offer_key: " " }])).toThrow("source_offer_key");
    expect(() => deriveOfferEnvironment([{ ...validMappings[0], offer_option_key: 2 }])).toThrow("positive decimal string");
    expect(() => deriveOfferEnvironment([{ ...validMappings[0], offer_option_key: "0" }])).toThrow("positive decimal string");
    expect(() => deriveOfferEnvironment([validMappings[0], validMappings[0]])).toThrow("duplicate");
    expect(() => deriveOfferEnvironment([{ ...validMappings[0], option_configuration: null }])).toThrow("non-empty array");
    expect(() => deriveOfferEnvironment([{ ...validMappings[0], option_configuration: [] }])).toThrow("non-empty array");
  });

  it("preserves mapping order and renders environment formats", () => {
    const entries = deriveOfferEnvironment(validMappings);
    expect(entries.map((entry) => entry.offerOptionKey)).toEqual(["2", "1"]);
    expect(renderGitHubEnvironment(entries)).toBe(`OFFER_OPTION__2=${entries[0].value}\nOFFER_OPTION__1=${entries[1].value}\n`);
    expect(mergeGeneratedEnvironment("KEEP=yes\n\nOFFER_OPTION__2=old\nOFFER_OPTION__2=again\nOFFER_OPTION__9=untouched\n", entries)).toBe(
      `KEEP=yes\nOFFER_OPTION__2=${entries[0].value}\nOFFER_OPTION__9=untouched\nOFFER_OPTION__1=${entries[1].value}\n`,
    );
    expect(formatOfferEnvironmentResult({ entries, target: "target" })).toContain("Prepared OFFER_OPTION__2 for offer 2");
  });

  it("writes GitHub and local targets, including missing and existing local files", async () => {
    const entries = deriveOfferEnvironment(validMappings);
    const githubFs = {
      readFile: vi.fn().mockResolvedValue(JSON.stringify(validMappings)),
      appendFile: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn(),
      rename: vi.fn(),
    };
    await expect(exportOfferEnvironment({ cwd: ".", environment: { GITHUB_ENV: " output " }, fileSystem: githubFs })).resolves.toMatchObject({ target: "github" });
    expect(githubFs.appendFile).toHaveBeenCalledWith(" output ", renderGitHubEnvironment(entries), "utf8");

    for (const existing of [undefined, "KEEP=yes\n"]) {
      const localFs = {
        readFile: vi.fn()
          .mockResolvedValueOnce(JSON.stringify(validMappings))
          .mockImplementationOnce(() => existing === undefined
            ? Promise.reject(Object.assign(new Error("missing"), { code: "ENOENT" }))
            : Promise.resolve(existing)),
        appendFile: vi.fn(),
        writeFile: vi.fn().mockResolvedValue(undefined),
        rename: vi.fn().mockResolvedValue(undefined),
      };
      await expect(exportOfferEnvironment({ cwd: ".", environment: {}, fileSystem: localFs })).resolves.toMatchObject({ target: ".env.generated" });
      expect(localFs.writeFile).toHaveBeenCalledOnce();
      expect(localFs.rename).toHaveBeenCalledOnce();
    }
  });

  it("propagates non-missing local environment read failures", async () => {
    const fileSystem = {
      readFile: vi.fn().mockResolvedValueOnce(JSON.stringify(validMappings)).mockRejectedValueOnce(new Error("denied")),
      appendFile: vi.fn(),
      writeFile: vi.fn(),
      rename: vi.fn(),
    };
    await expect(exportOfferEnvironment({ cwd: ".", environment: {}, fileSystem })).rejects.toThrow("denied");
  });
});

function response(status, payload, overrides = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(typeof payload === "string" ? payload : JSON.stringify(payload)),
    ...overrides,
  };
}

const deployConfiguration = {
  appName: "niobiumecomm-ptrb-vol-test",
  accountId: "account",
  apiToken: "token",
};
const deployNames = deploymentNames(deployConfiguration.appName);

describe("Cloudflare deployment helpers", () => {
  it("validates required values, names, commands, DNS records, and summaries", () => {
    expect(requireDeployValue("VALUE", " value ")).toBe("value");
    expect(() => requireDeployValue("VALUE", null)).toThrow("required for deployment");
    expect(() => requireDeployValue("VALUE", " ")).toThrow("required for deployment");
    expect(validateAppName("valid-name")).toBe("valid-name");
    expect(() => validateAppName("invalid_name")).toThrow("valid lowercase");
    expect(() => validateAppName("a".repeat(64))).toThrow("valid lowercase");
    const accountKey = ["CLOUDFLARE", "ACCOUNT", "ID"].join("_");
    const tokenKey = ["CLOUDFLARE", "API", "TOKEN"].join("_");
    expect(readDeployConfiguration({ APP_NAME: deployConfiguration.appName, [accountKey]: " account ", [tokenKey]: " token " })).toEqual(deployConfiguration);
    expect(buildWranglerDeployCommand(deployConfiguration.appName, "linux").command).toBe("npx");
    expect(buildWranglerDeployCommand(deployConfiguration.appName, "win32").command).toBe("npx.cmd");
    const desired = buildDnsRecord(deployNames.customDomain, deployNames.pagesHostname);
    expect(dnsRecordMatches(desired, desired)).toBe(true);
    expect(dnsRecordMatches(null, desired)).toBe(false);
    expect(dnsRecordMatches({ ...desired, type: "A" }, desired)).toBe(false);
    expect(dnsRecordMatches({ ...desired, name: "wrong" }, desired)).toBe(false);
    expect(dnsRecordMatches({ ...desired, content: "wrong" }, desired)).toBe(false);
    expect(dnsRecordMatches({ ...desired, proxied: false }, desired)).toBe(false);
    expect(formatDeploymentResult({ appName: "app", customDomain: "domain", projectCreated: true, dnsAction: "created", domainCreated: true })).toContain("Cloudflare Pages project app deployed");
  });

  it("parses one response body and covers every unsafe response state", async () => {
    for (const invalid of [null, {}, { text: vi.fn(), status: "200" }]) {
      await expect(cloudflareRequest({ apiToken: "token", path: "/x", fetchImpl: vi.fn().mockResolvedValue(invalid) })).rejects.toThrow("invalid Response");
    }
    const notFound = response(404, { success: false });
    await expect(cloudflareRequest({ apiToken: "token", path: "/x", allowNotFound: true, fetchImpl: vi.fn().mockResolvedValue(notFound) })).resolves.toBeNull();
    expect(notFound.text).toHaveBeenCalledOnce();
    await expect(cloudflareRequest({ apiToken: "token", path: "/x", fetchImpl: vi.fn().mockResolvedValue(response(200, "")) })).rejects.toThrow("did not include a result");
    await expect(cloudflareRequest({ apiToken: "token", path: "/x", fetchImpl: vi.fn().mockResolvedValue(response(200, "{")) })).rejects.toThrow("malformed JSON");
    for (const bad of [
      response(500, { result: null }),
      response(100, { result: null }, { ok: true }),
      response(300, { result: null }, { ok: true }),
      response(200, { success: false, result: null }),
    ]) {
      await expect(cloudflareRequest({ apiToken: "token", path: "/x", fetchImpl: vi.fn().mockResolvedValue(bad) })).rejects.toThrow("request failed");
    }
    const fetchImpl = vi.fn().mockResolvedValue(response(200, { result: 0 }));
    await expect(cloudflareRequest({ apiToken: "token", path: "/x", method: "POST", body: { value: true }, fetchImpl })).resolves.toBe(0);
    expect(fetchImpl.mock.calls[0][1].body).toBe('{"value":true}');
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { result: "default-fetch" })));
    await expect(cloudflareRequest({ apiToken: "token", path: "/x" })).resolves.toBe("default-fetch");
  });

  it("keeps existing Pages projects and creates missing projects", async () => {
    await expect(ensurePagesProject(deployConfiguration, vi.fn().mockResolvedValue(response(200, { result: { name: "existing" } })))).resolves.toEqual({
      created: false,
      project: { name: "existing" },
    });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(404, { success: false }))
      .mockResolvedValueOnce(response(200, { result: { name: "created" } }));
    await expect(ensurePagesProject(deployConfiguration, fetchImpl)).resolves.toEqual({ created: true, project: { name: "created" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { result: { name: "default" } })));
    await expect(ensurePagesProject(deployConfiguration)).resolves.toMatchObject({ created: false });
  });

  it("finds the account zone and rejects all missing or malformed shapes", async () => {
    await expect(findAccountZone(deployConfiguration, vi.fn().mockResolvedValue(response(200, { result: [{ name: "niobium.co.nz", id: "zone" }] })))).resolves.toMatchObject({ id: "zone" });
    for (const result of [null, [], [null], [{ name: "different", id: "zone" }], [{ name: "niobium.co.nz", id: 2 }], [{ name: "niobium.co.nz", id: "" }]]) {
      await expect(findAccountZone(deployConfiguration, vi.fn().mockResolvedValue(response(200, { result })))).rejects.toThrow("was not found");
    }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { result: [{ name: "niobium.co.nz", id: "default-zone" }] })));
    await expect(findAccountZone(deployConfiguration)).resolves.toMatchObject({ id: "default-zone" });
  });

  it("leaves matching DNS, updates identified DNS, and creates every other DNS shape", async () => {
    const desired = buildDnsRecord(deployNames.customDomain, deployNames.pagesHostname);
    const scenarios = [
      { records: [{ ...desired, id: "same" }], expected: "unchanged", calls: 2 },
      { records: [{ ...desired, content: "old", id: "record" }], expected: "updated", calls: 3 },
      { records: [{ ...desired, content: "old", id: "" }], expected: "created", calls: 3 },
      { records: null, expected: "created", calls: 3 },
    ];
    for (const scenario of scenarios) {
      const responses = [
        response(200, { result: [{ name: "niobium.co.nz", id: "zone" }] }),
        response(200, { result: scenario.records }),
        response(200, { result: { id: "written" } }),
      ];
      const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(responses.shift()));
      await expect(ensureDnsRecord(deployConfiguration, deployNames, fetchImpl)).resolves.toMatchObject({ action: scenario.expected });
      expect(fetchImpl).toHaveBeenCalledTimes(scenario.calls);
    }
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response(200, { result: [{ name: "niobium.co.nz", id: "zone" }] }))
      .mockResolvedValueOnce(response(200, { result: [desired] })));
    await expect(ensureDnsRecord(deployConfiguration, deployNames)).resolves.toMatchObject({ action: "unchanged" });
  });

  it("keeps existing Pages domains and creates absent domains", async () => {
    for (const domains of [[{ name: deployNames.customDomain }], [{ name: "different" }], null]) {
      const fetchImpl = vi.fn()
        .mockResolvedValueOnce(response(200, { result: domains }))
        .mockResolvedValueOnce(response(200, { result: { name: deployNames.customDomain } }));
      const result = await ensurePagesDomain(deployConfiguration, deployNames, fetchImpl);
      expect(result.created).toBe(domains?.[0]?.name !== deployNames.customDomain);
    }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { result: [{ name: deployNames.customDomain }] })));
    await expect(ensurePagesDomain(deployConfiguration, deployNames)).resolves.toMatchObject({ created: false });
  });

  it("runs deployment commands and reports process failures", async () => {
    await expect(runCommand(process.execPath, ["-e", ""], { cwd: process.cwd(), environment: process.env })).resolves.toBeUndefined();
    await expect(runCommand(process.execPath, ["-e", "process.exit(3)"])).rejects.toThrow("exit code 3");
    await expect(runCommand("command-that-does-not-exist-for-deploy-test", [])).rejects.toBeTruthy();
  });

  it("uses the real stat implementation for a temporary static output", async () => {
    const root = await temporaryDirectory();
    await mkdir(join(root, "out"));
    await expect(assertStaticOutput(root)).resolves.toBe(join(root, "out"));
  });
});

async function writeLogoProject(root, brand) {
  await mkdir(join(root, "config"), { recursive: true });
  await mkdir(join(root, "source-assets"), { recursive: true });
  await writeFile(join(root, "config", "site-input-summary.json"), JSON.stringify({ brand_system: brand }));
}

describe("logo script residual branches", () => {
  it("covers internal resource links, style blocks, malformed tags, and all viewBox failures", () => {
    expect(() => normalizeHexColor(null)).toThrow("hexadecimal color");
    const inspected = validateSvgSource('<svg viewBox="0 0 2 1"><style>.mark { fill: #000; stroke: white; }</style><defs><path id="mark"/></defs><use href="#mark" clip-path="url(#clip)"/></svg>');
    expect(inspected).toMatchObject({ black: 1, white: 1 });
    expect(validateSvgSource('<svg viewBox="0 0 1 1"><path').defaultBlack).toBe(1);
    expect(() => validateSvgSource('<svg viewBox="0 0 1e999 1"><path/></svg>')).toThrow("positive finite");
    expect(() => validateSvgSource('<svg viewBox="0 0 1 0"><path/></svg>')).toThrow("positive finite");
    expect(() => calculateRasterDimensions([0, 0, 1, 1], { maxCssWidth: 0 })).toThrow("maxCssWidth");
    expect(() => calculateRasterDimensions([0, 0, 1, 1], { maxCssHeight: 0 })).toThrow("maxCssHeight");
  });

  it("cleans a temporary file after atomic write failure", async () => {
    const root = await temporaryDirectory();
    await expect(atomicWrite(join(root, "missing", "file.txt"), "data")).rejects.toBeTruthy();
  });

  it("rejects every unexpected raster metadata dimension", async () => {
    function mismatchedSharp(info) {
      return () => ({
        resize() { return this; },
        ensureAlpha() { return this; },
        raw() { return this; },
        toBuffer: vi.fn().mockResolvedValue({ data: Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 255]), info }),
      });
    }
    const root = await temporaryDirectory();
    for (const info of [
      { width: 3, height: 2, channels: 4 },
      { width: 4, height: 3, channels: 4 },
      { width: 4, height: 2, channels: 3 },
    ]) {
      await expect(generateLogoVariant({
        sharp: mismatchedSharp(info),
        svgBuffer: Buffer.from("svg"),
        dimensions: { width: 4, height: 2 },
        outputPath: join(root, "output.png"),
        themeColor: "#000",
      })).rejects.toThrow("Unexpected raster output");
    }
  });

  it("validates project-contained SVG source paths", async () => {
    const root = await temporaryDirectory();
    expect(resolveSourcePath(root, "source-assets/logo.svg")).toBe(join(root, "source-assets", "logo.svg"));
    expect(() => resolveSourcePath(root, "https://example.test/logo.svg")).toThrow("project-relative");
    const windowsAbsolute = ["C:", "logo.svg"].join(String.fromCharCode(92));
    expect(() => resolveSourcePath(root, windowsAbsolute)).toThrow("project-relative");
    expect(() => resolveSourcePath(root, join(root, "logo.svg"))).toThrow("project-relative");
    expect(() => resolveSourcePath(root, "../logo.svg")).toThrow("remain inside");
    expect(() => assertInsideProject(root, dirname(root), "candidate")).toThrow("remain inside");
    expect(() => assertInsideProject(root, root, "candidate")).not.toThrow();
  });

  it("supports legacy brand config and rejects missing brand and colors", async () => {
    const root = await temporaryDirectory();
    await mkdir(join(root, "config"), { recursive: true });
    await writeFile(join(root, "config", "legacy.json"), JSON.stringify({ brand: { logo_file: "source-assets/logo.png" } }));
    await expect(prepareLogoAssets({ projectRoot: root, configFile: "config/legacy.json" })).resolves.toMatchObject({ skipped: true });
    await writeFile(join(root, "config", "missing.json"), "{}\n");
    await expect(prepareLogoAssets({ projectRoot: root, configFile: "config/missing.json" })).rejects.toThrow("logo_file is required");

    for (const brand of [
      { logo_file: "source-assets/logo.svg", logo_inverse_color: "#fff" },
      { logo_file: "source-assets/logo.svg", primary_color: "#000" },
    ]) {
      const fixture = await temporaryDirectory();
      await writeLogoProject(fixture, brand);
      await writeFile(join(fixture, "source-assets", "logo.svg"), '<svg viewBox="0 0 2 1"><rect fill="white" width="2" height="1"/><path d="M0 0h1v1H0z"/></svg>');
      await expect(prepareLogoAssets({ projectRoot: fixture })).rejects.toThrow("primary_color and secondary_color");
    }
  });

  it("uses secondary color fallback and propagates non-missing source read failures", async () => {
    const root = await temporaryDirectory();
    await writeLogoProject(root, { logo_file: "source-assets/logo.svg", primary_color: "#000", secondary_color: "#123456" });
    await writeFile(join(root, "source-assets", "logo.svg"), '<svg viewBox="0 0 2 1"><rect fill="white" width="2" height="1"/><path d="M0 0h1v1H0z"/></svg>');
    await expect(prepareLogoAssets({ projectRoot: root })).resolves.toMatchObject({ variants: [{ themeColor: "#000000" }, { themeColor: "#123456" }] });

    const errorRoot = await temporaryDirectory();
    await writeLogoProject(errorRoot, { logo_file: "source-assets/logo.svg", primary_color: "#000", secondary_color: "#fff" });
    await mkdir(join(errorRoot, "source-assets", "logo.svg"));
    await expect(prepareLogoAssets({ projectRoot: errorRoot })).rejects.toBeTruthy();
    expect(formatLogoManifest({ sourceFile: "logo.svg" })).toBe('{\n  "sourceFile": "logo.svg"\n}\n');
  });
});

describe("project boundary audit", () => {
  it("covers inside/outside detection and path extraction", () => {
    const root = resolve("fixture");
    expect(isInsideRoot(root, root)).toBe(true);
    expect(isInsideRoot(root, join(root, "inside"))).toBe(true);
    expect(isInsideRoot(root, dirname(root))).toBe(false);
    const slash = String.fromCharCode(47);
    const backslash = String.fromCharCode(92);
    const unix = ["", "home", "person", "file.txt"].join(slash);
    const windows = ["C:", "folder", "file.txt"].join(backslash);
    const unc = `${backslash}${backslash}server${backslash}share${backslash}file.txt`;
    const fileUrl = `file:${slash}${slash}${slash}${["mnt", "data", "file.txt"].join(slash)}`;
    const findings = findAbsoluteLocalReferences(`${JSON.stringify(unix)} ${JSON.stringify(unix)} ${windows} ${unc} ${JSON.stringify(fileUrl)}`);
    expect(findings).toEqual(expect.arrayContaining([unix, windows, unc, fileUrl]));
    expect(findAbsoluteLocalReferences("./relative/file.txt")).toEqual([]);
    const source = join(root, "tests", "fixture.mjs");
    expect(findEscapingRelativeReferences('const a = "../inside.txt"', source, root)).toEqual([]);
    const escaping = ["..", "..", "..", "outside.txt"].join("/");
    expect(findEscapingRelativeReferences(`const a = ${JSON.stringify(escaping)}`, source, root)).toEqual([escaping]);
  });

  it("walks recursively while skipping ignored trees", async () => {
    const root = await temporaryDirectory();
    await mkdir(join(root, "nested"));
    await mkdir(join(root, "coverage"));
    await writeFile(join(root, "root.txt"), "root");
    await writeFile(join(root, "nested", "child.txt"), "child");
    await writeFile(join(root, "coverage", "ignored.txt"), "ignored");
    expect((await walkProjectFiles(root)).map((file) => file.slice(root.length)).sort()).toEqual(["/nested/child.txt", "/root.txt"]);
  });

  it("passes a self-contained project with internal symlinks and non-text files", async () => {
    const root = await temporaryDirectory();
    await writeFile(join(root, "package.json"), JSON.stringify({ dependencies: { react: "^19.0.0" }, devDependencies: {}, optionalDependencies: {} }));
    await writeFile(join(root, "inside.txt"), "project relative");
    await writeFile(join(root, "binary.bin"), Buffer.from([0, 1, 2]));
    await symlink(join(root, "inside.txt"), join(root, "link.txt"));
    await expect(checkProjectBoundaries({ projectRoot: root })).resolves.toMatchObject({ filesChecked: 4 });
    expect(formatProjectBoundaryResult({ filesChecked: 4 })).toContain("4 files");
  });

  it("accepts a package manifest with omitted dependency sections", async () => {
    const root = await temporaryDirectory();
    await writeFile(join(root, "package.json"), "{}\n");
    await expect(checkProjectBoundaries({ projectRoot: root })).resolves.toMatchObject({ filesChecked: 1 });
  });

  it("aggregates escaping symlinks, text references, relative escapes, and local dependencies", async () => {
    const root = await temporaryDirectory();
    const outside = await temporaryDirectory();
    const slash = String.fromCharCode(47);
    const externalLiteral = ["", "home", "person", "secret.txt"].join(slash);
    await writeFile(join(root, "package.json"), JSON.stringify({
      dependencies: { one: "file:../one" },
      devDependencies: { two: "link:../two" },
      optionalDependencies: { three: "workspace:../three", four: externalLiteral, five: 2 },
    }));
    await mkdir(join(root, "nested"));
    const escaping = ["..", "..", "..", "escape.txt"].join("/");
    await writeFile(join(root, "nested", "bad.ts"), `const absolute = ${JSON.stringify(externalLiteral)}; const relative = ${JSON.stringify(escaping)};`);
    await writeFile(join(outside, "target.txt"), "outside");
    await symlink(join(outside, "target.txt"), join(root, "external-link.txt"));
    await expect(checkProjectBoundaries({ projectRoot: root })).rejects.toThrow(/symlink escapes[\s\S]*absolute local filesystem reference[\s\S]*relative path that escapes[\s\S]*registry dependency model/);
  });
});
