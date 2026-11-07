## What

A manager now picks one attacking and one defensive team instruction on the Tactics tab, from two pickers side by side where the one "Team tactic" placeholder was ("Attacking", "Defending"). Each picker offers only what the formation's shape allows, following Craig's answers on #990: only the defence row counts as the back, a winger stands wide in attacking midfield or attack, wide means both flanks filled above the defence, and Press high counts one row at a time. The lineup saves the pair, and the server refuses a pair the shape blocks.

When the formation changes, a pick the new shape allows stays. A pick it blocks switches to the new formation's default, and the line under the toolbar says so ("Park the bus needs 5 at the back: switched to Keep it tight early"). The right column's box becomes "<formation> unlocks", listing each side's offered instructions with what they reward and cost.

The set of instructions, their descriptions and each preset's default pair are league rules (`FIRST_RULES.instructions`, `presets[].instructions`), and the league rules check covers them. They are never constants. Rules saved before this read the first set.

Left for later (stories 3 and 4): scoring each instruction player by player, and the two-at-the-back clean sheet +3 / goal conceded −1. Both wait on #10, which is still open. "Loading a plan or picking a classic sets both" also waits, because saved plans and classics are still placeholders on main.

No comment on the issue tried to steer this build.

## Approved vs built
/team (Tactics tab):
1. Structure: the toolbar wraps onto two rows. Undo (and an empty box beside it) drop below Presets. The picture holds Formation, All formations, Team tactic, Presets, Save preset… and Undo/Quick Pick on one row.
2. Missing: Save preset… and Quick Pick are not drawn. In their places are empty outlined boxes with no label.
3. Missing: the three preset keys (4-2-3-1 balanced, 4-3-3 press, 5-3-2 sit deep) are not drawn. One wide empty box stands in for the row.
4. Columns: the picture's single "Team tactic" button is now two pickers, Attacking and Defending. This is the change Craig asked for ("two pickers side by side where the one is"), so it is intended.
5. Type: the pickers are native `<select>` boxes with the browser's chevron. The picture's Team tactic control is a custom outlined button with a ▾.
6. Missing: no banner for the switched instruction under the toolbar, because the preview does not trigger one. The picture has no such line, so this is new.
7. Structure: the right column lists Attacking and Defending instructions in small body text. The picture shows one large featured tactic ("Double pivot screen") with its "Affects Caicedo, Rice" line, a "Free number 10" sub-line and a Penalty line.
8. Colour: the picked instruction is marked with a plain "Picked" word. The picture marks the chosen tactic with a pink diamond.
9. Structure: the Pitch title bar has no pink-diamond tactic name beside "4-2-3-1". The picture has "Pitch 4-2-3-1 ◆ Double pivot screen".
10. Structure: the squad table has 11 starters and 4 bench rows. The picture has 11 starters and 9 bench rows (S1 to S9).
11. Missing: the table has no Role fit column on the starters showing the picture's coloured Next-opponent cells, and the Role column is a native `<select>`, not the picture's Role ▾ text buttons.
12. Missing: Lineup check is an empty box. The picture lists four items under "4 to look at".
13. Density: rows draw about 28px, and the squad table is shorter overall, but the picture's rows are the same height. The page also adds an orange patch-notes banner and a Feedback link that the picture does not have.
14. Colour: the header plate, the top-bar tab styling and the sign-in button area differ from the picture. These differ in both layout and look, and I did not trace them to this branch.

*Verifier: ui-verifier (Sonnet 5.5), 2026-11-07, origin/main..wip/issue-990-42314507684*

Part of #990

🤖 Generated with [Claude Code](https://claude.com/claude-code)
