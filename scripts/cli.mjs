import { pathToFileURL } from "node:url";

export function isDirectExecution(moduleUrl, argvEntry) {
  return moduleUrl === pathToFileURL(String(argvEntry)).href;
}

export async function runCli({ direct, task, format, stdout = process.stdout, stderr = process.stderr, processRef = process }) {
  if (!direct) return false;
  try {
    stdout.write(format(await task()));
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    processRef.exitCode = 1;
  }
  return true;
}
