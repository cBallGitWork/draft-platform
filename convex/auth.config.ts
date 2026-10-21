// Convex checks a signed-in browser's token against this: Convex Auth issues it from the
// deployment's own site URL (convex/http.ts serves the keys).
export default {
  providers: [{ domain: process.env.CONVEX_SITE_URL, applicationID: "convex" }],
};
