// What each of the setup command's steps says it did (steps.mjs prints one per step).

export const ALREADY_DONE = "already done";
export const DONE = "done";
/** What a step that is waiting on someone else (Resend's check of the DNS) reports. */
export const NOT_YET = "not yet";
export const FAILED = "failed";
