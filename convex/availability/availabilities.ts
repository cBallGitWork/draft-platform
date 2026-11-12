// The availabilities a player can hold (spec/06, Availability), as a plain list: the schema builds
// its validator from it and the admin's screen offers it, so a new one reaches both. Kept free of
// the server and of convex/schema/, as the screens import it.

export const AVAILABILITIES = ["out", "doubtful", "available"] as const;
