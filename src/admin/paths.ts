/** The admin's dashboard (#87, spec/15 The admin): the positions queue and corrections. */
export const ADMIN_PATH = "/admin";
/** The dashboard's feeds page (#35, spec/15 The admin): a tab of it. */
export const ADMIN_FEEDS_PATH = `${ADMIN_PATH}/feeds`;
/** The dashboard's Feedback tab (#357, spec/15 The admin): what managers sent. */
export const ADMIN_FEEDBACK_PATH = `${ADMIN_PATH}/feedback`;
/** The dashboard's Availability tab (#1209, spec/06 Availability): setting a player's by hand. */
export const ADMIN_AVAILABILITY_PATH = `${ADMIN_PATH}/availability`;
/** The dashboard's Guide tab (spec/23 S23.13): editing the Guide's sections and entries. */
export const ADMIN_GUIDE_PATH = `${ADMIN_PATH}/guide`;

/** Where the dashboard sends the admin to read up on a player: a web search on one site each. */
const WEB_SEARCH_URL = "https://www.google.com/search";
export const siteSearchUrl = (site: string, text: string) => `${WEB_SEARCH_URL}?q=${encodeURIComponent(`site:${site} ${text}`)}`;
export const READING_SITES = { transfermarkt: "transfermarkt.co.uk", fotMob: "fotmob.com", understat: "understat.com" } as const;
