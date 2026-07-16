import Link from 'next/link';

/**
 * Concerto's shell: light, blue, boxy, sidebar-led, "work orders / assets /
 * property" vocabulary. Deliberately a different species of software from
 * Joblogic's dark orange header — a viewer should never have to be told these
 * are two systems.
 */
export function ConcertoChrome({
  user,
  title,
  breadcrumb,
  children,
}: {
  user: { displayName: string; username: string };
  title: string;
  breadcrumb?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#eef2f7]">
      <header className="border-b border-[#c9d6e4] bg-white">
        <div className="flex items-center gap-4 px-5 py-2.5">
          <Link href="/systems/concerto/work-orders" className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-sm bg-[#1e4d8c] text-xs font-bold text-white">
              C
            </div>
            <div className="leading-none">
              <span className="text-sm font-semibold text-[#1e4d8c]">Concerto</span>
              <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-400">
                Estates &amp; Facilities
              </span>
            </div>
          </Link>
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            <span>{user.displayName}</span>
            <form method="post" action="/systems/concerto/logout">
              <button type="submit" className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden w-52 shrink-0 border-r border-[#c9d6e4] bg-white md:block">
          <nav className="p-2 text-xs">
            {[
              { label: 'Work Orders', href: '/systems/concerto/work-orders', active: true },
              { label: 'Assets', href: '/systems/concerto/work-orders' },
              { label: 'Property', href: '/systems/concerto/work-orders' },
              { label: 'Contractors', href: '/systems/concerto/work-orders' },
              { label: 'Reports', href: '/systems/concerto/work-orders' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`block rounded-sm px-3 py-2 ${
                  item.active
                    ? 'bg-[#1e4d8c] font-medium text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-5">
          {breadcrumb && <p className="mb-1 text-[11px] text-slate-400">{breadcrumb}</p>}
          <h1 className="mb-4 text-lg font-semibold text-[#1e3a5f]">{title}</h1>
          {children}
          <p className="mt-8 text-[11px] text-slate-400">
            Stand-in system for the ProofSync demo. Not affiliated with, and not a copy of, any real
            product. All data here is fabricated.
          </p>
        </main>
      </div>
    </div>
  );
}
