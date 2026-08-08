import { PolicyShell } from "@/components/layout/policy-shell";
import { readPolicySource } from "@/lib/legal-content";

export default function ShippingPolicyPage() {
  const content = readPolicySource("shipping_policy");
  return (
    <PolicyShell title="Shipping policy">
      <div className="policy-source" data-policy-source="shipping_policy">
        {content}
      </div>
    </PolicyShell>
  );
}
