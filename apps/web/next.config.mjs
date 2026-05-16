/** @type {import('next').NextConfig} */
const isDesktop = process.env.DBSTUDIO_TARGET === 'desktop';

const nextConfig = {
  reactStrictMode: true,
  // Desktop build produces a static export consumed by Tauri.
  // Web build runs as an SSR Next.js app.
  ...(isDesktop ? { output: 'export', images: { unoptimized: true } } : {}),
  // Workspace packages ship as raw TS source; let Next compile them.
  transpilePackages: ['@dbstudio/erd'],
};

export default nextConfig;
