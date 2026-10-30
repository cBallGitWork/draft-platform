// The setup command's release steps (steps.mjs runs them): what lets a merge go live and the
// after-release check sign in (#512, .github/workflows/release-check.yml).

import { ALLOW_EMAIL, GITHUB_REPO, GITHUB_REPO_URL, RELEASE_CHECK_SECRET, RESEND_RECEIVING_SUFFIX } from "./live.mjs";
import { ALREADY_DONE, DONE } from "./outcomes.mjs";
import { resendKey } from "./secrets.mjs";

const hasSecret = async (setup, name) => (await setup.tools.github.secretNames()).includes(name);

export const RELEASE_STEPS = [
  {
    // Vercel's GitHub app builds each merge, and tells GitHub when it's live.
    title: `The Vercel project's GitHub connection (${GITHUB_REPO})`,
    async run(setup) {
      const connected = await setup.tools.vercel.connectedRepo();
      if (connected?.toLowerCase() === GITHUB_REPO.toLowerCase()) return ALREADY_DONE;
      if (connected) throw new Error(`the Vercel project is connected to ${connected}, not ${GITHUB_REPO}`);
      await setup.tools.vercel.connectRepo(GITHUB_REPO_URL);
      return DONE;
    },
  },
  {
    // The after-release check starts on Vercel's `vercel.deployment.success` repository dispatch
    // event, which Vercel doesn't send while the project's disableRepositoryDispatchEvents is on
    // (#512: it was, so no check ran by itself).
    title: "Vercel tells GitHub when a release is live (repository dispatch events)",
    async run(setup) {
      const options = await setup.tools.vercel.gitProviderOptions();
      if (options.disableRepositoryDispatchEvents !== true) return ALREADY_DONE;
      await setup.tools.vercel.setGitProviderOptions({ ...options, disableRepositoryDispatchEvents: false });
      return DONE;
    },
  },
  {
    title: `The after-release check's address (GitHub's ${RELEASE_CHECK_SECRET.email}, on the live site's allowed list)`,
    async run(setup) {
      const allowed = (await setup.tools.convex.allowedEmails()).some((email) => email.endsWith(RESEND_RECEIVING_SUFFIX));
      if (allowed && (await hasSecret(setup, RELEASE_CHECK_SECRET.email))) return ALREADY_DONE;
      const question = `Paste the Resend receiving address for the check, <anything>@<id>${RESEND_RECEIVING_SUFFIX} (it won't show): `;
      const email = setup.secrets.keep((await setup.tools.askHidden(question)).trim().toLowerCase());
      if (!email.includes("@") || !email.endsWith(RESEND_RECEIVING_SUFFIX)) {
        throw new Error(`that isn't a Resend receiving address (one ends ${RESEND_RECEIVING_SUFFIX}): nothing was saved`);
      }
      await setup.tools.github.setSecret(RELEASE_CHECK_SECRET.email, email);
      await setup.tools.convex.run(ALLOW_EMAIL, { email });
      return DONE;
    },
  },
  {
    title: `The after-release check's Resend key (GitHub's ${RELEASE_CHECK_SECRET.resendKey})`,
    async run(setup) {
      if (await hasSecret(setup, RELEASE_CHECK_SECRET.resendKey)) return ALREADY_DONE;
      // The same full-access key: the check reads received emails, which only full access can.
      await setup.tools.github.setSecret(RELEASE_CHECK_SECRET.resendKey, await resendKey(setup));
      return DONE;
    },
  },
];
