// The address a visitor asked for before signing in, which their sign-in link leads back to
// (UI-063, UI-064): pure, so the sign-in page and the link's ask read the same rule.

/** `path` when it is an address in this app (one leading slash, never "//" or "/\", which a browser
 *  reads as another site), else undefined. */
export function appPathOrNone(path: unknown): string | undefined {
  return typeof path === "string" && /^\/(?![/\\])/.test(path) ? path : undefined;
}
