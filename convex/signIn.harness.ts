/// <reference types="vite/client" />
// Sign-in's tests' shared setup: the deployment's settings, a faked Resend that keeps what it was
// asked to send, and a link's code redeemed as the browser does. For the tests only: the second
// dot in this file's name keeps it out of Convex's deploy.

import { convexTest, type TestConvex as TestConvexOf } from "convex-test";
import { vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { RESEND_EMAILS_URL } from "./signInEmail";

export type TestConvex = TestConvexOf<typeof schema>;

export const modules = import.meta.glob("./**/*.ts");

export const ADMIN = "craig@example.com";
export const LISTED = "manager@example.com";
export const UNLISTED = "stranger@example.com";
export const SITE_URL = "https://draft.example.com";

/** A key Convex Auth signs its tokens with, made once per test file: making one is slow. */
let signingKey: Promise<string> | undefined;

async function makePkcs8PrivateKey(): Promise<string> {
  const { privateKey } = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", privateKey));
  return `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----`;
}

/** A deployment with the settings `npx @convex-dev/auth` and Craig put on one, LISTED on the
 *  list, and the clock stopped at a known morning. `resetSignInDeployment` undoes it all. */
export async function signInDeployment(): Promise<TestConvex> {
  vi.useFakeTimers({ now: new Date("2026-10-20T09:00:00Z") });
  vi.stubEnv("SITE_URL", SITE_URL);
  vi.stubEnv("CONVEX_SITE_URL", "https://deployment.example.com");
  signingKey ??= makePkcs8PrivateKey();
  vi.stubEnv("JWT_PRIVATE_KEY", await signingKey);
  vi.stubEnv("ADMIN_EMAIL", ADMIN);
  vi.stubEnv("AUTH_RESEND_KEY", "re_test_key");
  // Convex Auth logs every store call at INFO; its warnings and errors still show.
  vi.stubEnv("AUTH_LOG_LEVEL", "WARN");
  const t = convexTest(schema, modules);
  await t.mutation(internal.allowedEmails.add, { email: LISTED });
  return t;
}

export function resetSignInDeployment() {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}

export type SentEmail = { to: string; subject: string; text: string };

/** Resend answering every send with `status`, and the emails it was asked to send. */
export function fakeResend(status = 200): SentEmail[] {
  const sent: SentEmail[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url !== RESEND_EMAILS_URL) throw new Error(`no fake for ${url}`);
      sent.push(JSON.parse(String(init.body)));
      return status === 200 ? Response.json({ id: "email-id" }) : new Response("refused", { status });
    }),
  );
  return sent;
}

export const ask = (t: TestConvex, email: string) => t.action(api.signInLinks.ask, { email });

/** The code in an email's link, as the browser finds it in the address bar. */
export function linkCode(email: SentEmail): string {
  const link = email.text.split("\n").find((line) => line.startsWith(SITE_URL));
  const code = link && new URL(link).searchParams.get("code");
  if (!code) throw new Error(`no link with a code in: ${email.text}`);
  return code;
}

/** Opens a link as the browser does: its code, with no provider. Its tokens, or null if refused. */
export async function openLink(t: TestConvex, code: string) {
  const { tokens } = await t.action(api.auth.signIn, { params: { code } });
  return tokens ?? null;
}
