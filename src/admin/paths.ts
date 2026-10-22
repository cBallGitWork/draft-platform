/** The admin's dashboard (#87, spec/15 The admin): the positions queue and corrections. */
export const ADMIN_PATH = "/admin";
/** The dashboard's feeds page (#35, spec/15 The admin): a tab of it. */
export const ADMIN_FEEDS_PATH = `${ADMIN_PATH}/feeds`;

/** Where the dashboard sends the admin to read up on a player: a web search on one site each. */
const WEB_SEARCH_URL = "https://www.google.com/search";
export const siteSearchUrl = (site: string, text: string) => `${WEB_SEARCH_URL}?q=${encodeURIComponent(`site:${site} ${text}`)}`;
export const READING_SITES = { transfermarkt: "transfermarkt.co.uk", fotMob: "fotmob.com", understat: "understat.com" } as const;
