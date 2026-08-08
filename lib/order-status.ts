export type OrderStatusView = "success" | "failure" | "unknown";

export function interpretRedirectStatus(value: string | null | undefined): OrderStatusView {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "succeeded") return "success";
  if (normalized === "failed") return "failure";
  return "unknown";
}
