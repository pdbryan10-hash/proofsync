import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { shotPng } from '@/lib/demo/screenshots';
import { demoGuard } from '../../_guard';

export const dynamic = 'force-dynamic';

/** Serve one screenshot's bytes. Metadata comes with the state; images on demand. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = demoGuard(req);
  if (blocked) return blocked;

  const { id } = await ctx.params;
  const png = await shotPng(id);
  if (!png) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      // Screenshots are immutable once captured, so let the browser keep them.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
