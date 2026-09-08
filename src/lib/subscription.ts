export type SubscriptionState = "active" | "cancelled" | "expired";

export type Subscription = {
  id: string;
  creatorCommitment: string;
  memberCommitment: string;
  periodEndsAt: number;
  prepaidPeriods: number;
  state: SubscriptionState;
  creatorClaimedPeriods: number;
};

export const MAX_PREPAID_PERIODS = 3;

export function startSubscription(input: Omit<Subscription, "prepaidPeriods" | "state" | "creatorClaimedPeriods">): Subscription {
  if (!input.creatorCommitment || !input.memberCommitment) throw new Error("ROLE_COMMITMENT_REQUIRED");
  return { ...input, prepaidPeriods: 1, state: "active", creatorClaimedPeriods: 0 };
}

export function prepay(subscription: Subscription, periods: number): Subscription {
  if (subscription.state !== "active") throw new Error("SUBSCRIPTION_NOT_ACTIVE");
  if (!Number.isInteger(periods) || periods < 1 || subscription.prepaidPeriods + periods > MAX_PREPAID_PERIODS) throw new Error("PREPAY_BOUND_EXCEEDED");
  return { ...subscription, prepaidPeriods: subscription.prepaidPeriods + periods };
}

export function cancel(subscription: Subscription): Subscription {
  if (subscription.state !== "active") throw new Error("CANCELLATION_NOT_ALLOWED");
  return { ...subscription, state: "cancelled" };
}

export function expire(subscription: Subscription, now: number): Subscription {
  if (subscription.state !== "active") throw new Error("EXPIRY_NOT_ALLOWED");
  if (now < subscription.periodEndsAt) throw new Error("PERIOD_NOT_EXPIRED");
  return { ...subscription, state: "expired" };
}

export function claimCreatorPeriod(subscription: Subscription): Subscription {
  if (subscription.prepaidPeriods <= subscription.creatorClaimedPeriods) throw new Error("NO_CLAIMABLE_PERIOD");
  return { ...subscription, creatorClaimedPeriods: subscription.creatorClaimedPeriods + 1 };
}
