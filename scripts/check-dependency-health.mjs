import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { isDirectExecution, runCli } from "./cli.mjs";

const UNHEALTHY_OUTPUT = /npm\s+warn|warn(?:ing)?\b|deprecated|overrid(?:e|ing) peer dependency|ERESOLVE|EBADENGINE|invalid:|extraneous:|missing:|peer invalid|install scripts not (?:yet )?covered by allowScripts|ESTRICTALLOWSCRIPTS/i;

export function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(value).trim());
  if (!match) throw new Error(`Unsupported semantic version: ${value}`);
  return match.slice(1).map(Number);
}

export function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

export function minimumEngineVersion(range) {
  const candidates = [...String(range).matchAll(/>=?\s*(\d+\.\d+\.\d+)/g)].map((match) => parseVersion(match[1]));
  if (candidates.length === 0) throw new Error(`Unsupported engines.node range for strict validation: ${range}`);
  return candidates.sort(compareVersions).at(-1);
}

export function validateAllowScripts(packageJson, lockfile) {
  const allowScripts = packageJson.allowScripts;
  if (!allowScripts || typeof allowScripts !== "object" || Array.isArray(allowScripts)) {
    throw new Error("package.json must contain an allowScripts object generated from reviewed install scripts");
  }

  const required = [];
  for (const [lockPath, entry] of Object.entries(lockfile.packages ?? {})) {
    if (!entry?.hasInstallScript || !entry.version || !lockPath.includes("node_modules/")) continue;
    const packageName = entry.name ?? lockPath.slice(lockPath.lastIndexOf("node_modules/") + "node_modules/".length);
    required.push(`${packageName}@${entry.version}`);
  }

  const missing = required.filter((key) => allowScripts[key] !== true && allowScripts[key] !== false);
  if (missing.length > 0) throw new Error(`allowScripts has no reviewed decision for:\n- ${missing.join("\n- ")}`);

  if (required.some((key) => key.startsWith("workerd@")) && !required.some((key) => key.startsWith("workerd@") && allowScripts[key] === true)) {
    throw new Error("the resolved workerd install script must be explicitly approved in allowScripts");
  }
  return required;
}

export function parsePendingScripts(stdout) {
  const text = String(stdout).trim();
  if (!text) return [];
  if (text === "No packages with unreviewed install scripts.") return [];
  let parsed;
  try { parsed = JSON.parse(text); } catch {
    throw new Error(`npm approve-scripts did not return valid JSON: ${text}`);
  }
  const candidate = parsed?.allowScripts ?? parsed?.pending ?? parsed?.packages ?? parsed;
  if (Array.isArray(candidate)) return candidate.map(String).filter(Boolean);
  if (candidate && typeof candidate === "object") return Object.keys(candidate);
  return [];
}

export function runHealthCommand(command, args, { cwd = process.cwd(), env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}

export function assertHealthyCommand(label, result) {
  const combined = `${result.stdout}\n${result.stderr}`;
  if (result.code !== 0 || UNHEALTHY_OUTPUT.test(combined)) {
    throw new Error(`${label} failed or emitted unhealthy output (exit ${result.code}):\n${combined}`);
  }
}

export async function checkDependencyHealth({ cwd = process.cwd(), runner = runHealthCommand, platform = process.platform } = {}) {
  const packageJson = JSON.parse(await readFile(new URL("./package.json", pathToFileURL(`${cwd}/`)), "utf8"));
  const lockfile = JSON.parse(await readFile(new URL("./package-lock.json", pathToFileURL(`${cwd}/`)), "utf8"));
  const engineRange = packageJson.engines?.node;
  if (typeof engineRange !== "string") throw new Error("package.json engines.node is required");
  if (compareVersions(parseVersion(process.version), minimumEngineVersion(engineRange)) < 0) {
    throw new Error(`Node ${process.version} does not satisfy engines.node ${engineRange}`);
  }

  const reviewedScripts = validateAllowScripts(packageJson, lockfile);
  const npmCommand = platform === "win32" ? "npm.cmd" : "npm";
  const dryRun = await runner(npmCommand, ["ci", "--dry-run", "--strict-allow-scripts", "--no-audit", "--no-fund"], { cwd });
  assertHealthyCommand("npm ci dry-run", dryRun);

  const pending = await runner(npmCommand, ["approve-scripts", "--allow-scripts-pending", "--json"], { cwd });
  if (pending.code !== 0 || pending.stderr.trim()) {
    throw new Error(`npm approve-scripts pending check failed:\n${pending.stdout}\n${pending.stderr}`);
  }
  const pendingScripts = parsePendingScripts(pending.stdout);
  if (pendingScripts.length > 0) {
    throw new Error(`unreviewed dependency install scripts remain:\n- ${pendingScripts.join("\n- ")}`);
  }

  const tree = await runner(npmCommand, ["ls", "--all"], { cwd });
  assertHealthyCommand("npm ls --all", tree);
  return { reviewedScripts: reviewedScripts.length };
}

export function formatDependencyHealthResult(result) {
  return `Dependency health passed with ${result.reviewedScripts} reviewed install-script decision(s).\n`;
}

void runCli({
  direct: isDirectExecution(import.meta.url, process.argv[1]),
  task: checkDependencyHealth,
  format: formatDependencyHealthResult,
});
