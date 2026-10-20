// What the top bar tells a signed-in manager: Mail's unread count, and where Continue goes.
// Nothing feeds it yet: Mail (#26) and the things Continue looks for (spec/12) aren't built,
// so a real session gets the empty one.

export type NextStep = { path: string; reason: string };
export type TopBarState = { unreadMail: number; next: NextStep | null };

export const emptyTopBar: TopBarState = { unreadMail: 0, next: null };
