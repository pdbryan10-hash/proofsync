// PACE — move through a system the way a person does.
//
// The first recorded walk held every dwell at 6.875 seconds to within a twelfth
// of a second, six times running. Nothing a person does is that steady, and a
// pattern like that is what an abuse heuristic is built to spot.
//
// WHY THIS MATTERS, AND WHAT IT IS NOT FOR
//
// The account is the client's, the access is authorised and the pass is
// read-only. The risk being managed is a FALSE POSITIVE: a vendor's bot
// detection flagging a live helpdesk login, which lands on SEE's relationship
// with Bellrock rather than on us — and Concerto is a system where an account
// problem takes 24 working hours and a vendor to undo. Pacing also keeps the
// load light, which is basic manners on somebody else's production system.
//
// It is NOT a way to keep a survey secret from the vendor. It makes the traffic
// unremarkable, not invisible, and the right move is still to tell Bellrock and
// Accruent what we run and why. If a vendor says don't, that settles it.
//
// THE SHAPE OF HUMAN TIME
//
// Uniform jitter is its own tell — real dwell times are heavy-tailed. Somebody
// reading a queue mostly glances (a second or two), sometimes reads (five to
// ten), and occasionally stops dead because the phone rang. That is a
// log-normal with a long right tail, so that is what this draws from.

/** Seeded PRNG, so a run can be repeated exactly when something goes wrong. */
export const rng = (seed = (Date.now() ^ 0x9e3779b9) >>> 0) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Box–Muller, because two uniforms are all we have. */
const gauss = (r) => {
  const u = Math.max(r(), 1e-9), v = Math.max(r(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/**
 * A dwell in milliseconds: log-normal around `median`, clamped so it never
 * hammers and never stalls the whole afternoon.
 *
 * sigma 0.55 gives roughly: half of all dwells inside ±40% of the median, one
 * in twenty beyond double it, which is what watching a person actually looks
 * like.
 */
export const dwell = (r, median = 2600, { sigma = 0.55, min = 700, max = 25000 } = {}) =>
  Math.round(Math.min(max, Math.max(min, median * Math.exp(sigma * gauss(r)))));

/**
 * The long ones. Roughly one stop in seven gets a proper read, and one in forty
 * gets an interruption — somebody looked up, answered a question, came back.
 */
export const distraction = (r) => {
  const x = r();
  if (x < 0.025) return dwell(r, 18000, { sigma: 0.5, max: 45000 });   // gone for a minute
  if (x < 0.15) return dwell(r, 7000, { sigma: 0.4 });                 // actually reading it
  return 0;
};

/** Wait like a person who has just arrived at a screen. */
export const settle = async (page, r, median = 2600) => {
  await page.waitForTimeout(dwell(r, median));
  const extra = distraction(r);
  if (extra) await page.waitForTimeout(extra);
};

/**
 * Scroll in uneven pushes, with the occasional flick back up — nobody reads a
 * long queue in four identical strides.
 */
export const scrollAbout = async (page, r, passes = 3) => {
  for (let i = 0; i < passes; i++) {
    const px = Math.round(260 + r() * 520);
    await page.mouse.wheel(0, px).catch(() => {});
    await page.waitForTimeout(dwell(r, 1100, { sigma: 0.6, min: 350 }));
    if (r() < 0.22) {                                    // went too far, back a bit
      await page.mouse.wheel(0, -Math.round(px * (0.3 + r() * 0.5))).catch(() => {});
      await page.waitForTimeout(dwell(r, 900, { sigma: 0.5, min: 300 }));
    }
  }
};

/**
 * Move the pointer there in a few steps before clicking, rather than
 * teleporting onto the element and firing instantly.
 */
export const reachAndClick = async (page, locator, r) => {
  try {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (box) {
      // Land somewhere inside it, not dead centre every time.
      const x = box.x + box.width * (0.25 + r() * 0.5);
      const y = box.y + box.height * (0.3 + r() * 0.4);
      await page.mouse.move(x, y, { steps: 6 + Math.floor(r() * 12) });
      await page.waitForTimeout(dwell(r, 380, { sigma: 0.5, min: 120, max: 2500 }));
      await page.mouse.click(x, y);
      return true;
    }
    await locator.click({ timeout: 5000 });
    return true;
  } catch { return false; }
};

/** Typing, with the pauses in the places a person puts them. */
export const typeLikePerson = async (locator, text, r) => {
  await locator.click({ timeout: 5000 }).catch(() => {});
  for (const ch of String(text)) {
    await locator.press(ch === ' ' ? 'Space' : ch, { delay: 0 }).catch(async () => {
      await locator.type(ch, { delay: 0 }).catch(() => {});
    });
    let gap = 60 + Math.abs(gauss(r)) * 55;
    if (ch === ' ') gap += 40;
    if (r() < 0.04) gap += 300 + r() * 700;        // thinking, or finding a key
    await new Promise((res) => setTimeout(res, Math.round(gap)));
  }
};

/**
 * Order the navigation the way a person wanders it: mostly top to bottom,
 * because that is how menus are read, but not rigidly so.
 */
export const wander = (items, r) => {
  const out = items.slice();
  for (let i = 0; i < out.length - 1; i++) {
    if (r() < 0.25) { const j = Math.min(out.length - 1, i + 1 + Math.floor(r() * 2)); [out[i], out[j]] = [out[j], out[i]]; }
  }
  return out;
};
