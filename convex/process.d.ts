// Convex functions read their deployment's environment variables (`npx convex env set`) from
// `process.env`, as Convex Auth does. This types only that, not the rest of Node, whose APIs
// don't exist in Convex's default runtime. The second dot keeps it out of Convex's deploy.
declare const process: { env: Record<string, string | undefined> };
