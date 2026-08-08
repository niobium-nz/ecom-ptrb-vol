import { PolicyShell } from "@/components/layout/policy-shell";
import { readPolicySource } from "@/lib/legal-content";

export default function ReturnsPolicyPage() {
  const content = readPolicySource("returns_policy");
  return (
    <PolicyShell title="Returns policy">
      <div className="policy-source" data-policy-source="returns_policy">
        {content}
      </div>
    </PolicyShell>
  );
}
