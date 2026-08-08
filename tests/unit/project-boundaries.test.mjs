import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findAbsoluteLocalReferences, findEscapingRelativeReferences } from "../../scripts/check-project-boundaries.mjs";

const root = resolve("fixture-project");
const testFile = resolve(root, "tests", "a.ts");

describe("project boundary helpers", () => {
  it("detects Unix, Windows, and file URL references without embedding machine paths in the test itself", () => {
    const unixPath = `/${["home", "user", "logo.svg"].join("/")}`;
    const separator = String.fromCharCode(92);
    const windowsPath = ["C:", "temp", "logo.svg"].join(separator);
    const fileUrl = `file:///${["mnt", "data", "logo.svg"].join("/")}`;
    expect(findAbsoluteLocalReferences(`const a = ${JSON.stringify(unixPath)}; const b = ${JSON.stringify(windowsPath)};`)).not.toEqual([]);
    expect(findAbsoluteLocalReferences(`const a = ${JSON.stringify(fileUrl)};`)).not.toEqual([]);
  });

  it("accepts project-relative paths and rejects relative paths that escape", () => {
    const insideReference = ["..", "assets", "logo.svg"].join("/");
    const escapingReference = ["..", "..", "..", "outside", "logo.svg"].join("/");
    expect(findEscapingRelativeReferences(`const a = ${JSON.stringify(insideReference)};`, testFile, root)).toEqual([]);
    expect(findEscapingRelativeReferences(`const a = ${JSON.stringify(escapingReference)};`, testFile, root)).not.toEqual([]);
  });
});
