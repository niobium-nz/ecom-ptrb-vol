import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  calculateRasterDimensions,
  generateLogoVariant,
  inspectOutputRgba,
  normalizeHexColor,
  normalizePaint,
  prepareLogoAssets,
  recolorBlackWhiteRgba,
  validatePaint,
  validateSvgSource,
} from "../../scripts/prepare-logo-assets.mjs";

const temporaryDirectories = [];

async function makeProject() {
  const root = await mkdtemp(join(tmpdir(), "ptrb-logo-test-"));
  temporaryDirectories.push(root);
  await mkdir(join(root, "config"), { recursive: true });
  await mkdir(join(root, "source-assets"), { recursive: true });
  return root;
}

async function writeConfig(root, brandOverrides = {}) {
  await writeFile(
    join(root, "config/site-input-summary.json"),
    `${JSON.stringify({
      brand_system: {
        logo_file: "source-assets/logo.svg",
        primary_color: "#1F6E6E",
        logo_inverse_color: "#F7F3EA",
        ...brandOverrides,
      },
    })}\n`,
  );
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

describe("SVG source validation", () => {
  it("accepts the supported black, white, and transparent paint forms", () => {
    const inspection = validateSvgSource(
      '<svg viewBox="0 0 20 10"><rect fill="white" width="20" height="10"/><path style="fill: rgb(0, 0, 0); stroke: none" d="M0 0h10v10H0z"/></svg>',
    );

    expect(inspection).toEqual({ black: 1, white: 1, transparent: 1, defaultBlack: 1, viewBox: [0, 0, 20, 10] });
    expect(normalizePaint(" RGB(0, 0, 0) ")).toBe("rgb(0,0,0)");
    expect(validatePaint("transparent", "fixture")).toBe("transparent");
  });

  it.each([
    ["not svg", "not an SVG"],
    ['<!DOCTYPE svg><svg viewBox="0 0 1 1"><path/></svg>', "DOCTYPE"],
    ['<svg viewBox="0 0 1 1"><script/></svg>', "unsupported executable"],
    ['<svg viewBox="0 0 1 1"><link href="theme.css"/><path/></svg>', "external stylesheet"],
    ['<svg viewBox="0 0 1 1"><use href="outside.svg#mark"/></svg>', "external linked resource"],
    ['<svg viewBox="0 0 1 1"><path fill="url(https://example.test/p.svg)"/></svg>', "external url()"],
    ['<svg viewBox="0 0 1 1"><path fill="#f00"/></svg>', "Unsupported SVG logo paint"],
    ['<svg viewBox="0 0 1 1"><rect fill="white"/></svg>', "no detectable black"],
    ['<svg><path/></svg>', "valid viewBox"],
    ['<svg viewBox="0 0 0 1"><path/></svg>', "positive finite"],
  ])("rejects unsafe or ambiguous source: %s", (source, message) => {
    expect(() => validateSvgSource(source)).toThrow(message);
  });
});

describe("logo sizing and pixel mapping", () => {
  it("preserves the source aspect ratio at two times the intended CSS height", () => {
    expect(calculateRasterDimensions([0, 0, 503, 425])).toEqual({
      width: 95,
      height: 80,
      cssWidth: 47,
      cssHeight: 40,
      density: 2,
    });
    expect(() => calculateRasterDimensions([0, 0, 1, 1], { density: 0 })).toThrow("density must be a positive");
  });

  it("maps black to the theme, white to alpha zero, and grey to partial alpha", () => {
    const output = recolorBlackWhiteRgba(
      Uint8Array.from([0, 0, 0, 255, 255, 255, 255, 255, 128, 128, 128, 255]),
      [31, 110, 110],
    );

    expect([...output]).toEqual([31, 110, 110, 255, 31, 110, 110, 0, 31, 110, 110, 127]);
    expect(inspectOutputRgba(output, [31, 110, 110])).toEqual({
      transparentPixels: 1,
      visiblePixels: 2,
      opaqueWhitePixels: 0,
      wrongVisibleColorPixels: 0,
    });
  });

  it("validates theme colors and malformed pixel data", () => {
    expect(normalizeHexColor("#1F6E6E")).toEqual({ hex: "#1f6e6e", rgb: [31, 110, 110] });
    expect(normalizeHexColor("#abc")).toEqual({ hex: "#aabbcc", rgb: [170, 187, 204] });
    expect(() => normalizeHexColor("teal")).toThrow("hexadecimal color");
    expect(() => recolorBlackWhiteRgba("bad", [0, 0, 0])).toThrow("RGBA input must be bytes");
    expect(() => recolorBlackWhiteRgba(Uint8Array.of(0), [0, 0, 0])).toThrow("divisible by four");
    expect(() => recolorBlackWhiteRgba(Uint8Array.of(0, 0, 0, 0), [0, 0, 256])).toThrow("three integer channels");
    expect(() => inspectOutputRgba(Uint8Array.of(0), [0, 0, 0])).toThrow("divisible by four");
    expect(() => inspectOutputRgba(Uint8Array.of(0, 0, 0, 255), [0, 0, 0])).toThrow("no transparent pixels");
    expect(() => inspectOutputRgba(Uint8Array.of(0, 0, 0, 0), [0, 0, 0])).toThrow("no visible foreground");
    expect(() => inspectOutputRgba(Uint8Array.of(0, 0, 0, 0, 255, 255, 255, 255), [0, 0, 0])).toThrow("opaque white background");
    expect(() => inspectOutputRgba(Uint8Array.of(0, 0, 0, 0, 1, 2, 3, 255), [0, 0, 0])).toThrow("outside the selected theme color");
  });
});

describe("generated logo assets", () => {
  it("writes verified RGBA PNG variants and a source-bound manifest", async () => {
    const root = await makeProject();
    await writeConfig(root);
    await writeFile(
      join(root, "source-assets/logo.svg"),
      '<svg viewBox="0 0 20 10"><rect fill="#fff" width="20" height="10"/><rect x="2" y="2" width="16" height="6"/></svg>',
    );

    const manifest = await prepareLogoAssets({ projectRoot: root });

    expect(manifest.sourceFile).toBe("source-assets/logo.svg");
    expect(manifest.dimensions).toMatchObject({ width: 160, height: 80 });
    expect(manifest.variants.map((variant) => [variant.outputFile, variant.themeColor])).toEqual([
      ["public/assets/logo-primary.png", "#1f6e6e"],
      ["public/assets/logo-inverse.png", "#f7f3ea"],
    ]);
    expect(JSON.parse(await readFile(join(root, "public/assets/logo-manifest.json"), "utf8"))).toEqual(manifest);
  });

  it("can duplicate a single-color variant without losing the manifest contract", async () => {
    const root = await makeProject();
    await writeConfig(root, { logo_inverse_color: "#1F6E6E" });
    await writeFile(
      join(root, "source-assets/logo.svg"),
      '<svg viewBox="0 0 2 1"><rect fill="white" width="2" height="1"/><path d="M0 0h1v1H0z"/></svg>',
    );

    const manifest = await prepareLogoAssets({ projectRoot: root });
    expect(manifest.variants[1]).toMatchObject({ themeColor: "#1f6e6e", outputFile: "public/assets/logo-inverse.png" });
    expect(await readFile(join(root, "public/assets/logo-inverse.png"))).toEqual(
      await readFile(join(root, "public/assets/logo-primary.png")),
    );
  });

  it("supports direct variant generation and reports missing inputs safely", async () => {
    const sharp = (await import("sharp")).default;
    const root = await makeProject();
    const outputPath = join(root, "direct.png");
    const result = await generateLogoVariant({
      sharp,
      svgBuffer: Buffer.from('<svg viewBox="0 0 2 1"><rect fill="white" width="2" height="1"/><path d="M0 0h1v1H0z"/></svg>'),
      dimensions: { width: 4, height: 2 },
      outputPath,
      themeColor: "#1F6E6E",
    });
    expect(result).toMatchObject({ width: 4, height: 2, themeColor: "#1f6e6e" });

    await writeConfig(root);
    await expect(prepareLogoAssets({ projectRoot: root })).rejects.toThrow("SVG logo source is missing");
    await writeConfig(root, { logo_file: "source-assets/logo.png" });
    await expect(prepareLogoAssets({ projectRoot: root })).resolves.toMatchObject({ skipped: true });
    await expect(prepareLogoAssets({ projectRoot: root, configFile: resolve(root, "../outside.json") })).rejects.toThrow(
      "site input config must remain inside",
    );
  });
});

describe("shopper-facing logo component", () => {
  it("uses only generated PNG variants with explicit intrinsic dimensions", async () => {
    const source = await readFile(resolve("components/brand/site-logo.tsx"), "utf8");

    expect(source).toContain('/assets/logo-primary.png');
    expect(source).toContain('/assets/logo-inverse.png');
    expect(source).toContain('width={95}');
    expect(source).toContain('height={80}');
    expect(source).not.toMatch(/\.svg["']/i);
    expect(source).not.toContain("source-assets");
  });
});
