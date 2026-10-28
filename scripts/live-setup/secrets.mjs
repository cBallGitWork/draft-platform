// The setup command's secrets: the keys it makes, and the keeper that hides every secret it has
// touched in anything about to be printed (spec/20: no secret is ever printed).

import { generateKeyPairSync } from "node:crypto";
import { RESEND_KEY_PREFIX, SETTING } from "./live.mjs";

/** What stands in for a secret in anything printed. */
export const HIDDEN = "[hidden]";
/** A secret's pieces (split on whitespace) this long or longer are hidden too, so a tool that
 *  prints part of one, such as a line of a key, still shows none of it. */
const SHORTEST_HIDDEN_PIECE = 8;
/** Convex Auth's key: RS256, as `npx @convex-dev/auth` makes it. */
const RSA_KEY_BITS = 2048;

/** Keeps every secret the run has touched, and hides each in text about to be printed. */
export function secretKeeper() {
  const hidden = new Set();
  return {
    keep(secret) {
      for (const piece of [secret, ...secret.split(/\s+/)]) {
        if (piece.length >= SHORTEST_HIDDEN_PIECE) hidden.add(piece);
      }
      return secret;
    },
    hide(text) {
      // Longest first, so a whole secret goes before any piece of it.
      return [...hidden]
        .sort((a, b) => b.length - a.length)
        .reduce((out, piece) => out.split(piece).join(HIDDEN), String(text));
    },
  };
}

/** Convex Auth's two keys, made as `npx @convex-dev/auth` makes them (its cli/generateKeys.ts):
 *  the private key as PKCS#8 PEM with its line breaks as spaces, and the public key as a JWKS. */
export function signInKeys() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: RSA_KEY_BITS });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  return {
    [SETTING.jwtPrivateKey]: pem.trimEnd().replace(/\n/g, " "),
    [SETTING.jwks]: JSON.stringify({ keys: [{ use: "sig", ...publicKey.export({ format: "jwk" }) }] }),
  };
}

/** A pasted key, kept as a secret, or a refusal that names what was wrong and never the key. */
export async function pastedKey(setup, question, prefix) {
  const key = setup.secrets.keep((await setup.tools.askHidden(question)).trim());
  if (!key.startsWith(prefix)) throw new Error(`that key doesn't start with "${prefix}", so it isn't the one asked for: nothing was saved`);
  return key;
}

/** Resend's API key: the one pasted this run, or the one already on the live deployment. */
export async function resendKey(setup) {
  setup.resendKey ??= (await setup.convexNames()).includes(SETTING.resendKey)
    ? setup.secrets.keep(await setup.tools.convex.getSetting(SETTING.resendKey))
    : await pastedKey(setup, "Paste the Resend API key, full access (it won't show): ", RESEND_KEY_PREFIX);
  return setup.resendKey;
}
