// A moment as the league reads it: on the Premier League's own clock, with its zone named, so an
// email and a screen say one moment the same way. No imports, so the screens can read it too.

const londonFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
});

/** "Wednesday 21 October at 10:00 BST". */
export const londonTime = (at: number) => londonFormat.format(at);
