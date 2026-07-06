export const CHECKOUT_PLAN_KEY = 'pending_checkout_plan';
export const CHECKOUT_DRAFT_KEY = 'checkout:v1';

export function clearPendingCheckout() {
  try {
    sessionStorage.removeItem(CHECKOUT_PLAN_KEY);
    sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
  } catch {
    // sessionStorage can be unavailable in some embedded browsers.
  }
}
