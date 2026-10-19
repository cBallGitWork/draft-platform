/** A page the menu reaches before its screen is built: its title plate, and a plain line saying so. */
export function PageNotBuilt({ title }: { title: string }) {
  return (
    <section aria-labelledby="page-title" className="max-w-xl bg-panel">
      <h1 id="page-title" className="bg-plate px-4 py-1 text-title font-bold shadow-bevel-plate">
        {title}
      </h1>
      <p className="px-3 py-2 text-muted">This screen isn't built yet.</p>
    </section>
  );
}
