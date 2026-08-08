import { readFileSync } from "node:fs";
import { join } from "node:path";

export const POLICY_SOURCE_FILES = {
  privacy_policy: "content/policies/privacy-policy.md",
  terms: "content/policies/terms.md",
  returns_policy: "content/policies/returns-policy.md",
  shipping_policy: "content/policies/shipping-policy.md",
} as const;

export type PolicySourceKey = keyof typeof POLICY_SOURCE_FILES;

export function readPolicySource(policy: PolicySourceKey): string {
  return readFileSync(join(process.cwd(), POLICY_SOURCE_FILES[policy]), "utf8");
}
