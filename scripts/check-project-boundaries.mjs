import { lstat, readFile, realpath, readdir } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { isDirectExecution, runCli } from "./cli.mjs";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  "node_modules",
  "out",
  "coverage",
  "playwright-report",
  "test-results",
  ".vscode/.debug-profile",
]);

const TEXT_EXTENSIONS = new Set([
  ".css", ".html", ".js", ".jsx", ".json", ".md", ".mjs", ".mts", ".ts", ".tsx", ".txt", ".yaml", ".yml",
]);

const ABSOLUTE_LOCAL_PATTERNS = [
  /file:\/\/\/[A-Za-z]:[\\/][^\s"'`)]+/gi,
  /file:\/\/\/(?:home|Users|mnt|tmp|private|workspace|github\/workspace|root|opt)\/[^\s"'`)]+/g,
  /(?:^|[\s"'`=(])([A-Za-z]:[\\/][^\s"'`)]+)/gm,
  /(?:^|[\s"'`=(])(\\\\[^\\\s"'`]+\\[^\s"'`)]+)/gm,
  /(?:^|[\s"'`=(])(\/(?:home|Users|mnt|tmp|private|workspace|github\/workspace|root|opt)\/[^\s"'`)]+)/gm,
];

const RELATIVE_PATH_LITERAL = /(["'`])((?:\.\.\/)+[^"'`\n]+)\1/g;

export function isInsideRoot(root, candidate) {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

export function findAbsoluteLocalReferences(text) {
  const findings = [];
  for (const pattern of ABSOLUTE_LOCAL_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) findings.push(match[1] ?? match[0].trim());
  }
  return [...new Set(findings)];
}

export function findEscapingRelativeReferences(text, filePath, projectRoot) {
  const findings = [];
  for (const match of text.matchAll(RELATIVE_PATH_LITERAL)) {
    const value = match[2];
    const resolved = resolve(dirname(filePath), value);
    if (!isInsideRoot(projectRoot, resolved)) findings.push(value);
  }
  return [...new Set(findings)];
}

export async function walkProjectFiles(root, current = root) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const fullPath = resolve(current, entry.name);
    const rel = relative(root, fullPath).split(sep).join("/");
    if ([...IGNORED_DIRECTORIES].some((ignored) => rel === ignored || rel.startsWith(`${ignored}/`))) continue;
    if (entry.isDirectory()) files.push(...await walkProjectFiles(root, fullPath));
    else files.push(fullPath);
  }
  return files;
}

export async function checkProjectBoundaries({ projectRoot = process.cwd() } = {}) {
  const root = await realpath(resolve(projectRoot));
  const defects = [];

  for (const filePath of await walkProjectFiles(root)) {
    const stat = await lstat(filePath);
    if (stat.isSymbolicLink()) {
      const target = await realpath(filePath);
      if (!isInsideRoot(root, target)) defects.push(`${relative(root, filePath)} symlink escapes project root: ${target}`);
      continue;
    }
    if (!stat.isFile() || !TEXT_EXTENSIONS.has(extname(filePath).toLowerCase())) continue;

    const text = await readFile(filePath, "utf8");
    for (const value of findAbsoluteLocalReferences(text)) {
      defects.push(`${relative(root, filePath)} contains an absolute local filesystem reference: ${value}`);
    }
    for (const value of findEscapingRelativeReferences(text, filePath, root)) {
      defects.push(`${relative(root, filePath)} contains a relative path that escapes the project: ${value}`);
    }
  }

  const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
    for (const [name, value] of Object.entries(packageJson[section] ?? {})) {
      if (typeof value === "string" && /^(?:file:|link:|workspace:\.\.\/|[A-Za-z]:[\\/]|\/)/i.test(value)) {
        defects.push(`package.json ${section}.${name} points outside the self-contained registry dependency model: ${value}`);
      }
    }
  }

  if (defects.length > 0) throw new Error(`Project boundary check failed:\n- ${defects.join("\n- ")}`);
  return { filesChecked: (await walkProjectFiles(root)).length };
}

export function formatProjectBoundaryResult(result) {
  return `Project boundary check passed across ${result.filesChecked} files.\n`;
}

void runCli({
  direct: isDirectExecution(import.meta.url, process.argv[1]),
  task: checkProjectBoundaries,
  format: formatProjectBoundaryResult,
});
