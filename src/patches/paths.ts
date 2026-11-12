/** The patch notes: every version of the site's scoring and what it changed (#356, spec/14 Changes
 *  and corrections), for anyone signed in. */
export const PATCH_NOTES_PATH = "/patch-notes";

/** The id of a version's heading on the patch notes, which a link's hash jumps to. */
export const versionAnchor = (name: string) => `version-${name}`;
