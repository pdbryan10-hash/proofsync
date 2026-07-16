import Link from 'next/link';

/**
 * Joblogic's shell: dark header, orange accent, "jobs / engineers / sheets"
 * vocabulary. Its whole job is to look like a different piece of software from
 * Concerto's shell, so a viewer never has to be told these are two systems.
 */
export function JoblogicChrome({
  user,
  title,
  children,
}: {
  user: { displayName: string; username: string };
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-[#101828]">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
          <Link href="/systems/joblogic/jobs" className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded bg-[#f97316] text-sm font-bold text-white">
              J
            </div>
            <span className="text-sm font-semibold text-white">Joblogic</span>
          </Link>

          <nav className="flex items-center gap-1 text-xs">
            {[
              { label: 'Jobs', href: '/systems/joblogic/jobs' },
              { label: 'Engineers', href: '/systems/joblogic/jobs' },
              { label: 'Completion sheets', href: '/systems/joblogic/jobs?status=Complete' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded px-2.5 py-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-xs text-white/60">
            <span>{user.displayName}</span>
            <form method="post" action="/systems/joblogic/logout">
              <button type="submit" className="rounded px-2 py-1 hover:bg-white/10 hover:text-white">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <h1 className="mb-4 text-xl font-semibold text-[#101828]">{title}</h1>
        {children}
      </main>

      <footer className="mx-auto max-w-6xl px-5 pb-8 text-[11px] text-slate-400">
        Stand-in system for the ProofSync demo. Not affiliated with, and not a copy of, any real
        product. All data here is fabricated.
      </footer>
    </div>
  );
}
