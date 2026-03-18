export const postCatalog = [
  {
    id: 'alpha',
    title: 'Alpha Release Notes',
    excerpt: 'The first cut of Richie Router with generated file routes.',
    body: 'This page is client-rendered. The document head comes from the backend via a server head tag definition.',
  },
  {
    id: 'typed-nav',
    title: 'Typed Navigation Deep Dive',
    excerpt: 'Making Link and navigate route-aware without manual annotations.',
    body: 'Route params and search stay type-safe even though the router is now fully client-rendered.',
  },
  {
    id: 'head-tags',
    title: 'Server Head Tags',
    excerpt: 'Resolving SEO metadata on the server without rendering React there.',
    body: 'The backend matches the route manifest, resolves head tags, and returns the SPA shell with enriched head markup.',
  },
] as const;
