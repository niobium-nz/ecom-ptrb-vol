import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { POLICY_SOURCE_FILES, readPolicySource } from "@/lib/legal-content";

const expected = {
  privacy_policy: {
    path: "content/policies/privacy-policy.md",
    bytes: 6716,
    sha256: "f3dc361989f0ccca8e1de67fd9d50266902c6faf1651bc339d91e7a09544e0fb",
  },
  terms: {
    path: "content/policies/terms.md",
    bytes: 14689,
    sha256: "f494e1b237967c05384546292047de274d87f1d9412e2b032248d713890a5d8a",
  },
  returns_policy: {
    path: "content/policies/returns-policy.md",
    bytes: 994,
    sha256: "7647a61bae44ddcfde4618559070c235524d6d400d7d5cd68d7cca2d1854fe82",
  },
  shipping_policy: {
    path: "content/policies/shipping-policy.md",
    bytes: 1044,
    sha256: "274737785e0059732b73e2a4eb34d05aaae6f5588a9b516f0f4d1d88d6d56110",
  },
} as const;

describe("binding legal policy content", () => {
  for (const [key, entry] of Object.entries(expected)) {
    it(`binds ${entry.path} byte for byte`, () => {
      const policyKey = key as keyof typeof expected;
      expect(POLICY_SOURCE_FILES[policyKey]).toBe(entry.path);
      const bytes = readFileSync(entry.path);
      expect(bytes.byteLength).toBe(entry.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
      expect(readPolicySource(policyKey)).toBe(bytes.toString("utf8"));
    });
  }
});
