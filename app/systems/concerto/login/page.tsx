import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/systems/auth';
import { DEMO_TARGET_LOGIN } from '@/lib/demo/config';

export const dynamic = 'force-dynamic';

/**
 * Concerto's log-in screen.
 *
 * Note the vocabulary differs from Joblogic's on purpose — "User ID" not
 * "Username", "Log in" not "Sign in". The browser connector has to cope with
 * each vendor's wording rather than one house style, which is the actual
 * difficulty of screen-driven integration.
 */
export default async function ConcertoLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  if (await currentUser('concerto')) redirect(params.next || '/systems/concerto/work-orders');

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef2f7] px-4">
      <div className="w-full max-w-md">
        <div className="rounded-sm border border-[#c9d6e4] bg-white shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-[#c9d6e4] bg-[#1e4d8c] px-5 py-3">
            <div className="flex size-7 items-center justify-center rounded-sm bg-white text-xs font-bold text-[#1e4d8c]">
              C
            </div>
            <div className="leading-none">
              <p className="text-sm font-semibold text-white">Concerto</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-white/50">
                Estates &amp; Facilities
              </p>
            </div>
          </div>

          <div className="p-6">
            <h1 className="text-sm font-semibold text-[#1e3a5f]">Log in to your account</h1>
            <p className="mt-1 text-xs text-slate-500">Northgate Retail Estates</p>

            {params.error && (
              <p
                role="alert"
                className="mt-4 rounded-sm border-l-4 border-red-500 bg-red-50 px-3 py-2 text-xs text-red-800"
              >
                {params.error}
              </p>
            )}

            <form method="post" action="/systems/concerto/login/submit" className="mt-5 space-y-4">
              <input type="hidden" name="next" value={params.next ?? ''} />
              <div>
                <label htmlFor="userid" className="block text-xs font-medium text-slate-600">
                  User ID
                </label>
                <input
                  id="userid"
                  name="userid"
                  type="text"
                  autoComplete="username"
                  required
                  className="mt-1 block w-full rounded-sm border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-[#1e4d8c] focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="passphrase" className="block text-xs font-medium text-slate-600">
                  Password
                </label>
                <input
                  id="passphrase"
                  name="passphrase"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="mt-1 block w-full rounded-sm border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-[#1e4d8c] focus:bg-white focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-sm bg-[#1e4d8c] px-3 py-2 text-sm font-semibold text-white hover:bg-[#173d70]"
              >
                Log in
              </button>
            </form>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
          Stand-in system — demo data only.
          <br />
          {DEMO_TARGET_LOGIN.username} / {DEMO_TARGET_LOGIN.password}
        </p>
      </div>
    </div>
  );
}
