export const PLAN_SLUGS = {
  FREE: 'free',
  PRO: 'pro',
} as const;

export type PlanSlug = (typeof PLAN_SLUGS)[keyof typeof PLAN_SLUGS];
