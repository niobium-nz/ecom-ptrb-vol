import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { isDirectExecution, runCli } from "./cli.mjs";

const FORBIDDEN_RENDERED_PATTERNS = [
  ["em dash", /\u2014/],
  ["owner-facing checkout phrase", /\ba focused,?\s+guest checkout\b/i],
  ["guest-checkout meta copy", /\bguest checkout\b/i],
  ["conversion meta copy", /\bconversion[- ]focused\b|\bconversion rate\b/i],
  ["friction meta copy", /\blow[- ]friction\b|\breduce friction\b/i],
  ["operator offer terminology", /\boffer stack\b|\bmessage match(?:ed)?\b|\bpurchase flow\b/i],
  ["owner/operator terminology", /\bwebsite owner\b|\bsite owner\b|\bbusiness operator\b/i],
  ["ambiguous coupon label", /\bactive coupon\b/i],
];

export function initialTestimonialCount(total) {
  if (total <= 0) return 0;
  if (total <= 6) return total;
  if (total <= 9) return 4;
  return 6;
}

export async function collectHtml(root) {
  const result = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const fullPath = resolve(current, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (extname(entry.name).toLowerCase() === ".html") result.push(fullPath);
    }
  }
  await walk(root);
  return result;
}

export function auditRenderedHtml(text, fileName = "HTML") {
  const defects = [];
  for (const [label, pattern] of FORBIDDEN_RENDERED_PATTERNS) {
    if (pattern.test(text)) defects.push(`${fileName} contains ${label}`);
  }
  return defects;
}

export function routeForHtml(outDir, filePath) {
  const rel = relative(outDir, filePath).replaceAll("\\", "/");
  if (rel === "index.html") return "/";
  return `/${rel.replace(/\/index\.html$/i, "").replace(/\.html$/i, "")}`;
}

export async function checkCustomerFacingCopy({
  outDir = resolve(process.cwd(), "out"),
  projectDir = process.cwd(),
} = {}) {
  const htmlFiles = await collectHtml(outDir);
  if (htmlFiles.length === 0) throw new Error(`No static HTML files found under ${outDir}; run npm run build first`);

  const defects = [];
  for (const filePath of htmlFiles) {
    const text = await readFile(filePath, "utf8");
    const route = routeForHtml(outDir, filePath);
    defects.push(...auditRenderedHtml(text, filePath));
    if (route !== "/") {
      const hasHomeMarker = /data-home-link=["']true["']/i.test(text);
      const hasHomeHref = /<a\b[^>]*href=["']\/["'][^>]*data-home-link=["']true["']|<a\b[^>]*data-home-link=["']true["'][^>]*href=["']\/["']/i.test(text);
      if (!hasHomeMarker || !hasHomeHref) defects.push(`${route} is missing a visible project-local home link`);
    }
    if (/data-coupon-applied=["']true["']/i.test(text) && !/Coupon applied to this order/i.test(text)) {
      defects.push(`${route} has an applied-coupon marker without the exact clear label`);
    }
  }

  const testimonials = JSON.parse(await readFile(resolve(projectDir, "config/testimonials.json"), "utf8"));
  if (!Array.isArray(testimonials)) defects.push("config/testimonials.json must be an array");
  const testimonialTotal = Array.isArray(testimonials) ? testimonials.length : 0;
  const expectedInitial = initialTestimonialCount(testimonialTotal);
  const home = await readFile(resolve(outDir, "index.html"), "utf8");
  if (!/data-testimonials=["']true["']/i.test(home)) defects.push("home page is missing data-testimonials=\"true\"");
  if (!new RegExp(`data-testimonials-total=["']?${testimonialTotal}["']?`, "i").test(home)) defects.push("home page testimonial total does not match config/testimonials.json");
  const testimonialCount = [...home.matchAll(/data-testimonial=["']true["']/gi)].length;
  if (testimonialCount !== expectedInitial) defects.push(`home page initially renders ${testimonialCount} testimonials; expected ${expectedInitial} from ${testimonialTotal}`);
  if (testimonialTotal > expectedInitial && !/data-load-more-testimonials=["']true["']/i.test(home)) defects.push("home page is missing the load-more testimonial control");

  const manifest = JSON.parse(await readFile(resolve(projectDir, "config/legal-content-manifest.json"), "utf8"));
  for (const [field, entry] of Object.entries(manifest)) {
    if (!entry || typeof entry !== "object" || typeof entry.project_path !== "string" || typeof entry.sha256 !== "string") {
      defects.push(`legal manifest entry ${field} is invalid`);
      continue;
    }
    const bytes = await readFile(resolve(projectDir, entry.project_path));
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== entry.sha256) defects.push(`${entry.project_path} does not match its binding legal-content hash`);
  }

  if (defects.length > 0) throw new Error(`Customer-facing copy check failed:\n- ${defects.join("\n- ")}`);
  return { htmlFiles: htmlFiles.length, testimonialCount, testimonialTotal };
}

export function formatCustomerFacingCopyResult(result) {
  return `Customer-facing copy check passed across ${result.htmlFiles} HTML files with ${result.testimonialCount}/${result.testimonialTotal} testimonials initially visible.\n`;
}

void runCli({
  direct: isDirectExecution(import.meta.url, process.argv[1]),
  task: checkCustomerFacingCopy,
  format: formatCustomerFacingCopyResult,
});
