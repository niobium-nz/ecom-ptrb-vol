import { PolicyShell } from "@/components/layout/policy-shell";
import { readPolicySource } from "@/lib/legal-content";

export default function PrivacyPolicyPage() {
  const content = readPolicySource("privacy_policy");
  return (
    <PolicyShell title="Privacy policy">
      <div className="policy-source" data-policy-source="privacy_policy">
        {content}
      </div>
    </PolicyShell>
  );
}
