import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cache Components is off in v1: every analysis renders dynamically from
  // the URL (technical note, "Render caching"). Flag name per the Next.js
  // 16.4 docs: app/api-reference/config/next-config-js/cacheComponents.
  cacheComponents: false,
  // AGENTS.md is hand-written and authoritative; do not let `next dev`
  // insert its managed block (next-config-js/agentRules).
  agentRules: false,
};

export default nextConfig;
