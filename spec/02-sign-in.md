# 2. Sign-in

Feature 2 of [SPEC.md](../SPEC.md). Only Craig's answers: the first `/grill` and
`/grill sign-in` (20 Oct 2026).

- An emailed sign-in link. No passwords.
- In the closed beta a link goes only to an email on the admin's allowed list
  ([13](13-setting-up-a-league.md#joining)). Everyone who asks gets the same "check your email"
  reply, on the list or not, so no one can tell which emails are on it. Someone who opens a
  league's invite link can sign in whether or not they're on the list, to ask to join.
- A link works once and lasts 1 hour. It can be opened on another device from the one it was
  asked for on.
- Signed in, a manager stays signed in on that device for 30 days. Sign out is in the top bar.
- One email can ask for at most 3 links an hour; past that, "try again later". When the day's
  email limit is reached, the sign-in page says links are paused until tomorrow.
- A used or expired link opens the sign-in page saying the link has expired, to send a new one.
- Signed in but in no league: a page saying so. The admin sees "Create a league" there instead;
  in the beta only the admin creates leagues (anyone can, later, when signups open).
- The page and email wording is Claude's, written plainly; Craig changes it in the pull request.
