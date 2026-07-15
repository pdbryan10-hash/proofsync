import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A stray lockfile elsewhere on disk can make Next infer the wrong workspace
  // root; pin it to this project so file tracing is correct on Vercel.
  outputFileTracingRoot: __dirname,
  // The app reads from the database at request time; never statically pre-render
  // pages that touch Prisma. Individual routes also set `export const dynamic`.
  eslint: {
    // Lint is run explicitly via `npm run lint`; don't fail production builds on it.
    ignoreDuringBuilds: false,
  },
  // Keep the Prisma client external to the server bundle.
  serverExternalPackages: ['@prisma/client', 'prisma'],
};

export default nextConfig;
