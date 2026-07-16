import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/systems/auth';
import { DEMO_SOURCE_LOGIN } from '@/lib/demo/config';

export const dynamic = 'force-dynamic';

/**
 * Joblogic's sign-in screen.
 *
 * A plain <form method="post"> to a route handler rather than a Server Action:
 * the browser transport has to get through this the way any client would, and a
 * standard form post is what a vendor's login actually is. No JavaScript is
 * required to sign in.
 */
export default async function JoblogicLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  if (await currentUser('joblogic')) redirect(params.next || '/systems/joblogic/jobs');

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#101828] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded bg-[#f97316] font-bold text-white">
            J
          </div>
          <div>
            <p className="text-lg font-semibold leading-none text-white">Joblogic</p>
            <p className="mt-1 text-[11px] uppercase tracking-widest text-white/40">
              Job management
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-2xl">
          <h1 className="text-base font-semibold text-[#101828]">Sign in</h1>
          <p className="mt-1 text-xs text-slate-500">Meridian Facilities Group</p>

          {params.error && (
            <p
              role="alert"
              className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {params.error}
            </p>
          )}

          <form method="post" action="/systems/joblogic/login/submit" className="mt-5 space-y-4">
            <input type="hidden" name="next" value={params.next ?? ''} />
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-slate-700">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded bg-[#f97316] px-3 py-2 text-sm font-semibold text-white hover:bg-[#ea6a09]"
            >
              Sign in
            </button>
          </form>
        </div>

        {/* This is a stand-in guarding fabricated data. Printing the credentials
            on the login screen is a feature: it makes the demo self-explanatory
            and removes any doubt that something real is behind it. */}
        <p className="mt-4 text-center text-[11px] leading-relaxed text-white/35">
          Stand-in system — demo data only.
          <br />
          {DEMO_SOURCE_LOGIN.username} / {DEMO_SOURCE_LOGIN.password}
        </p>
      </div>
    </div>
  );
}
