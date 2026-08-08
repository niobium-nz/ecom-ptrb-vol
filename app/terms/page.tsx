import { PolicyShell } from "@/components/layout/policy-shell";
import { readPolicySource } from "@/lib/legal-content";

export default function TermsPage() {
  const content = readPolicySource("terms");
  return (
    <PolicyShell title="Terms">
      <div className="policy-source" data-policy-source="terms">
        {content}
      </div>
    </PolicyShell>
  );
}
