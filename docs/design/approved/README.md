# Approved pictures

Each screen Craig has approved has a folder here, and its picture binds that screen's layout
(`CLAUDE.md`, Decided; `.claude/rules/ui.md`, Approved pictures). The look's values stay in
[plate.md](../plate.md) and `src/styles.css`; where a picture and plate.md disagree, ask Craig.

Structure first: every page is designed and built for what it holds and where things sit, then
Craig goes back over the look (Craig, 1 Nov 2026: "once we design all the apges as in the
code/structure im happy to then go back and look at designs again").

Claude draws each screen on the "Draft Manager screens" canvas
(<https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>), which also holds the site flow, through the
`/design` skill (`.claude/skills/design/SKILL.md`): a brief, a review panel of four, then Craig's
yes. Craig comments there until he says it's right.

Desktop first (Craig, 1 Nov 2026: "focus on desktop for now, mobile can wait"): a picture is the
desk's, 1440 wide. The phone's is drawn when Craig asks for it. A built screen still must not break
at 390: the `ui-verifier` agent shoots it there and checks for sideways scroll and clipping.

## A screen's folder

Named after its route: `team` for `/team`, `team-squad` for `/team/squad`.

- `1440.png`: the approved picture at the desk's width.
- `390.png`: the phone's, only once Craig has asked for the phone.
- `<Name>.dc.html`: the approved board's source from the canvas, saved from 1 Nov 2026 on, so the
  picture can be redrawn if the canvas changes.
- `README.md`:
  - `Route:` the route it shows, with the preview it's checked on (`/team?preview=manager`);
  - the date and Craig's words approving it;
  - the Football Manager idea it borrows: its organisation, never its colours;
  - interaction notes, one line per control: what can be tapped and what happens;
  - each placeholder, the data it waits for, and that data's issue;
  - the canvas link.

## Screens

- [`team`](team/README.md): My team's Tactics tab (1 Nov 2026).
- The formation window, opened from the Tactics tab's All formations; its pictures are in `team`
  (1 Nov 2026).
- [`team-squad`](team-squad/README.md): My team's Squad tab (1 Nov 2026).
