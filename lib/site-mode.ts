/**
 * Gated-preview mode.
 *
 * The interactive live-sync demo is only ever shown in a 1:1 call. On the public
 * (gated) build we therefore REMOVE the self-serve demo: every "Watch it sync"
 * CTA books a call instead, and /demo redirects to /book with a blurred tease of
 * the product behind it. The same repo still serves the full working demo when
 * the flag is off (the demo project used to drive those 1:1 calls).
 *
 * Driven by a build-time public flag so it can differ per Vercel project with no
 * code fork: set NEXT_PUBLIC_GATED_PREVIEW=1 on the preview project only.
 */
export const GATED_PREVIEW = process.env.NEXT_PUBLIC_GATED_PREVIEW === '1';

/** Where "Watch it sync — live" points: the demo, or a booked 1:1 when gated. */
export const WATCH_HREF = GATED_PREVIEW ? '/book' : '/demo';
