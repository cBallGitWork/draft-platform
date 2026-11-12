// The address a smoke test opens a screen at as a preview person (src/app/preview.ts reads the
// `?preview=` name), written once so no spec types the parameter by hand (#1810).

/** `path` opened as the preview `session` ("manager", "commissioner", "admin", "visitor"), kept
 *  beside any query `path` already holds: `/matchup?minute=60` becomes `/matchup?minute=60&preview=manager`. */
export const previewUrl = (path: string, session: string) => `${path}${path.includes("?") ? "&" : "?"}${new URLSearchParams({ preview: session })}`;
