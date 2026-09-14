/**
 * User-facing plan names, keyed by the SubscriptionPlan enum value.
 *
 * The internal identifier for the top tier is still `TEAM` (Prisma enum,
 * `STRIPE_TEAM_PRICE_ID`, `?plan=team` checkout key, Stripe session
 * metadata). It is marketed as "Pro" — a higher-usage tier for a single
 * user, not a multi-seat product. Renaming the enum would require a DB
 * migration and would break any Checkout Session already created with
 * `metadata.plan = "team"`, so only the label changes. Import this wherever
 * a plan name is shown so the copy can't drift between surfaces.
 */
export const PLAN_LABELS: Record<string, string> = {
  FREE: "Free",
  CREATOR: "Creator",
  TEAM: "Pro",
};

export function planLabel(plan: string | null | undefined): string {
  if (!plan) return "…";
  return PLAN_LABELS[plan] ?? plan.charAt(0) + plan.slice(1).toLowerCase();
}
