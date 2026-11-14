// The nightly suites: test runs too long for a pull request's wait (the season simulation, long random-input runs,
// the random clicker). verify.yml's `nightly` job runs `npm run nightly` on main once a night and by hand
// (`gh workflow run verify.yml --ref <branch>`), and a failure opens or comments on the `nightly-ci` issue.
// A build adds its suite to NIGHTLY_SUITES here, never to the workflow, which builds can't edit (testing plan v3,
// 14 Nov 2026: #2126, #2132, #2138). Each suite prints its seed, so a failure replays. Every suite runs, a failed one
// included, and the run fails if any did.
import { spawnSync } from 'node:child_process';

/** Each nightly suite: its name and the command that runs it, as [program, ...arguments]. */
const NIGHTLY_SUITES = [];

if (NIGHTLY_SUITES.length === 0) {
  console.log('No nightly suites yet: a build adds one to NIGHTLY_SUITES in scripts/nightly.mjs.');
}

const failed = [];
for (const { name, command } of NIGHTLY_SUITES) {
  console.log(`\n== ${name}: ${command.join(' ')}`);
  const started = Date.now();
  const { status, error } = spawnSync(command[0], command.slice(1), { stdio: 'inherit' });
  const seconds = Math.round((Date.now() - started) / 1000);
  if (error || status !== 0) {
    failed.push(name);
    console.log(`== ${name} failed after ${seconds} s${error ? `: ${error.message}` : ''}`);
  } else {
    console.log(`== ${name} passed in ${seconds} s`);
  }
}

if (failed.length > 0) {
  console.error(`\nNightly suites failed: ${failed.join(', ')}`);
  process.exit(1);
}
