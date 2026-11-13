// What a letter is about, as the approved Mail picture draws it: a square solid chip, light with
// dark ink, so it reads both in a row on a panel and on the open letter's indigo plate (plate.md,
// Never 2; approved/mail). A screen reader hears it apart from what follows: "Trade: From …".

export function KindChip({ children }: { children: string }) {
  return (
    <>
      <span className="inline-block bg-soft px-1 font-semibold text-ground">{children}</span>
      <span className="sr-only">: </span>
    </>
  );
}
