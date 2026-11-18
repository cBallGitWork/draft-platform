import { E2E_FUNCTIONS_SETTING } from "../outbound/deploymentSettings";

// The test-only functions' one gate (spec/20, S20.17; #2288): every function in convex/e2e/ is
// internal, and refuses to run unless the deployment carries E2E_FUNCTIONS_SETTING, which only an
// e2e run's throwaway server does. A release refuses a live deployment carrying it.

/** Throws unless this deployment has the test-only functions turned on. */
export function refuseUnlessE2E(): void {
  if (!process.env[E2E_FUNCTIONS_SETTING]) {
    throw new Error(`${E2E_FUNCTIONS_SETTING} isn't set on this deployment: test-only functions run only on an e2e run's throwaway server`);
  }
}
