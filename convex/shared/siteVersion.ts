/** The version of the server's public functions an open tab's code was built to work with
 *  (spec/12, The frame, S12.13). The site and the server release together, so a tab built now
 *  holds this number, and `release/version:current` answers with the number the server holds
 *  now: a tab whose number is behind shows the "A new version is out" bar and sends no saves.
 *
 *  Add one in the release that changes a public function so an open tab's code can't work with
 *  it: a query's answer reshaped, or a save's meaning changed. A function removed or its
 *  arguments changed is caught without it, as the server refuses the call
 *  (src/shared/newVersion.ts), but only once a tab calls it. */
export const SITE_VERSION = 1;
