import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { isDirectExecution, runCli } from "./cli.mjs";

const execFileAsync = promisify(execFile);
export const STABLE_SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:\+[0-9A-Za-z.-]+)?$/;
export const CARET_STABLE_SEMVER = /^\^(\d+)\.(\d+)\.(\d+)(?:\+[0-9A-Za-z.-]+)?$/;

export function parseStableVersion(value, label = "version") {
  const match = STABLE_SEMVER.exec(String(value).trim());
  if (!match) throw new Error(`${label} must be a stable semantic version; received ${JSON.stringify(value)}`);
  return { raw: match[0], major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function compareVersions(left, right) {
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }
  return 0;
}

export function collectDirectDependencies(packageJson) {
  return new Map(
    Object.entries({ ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) }).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

export function validateCaretStableRange(packageName, range) {
  const match = CARET_STABLE_SEMVER.exec(String(range));
  if (!match) throw new Error(`${packageName} must use a stable caret range such as ^4.113.0; received ${JSON.stringify(range)}`);
  return parseStableVersion(range.slice(1), `${packageName} range floor`);
}

export function isCaretCompatible(version, floor) {
  if (compareVersions(version, floor) < 0) return false;
  if (floor.major > 0) return version.major === floor.major;
  if (floor.minor > 0) return version.major === 0 && version.minor === floor.minor;
  return version.major === 0 && version.minor === 0 && version.patch === floor.patch;
}

export function parseNpmVersionOutput(stdout, packageName) {
  const trimmed = stdout.trim();
  let value;
  try { value = JSON.parse(trimmed); } catch { value = trimmed.replace(/^['"]|['"]$/g, ""); }
  const values = Array.isArray(value) ? value : [value];
  const parsed = values
    .filter((item) => typeof item === "string" && STABLE_SEMVER.test(item))
    .map((item) => parseStableVersion(item, `${packageName} registry version`));
  if (parsed.length === 0) throw new Error(`npm returned no stable versions for ${packageName}: ${trimmed}`);
  return parsed.sort(compareVersions).at(-1);
}

async function npmView(packageSelector, field, { cwd, exec, platform = process.platform }) {
  const npmCommand = platform === "win32" ? "npm.cmd" : "npm";
  const { stdout, stderr } = await exec(npmCommand, ["view", packageSelector, field, "--json"], {
    cwd,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (stderr.trim()) throw new Error(`npm view emitted stderr for ${packageSelector}: ${stderr.trim()}`);
  return stdout;
}

export async function queryLatestStable(packageName, options) {
  return parseNpmVersionOutput(await npmView(packageName, "dist-tags.latest", options), packageName);
}

export async function queryLatestStableWithinRange(packageName, configuredRange, options) {
  return parseNpmVersionOutput(
    await npmView(`${packageName}@${configuredRange}`, "version", options),
    `${packageName}@${configuredRange}`,
  );
}

export function resolvedLockVersion(lockfile, packageName) {
  const entry = lockfile.packages?.[`node_modules/${packageName}`];
  const value = entry?.version ?? lockfile.dependencies?.[packageName]?.version;
  if (typeof value !== "string") throw new Error(`package-lock.json has no resolved version for ${packageName}`);
  return parseStableVersion(value, `${packageName} locked version`);
}

export async function checkDependencyFreshness({ cwd = process.cwd(), exec = execFileAsync } = {}) {
  const rootUrl = pathToFileURL(`${cwd}/`);
  const packageJson = JSON.parse(await readFile(new URL("./package.json", rootUrl), "utf8"));
  const lockfile = JSON.parse(await readFile(new URL("./package-lock.json", rootUrl), "utf8"));
  const dependencies = collectDirectDependencies(packageJson);
  if (dependencies.size === 0) throw new Error("package.json has no direct dependencies to validate");

  const results = [];
  const failures = [];
  for (const [packageName, configuredRange] of dependencies) {
    try {
      const floor = validateCaretStableRange(packageName, configuredRange);
      const locked = resolvedLockVersion(lockfile, packageName);
      if (!isCaretCompatible(locked, floor)) {
        throw new Error(`locked ${locked.raw} does not satisfy configured caret range ${configuredRange}`);
      }
      const latestCompatible = await queryLatestStableWithinRange(packageName, configuredRange, { cwd, exec });
      const latestOverall = await queryLatestStable(packageName, { cwd, exec });
      if (!isCaretCompatible(latestCompatible, floor)) {
        throw new Error(`npm returned ${latestCompatible.raw}, which is outside configured caret range ${configuredRange}`);
      }
      if (compareVersions(locked, latestCompatible) !== 0) {
        throw new Error(`locked ${locked.raw} is not latest stable compatible ${latestCompatible.raw} for ${configuredRange}`);
      }
      results.push({ packageName, configuredRange, locked: locked.raw, latestCompatible: latestCompatible.raw, latestOverall: latestOverall.raw });
    } catch (error) {
      failures.push(`${packageName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failures.length > 0) throw new Error(`Dependency freshness check failed:\n- ${failures.join("\n- ")}`);
  return results;
}

export function formatDependencyFreshnessResults(results) {
  let output = "";
  for (const item of results) {
    const overall = parseStableVersion(item.latestOverall);
    const locked = parseStableVersion(item.locked);
    const compatibilityNote = compareVersions(overall, locked) > 0 && overall.raw !== item.latestCompatible
      ? `; newer incompatible release ${item.latestOverall} available but not crossed by ${item.configuredRange}`
      : "";
    output += `CURRENT ${item.packageName}@${item.locked} via ${item.configuredRange}${compatibilityNote}\n`;
  }
  return `${output}Dependency freshness passed for ${results.length} direct packages.\n`;
}

void runCli({
  direct: isDirectExecution(import.meta.url, process.argv[1]),
  task: checkDependencyFreshness,
  format: formatDependencyFreshnessResults,
});
