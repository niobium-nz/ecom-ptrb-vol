import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { isDirectExecution, runCli } from "./cli.mjs";

const BLACK_PAINTS = new Set(["#000", "#000000", "black", "rgb(0,0,0)", "rgb(0 0 0)"]);
const WHITE_PAINTS = new Set([
  "#fff",
  "#ffffff",
  "white",
  "rgb(255,255,255)",
  "rgb(255 255 255)",
]);
const TRANSPARENT_PAINTS = new Set(["none", "transparent"]);
const PAINT_ATTRIBUTE = /\b(fill|stroke|color|stop-color|flood-color|lighting-color)\s*=\s*(["'])(.*?)\2/gi;
const STYLE_ATTRIBUTE = /\bstyle\s*=\s*(["'])(.*?)\1/gi;
const STYLE_PAINT = /(?:^|[;{\s])(fill|stroke|color|stop-color|flood-color|lighting-color)\s*:\s*([^;}]+)/gi;
const GRAPHIC_ELEMENT = /<(?:path|rect|circle|ellipse|polygon|polyline|line|text|use)\b/gi;
const EXPLICIT_PAINT_ATTRIBUTE = /\s(?:fill|stroke)\s*=/i;

export function normalizePaint(value) {
  return String(value).trim().toLowerCase().replace(/\s*,\s*/g, ",").replace(/\s+/g, " ");
}

export function normalizeHexColor(value, fieldName = "theme color") {
  const raw = String(value ?? "").trim().toLowerCase();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  if (!match) throw new Error(`${fieldName} must be a 3- or 6-digit hexadecimal color`);
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit.repeat(2)).join("") : match[1];
  return {
    hex: `#${digits}`,
    rgb: [0, 2, 4].map((offset) => Number.parseInt(digits.slice(offset, offset + 2), 16)),
  };
}

export function validatePaint(value, context) {
  const normalized = normalizePaint(value);
  if (TRANSPARENT_PAINTS.has(normalized)) return "transparent";
  if (BLACK_PAINTS.has(normalized)) return "black";
  if (WHITE_PAINTS.has(normalized)) return "white";
  throw new Error(
    `Unsupported SVG logo paint at ${context}: ${JSON.stringify(value)}. ` +
      "Only black foreground, white background, none, and transparent are allowed.",
  );
}

export function validateSvgSource(svgText) {
  if (typeof svgText !== "string" || !/<svg\b/i.test(svgText)) {
    throw new Error("Logo source is not an SVG document");
  }
  if (/<!doctype|<!entity/i.test(svgText)) throw new Error("SVG logo must not contain DOCTYPE or entity declarations");
  if (/<(?:script|image|foreignObject|linearGradient|radialGradient|pattern|filter)\b/i.test(svgText)) {
    throw new Error("SVG logo contains unsupported executable, embedded-image, foreign-object, gradient, or pattern content");
  }
  if (/<link\b|@import\b/i.test(svgText)) throw new Error("SVG logo contains an external stylesheet reference");

  for (const match of svgText.matchAll(/(?:xlink:)?href\s*=\s*["']([^"']+)["']/gi)) {
    if (!match[1].startsWith("#")) throw new Error(`SVG logo contains an external linked resource: ${match[1]}`);
  }

  for (const match of svgText.matchAll(/url\(\s*([^)]+?)\s*\)/gi)) {
    const target = match[1].replace(/^['"]|['"]$/g, "").trim();
    if (!target.startsWith("#")) throw new Error(`SVG logo contains an external url() resource: ${target}`);
  }

  let black = 0;
  let white = 0;
  let transparent = 0;
  const countPaint = (value, context) => {
    const kind = validatePaint(value, context);
    if (kind === "black") black += 1;
    if (kind === "white") white += 1;
    if (kind === "transparent") transparent += 1;
  };

  for (const match of svgText.matchAll(PAINT_ATTRIBUTE)) {
    countPaint(match[3], `attribute ${match[1]}`);
  }
  for (const styleAttribute of svgText.matchAll(STYLE_ATTRIBUTE)) {
    for (const match of styleAttribute[2].matchAll(STYLE_PAINT)) {
      countPaint(match[2].trim(), `style attribute ${match[1]}`);
    }
  }
  for (const styleBlock of svgText.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const match of styleBlock[1].matchAll(STYLE_PAINT)) {
      countPaint(match[2].trim(), `style block ${match[1]}`);
    }
  }

  // SVG's omitted fill defaults to black. Count graphical elements without an
  // explicit fill/stroke as black foreground candidates so a simple path-only
  // logo is accepted and then verified after rasterization.
  let defaultBlack = 0;
  for (const match of svgText.matchAll(GRAPHIC_ELEMENT)) {
    const tagStart = match.index;
    const tagEnd = svgText.indexOf(">", tagStart);
    const tag = svgText.slice(tagStart, tagEnd >= 0 ? tagEnd + 1 : tagStart);
    if (!EXPLICIT_PAINT_ATTRIBUTE.test(tag)) defaultBlack += 1;
  }

  if (black + defaultBlack === 0) throw new Error("SVG logo has no detectable black foreground signs");

  const viewBoxMatch = /\bviewBox\s*=\s*["']\s*([-+\d.eE]+)[,\s]+([-+\d.eE]+)[,\s]+([-+\d.eE]+)[,\s]+([-+\d.eE]+)\s*["']/i.exec(
    svgText,
  );
  if (!viewBoxMatch) throw new Error("SVG logo must include a valid viewBox for deterministic sizing");
  const viewBox = viewBoxMatch.slice(1).map(Number);
  if (!viewBox.every(Number.isFinite) || viewBox[2] <= 0 || viewBox[3] <= 0) {
    throw new Error("SVG logo viewBox width and height must be positive finite numbers");
  }

  return { black, white, transparent, defaultBlack, viewBox };
}

export function calculateRasterDimensions(viewBox, { maxCssWidth = 200, maxCssHeight = 40, density = 2 } = {}) {
  const [, , sourceWidth, sourceHeight] = viewBox;
  for (const [name, value] of Object.entries({ maxCssWidth, maxCssHeight, density })) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive finite number`);
  }
  const scale = Math.min((maxCssWidth * density) / sourceWidth, (maxCssHeight * density) / sourceHeight);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
    cssWidth: Math.max(1, Math.round(sourceWidth * scale / density)),
    cssHeight: Math.max(1, Math.round(sourceHeight * scale / density)),
    density,
  };
}

export function recolorBlackWhiteRgba(input, themeRgb) {
  if (!(input instanceof Uint8Array) && !Buffer.isBuffer(input)) throw new Error("RGBA input must be bytes");
  if (input.length % 4 !== 0) throw new Error("RGBA input length must be divisible by four");
  if (!Array.isArray(themeRgb) || themeRgb.length !== 3 || themeRgb.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)) {
    throw new Error("themeRgb must contain three integer channels from 0 to 255");
  }

  const output = Buffer.alloc(input.length);
  for (let offset = 0; offset < input.length; offset += 4) {
    const red = input[offset];
    const green = input[offset + 1];
    const blue = input[offset + 2];
    const sourceAlpha = input[offset + 3] / 255;
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    const sourceCoverage = Math.max(0, Math.min(1, sourceAlpha * (1 - luminance)));
    output[offset] = themeRgb[0];
    output[offset + 1] = themeRgb[1];
    output[offset + 2] = themeRgb[2];
    output[offset + 3] = Math.round(sourceCoverage * 255);
  }
  return output;
}

export function inspectOutputRgba(rgba, themeRgb) {
  if (rgba.length % 4 !== 0) throw new Error("Output RGBA length must be divisible by four");
  let transparentPixels = 0;
  let visiblePixels = 0;
  let opaqueWhitePixels = 0;
  let wrongVisibleColorPixels = 0;

  for (let offset = 0; offset < rgba.length; offset += 4) {
    const red = rgba[offset];
    const green = rgba[offset + 1];
    const blue = rgba[offset + 2];
    const alpha = rgba[offset + 3];
    if (alpha === 0) transparentPixels += 1;
    if (alpha > 0) {
      visiblePixels += 1;
      if (red !== themeRgb[0] || green !== themeRgb[1] || blue !== themeRgb[2]) wrongVisibleColorPixels += 1;
      if (alpha === 255 && red === 255 && green === 255 && blue === 255) opaqueWhitePixels += 1;
    }
  }

  if (transparentPixels === 0) throw new Error("Generated logo PNG has no transparent pixels");
  if (visiblePixels === 0) throw new Error("Generated logo PNG has no visible foreground pixels");
  if (opaqueWhitePixels > 0) throw new Error("Generated logo PNG retains an opaque white background");
  if (wrongVisibleColorPixels > 0) throw new Error("Generated logo PNG contains visible pixels outside the selected theme color");

  return { transparentPixels, visiblePixels, opaqueWhitePixels, wrongVisibleColorPixels };
}

export async function atomicWrite(path, data) {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, data);
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export async function generateLogoVariant({ sharp, svgBuffer, dimensions, outputPath, themeColor }) {
  const { rgb, hex } = normalizeHexColor(themeColor, `logo theme color for ${outputPath}`);
  const { data: sourceRgba, info } = await sharp(svgBuffer, { density: 300 })
    .resize({ width: dimensions.width, height: dimensions.height, fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.width !== dimensions.width || info.height !== dimensions.height || info.channels !== 4) {
    throw new Error(`Unexpected raster output for ${outputPath}`);
  }

  const recolored = recolorBlackWhiteRgba(sourceRgba, rgb);
  const verification = inspectOutputRgba(recolored, rgb);
  const png = await sharp(recolored, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  await atomicWrite(outputPath, png);

  return { outputPath, themeColor: hex, width: info.width, height: info.height, ...verification };
}

export function assertInsideProject(projectRoot, candidate, label) {
  const rel = relative(projectRoot, candidate);
  if (rel === ".." || rel.startsWith(`..${sep}`) || rel.startsWith("../") || rel.startsWith("..\\")) {
    throw new Error(`${label} must remain inside the generated webapp: ${candidate}`);
  }
}

export function resolveSourcePath(projectRoot, logo_file) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(logo_file) || /^[a-z]:[\\/]/i.test(logo_file) || logo_file.startsWith("/")) {
    throw new Error("SVG logo source must use a project-relative in-repo path");
  }
  const candidate = resolve(projectRoot, logo_file);
  assertInsideProject(projectRoot, candidate, "SVG logo source");
  return candidate;
}

export async function prepareLogoAssets({ projectRoot = process.cwd(), configFile } = {}) {
  projectRoot = resolve(projectRoot);
  const configPath = resolve(projectRoot, configFile ?? process.env.SITE_INPUT_PATH ?? "config/site-input-summary.json");
  assertInsideProject(projectRoot, configPath, "site input config");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const brand = config.brand_system ?? config.brand ?? {};
  const logo_file = String(brand.logo_file ?? "").trim();
  if (!logo_file) throw new Error("brand_system.logo_file is required");
  if (extname(logo_file.split(/[?#]/, 1)[0]).toLowerCase() !== ".svg") {
    return { skipped: true, reason: "source logo is not SVG", logo_file };
  }

  const sourcePath = resolveSourcePath(projectRoot, logo_file);
  let svgBuffer;
  try {
    svgBuffer = await readFile(sourcePath);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`SVG logo source is missing from the generated project: ${logo_file}`);
    throw error;
  }

  const inspection = validateSvgSource(svgBuffer.toString("utf8"));
  const dimensions = calculateRasterDimensions(inspection.viewBox);
  const outputDir = resolve(projectRoot, "public/assets");
  await mkdir(outputDir, { recursive: true });
  const primaryPath = join(outputDir, "logo-primary.png");
  const inversePath = join(outputDir, "logo-inverse.png");
  await rm(primaryPath, { force: true });
  await rm(inversePath, { force: true });

  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;
  const primary_color = brand.primary_color;
  const inverse_color = brand.logo_inverse_color ?? brand.secondary_color;
  if (!primary_color || !inverse_color) {
    throw new Error("brand primary_color and secondary_color/logo_inverse_color are required");
  }

  const variants = [];
  variants.push(await generateLogoVariant({ sharp, svgBuffer, dimensions, outputPath: primaryPath, themeColor: primary_color }));
  if (normalizeHexColor(primary_color).hex === normalizeHexColor(inverse_color).hex) {
    await atomicWrite(inversePath, await readFile(primaryPath));
    variants.push({ ...variants[0], outputPath: inversePath });
  } else {
    variants.push(await generateLogoVariant({ sharp, svgBuffer, dimensions, outputPath: inversePath, themeColor: inverse_color }));
  }

  const manifest = {
    sourceFile: relative(projectRoot, sourcePath).split(sep).join("/"),
    sourceHash: createHash("sha256").update(svgBuffer).digest("hex"),
    inspection,
    dimensions,
    variants: variants.map(({ outputPath, ...variant }) => ({
      ...variant,
      outputFile: relative(projectRoot, outputPath).split(sep).join("/"),
    })),
  };
  await atomicWrite(join(outputDir, "logo-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export function formatLogoManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

void runCli({
  direct: isDirectExecution(import.meta.url, process.argv[1]),
  task: prepareLogoAssets,
  format: formatLogoManifest,
});
