import { v, type Infer } from "convex/values";

// What the sign-in page tells the visitor (spec/02), apart from signInLinks.ts so the schema can hold
// a reply without importing the actions that make one (#152).

/** The replies that mean no link went. */
export const noLinkReply = v.union(v.literal("tryLater"), v.literal("paused"), v.literal("notSent"));
export type NoLinkReply = Infer<typeof noLinkReply>;
/** What the sign-in page tells the visitor. `checkYourEmail` goes to listed and unlisted alike. */
export const signInReply = v.union(v.literal("checkYourEmail"), ...noLinkReply.members);
export type SignInReply = Infer<typeof signInReply>;
