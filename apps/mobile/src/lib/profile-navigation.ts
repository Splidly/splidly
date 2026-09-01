type ProfileNavigationQuery = {
  data?: { onboardedAt?: unknown } | undefined;
  error?: unknown | undefined;
  isPending: boolean;
};

export function profileNavigationState(
  profile: ProfileNavigationQuery,
): "pending" | "error" | "onboarding" | "ready" {
  if (profile.isPending) return "pending";
  if (profile.error) return "error";
  return profile.data?.onboardedAt ? "ready" : "onboarding";
}
