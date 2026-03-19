# @richie-router/

`@richie-router/` is a file-based, type-safe React router for Bun + TypeScript. It is built around one hard architectural boundary: apps are client-rendered, and the backend never imports or executes frontend route modules. `@richie-router/` handles route matching, navigation, generated route types, and document head resolution, but it does not provide route-level data loading or React SSR.

- Website: [docs.ricsam.dev/richie-router](https://docs.ricsam.dev/richie-router)
- Packages: `@richie-router/core`, `@richie-router/react`, `@richie-router/server`, `@richie-router/tooling`
- Apps: `demo/` exercises the router end to end, and `docs/` uses `@richie-router/` plus Richie RPC to browse the real markdown files in this repository

## Quick Start

```bash
bun install
bun run demo:generate
bun run docs:generate
bun run demo:start
bun run docs:start
bun run typecheck
bun run test
```

`bun run test` regenerates the demo/docs routes, runs the Playwright browser suite, and then runs the TypeScript type-safety checks.

## Architecture

`@richie-router/` is split into four packages:

- `@richie-router/react` for the client router runtime, components, hooks, and head reconciliation
- `@richie-router/core` for shared route, search, and head-tag types plus matching utilities
- `@richie-router/server` for server head-tag definitions and request handling
- `@richie-router/tooling` for route generation and build-tool integrations

The important boundary is:

- frontend route files live under `frontend/routes`
- backend code imports a generated `route-manifest.gen.ts`, not the frontend route files
- shared code contains Bun/browser-safe TypeScript such as Zod schemas
- there is no React SSR; page requests return the SPA shell plus optional server-resolved head tags

## Generated Files

`@richie-router/` generates two artifacts from your route files:

1. `route-tree.gen.ts`

This is the client route tree. It imports route modules and powers the React runtime.

2. `route-manifest.gen.ts`

This is the server-safe route manifest. It contains route structure, path relationships, shared search schemas, and string head-tag references, but it does not import frontend route files.

```ts
import { generateRouteTree } from '@richie-router/tooling';

await generateRouteTree({
  routesDir: './frontend/routes',
  headTagSchema: './shared/head-tag-schema.ts',
  output: './shared/route-tree.gen.ts',
  manifestOutput: './shared/route-manifest.gen.ts',
});
```

`@richie-router/tooling` also exposes `watchRouteTree`, `richieRouterPlugin` for esbuild, and `richieRouter` for Vite.

## File-Based Routing

Routes are defined in a directory such as `frontend/routes`:

```text
frontend/routes/
  __root.tsx
  index.tsx
  about.tsx
  posts.tsx
  posts.index.tsx
  posts.$postId.tsx
  search.tsx
  _auth/
    route.tsx
    dashboard.tsx
```

Naming conventions:

- `__root.tsx` for the root React layout
- `index.tsx` for an index route
- `route.tsx` for a directory layout route
- `$param.tsx` for a dynamic segment
- `$.tsx` for a catch-all segment
- `_group/` for a pathless layout
- `(group)/` for an organization-only folder
- `segment_` to break nesting

Examples:

- `posts.tsx` -> `/posts` layout
- `posts.index.tsx` -> `/posts`
- `posts.$postId.tsx` -> `/posts/:postId`
- `_auth/dashboard.tsx` -> `/dashboard`

## Route API

`__root.tsx` owns the React app shell. It does not render `<html>`, `<head>`, or `<body>`.

```tsx
import { Link, Outlet, createRootRoute } from '@richie-router/react';

export const Route = createRootRoute({
  component: RootLayout,
  head: 'app-shell',
});

function RootLayout() {
  return (
    <>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
}
```

File routes are declared with `createFileRoute(path)`:

```tsx
import { createFileRoute } from '@richie-router/react';

export const Route = createFileRoute('/posts/$postId')({
  component: PostPage,
  head: 'post-detail',
});
```

Common route options:

- `component`, `pendingComponent`, `errorComponent`, `notFoundComponent`
- `head`
- `validateSearch`
- `beforeLoad`
- `pendingMs`, `pendingMinMs`
- `staticData`

`head` supports three modes:

1. `head: 'post-detail'` for server-resolved head tags keyed through `defineHeadTags(...)`
2. `head: { ... }` for client-only static head tags
3. `head: ({ params, search, matches }) => ({ ... })` for client-only computed head tags

`beforeLoad` is a client-side lifecycle. It can continue normally, throw `redirect(...)`, throw `notFound(...)`, or throw any other error. Because the backend never executes frontend route modules, `beforeLoad` does not run during the initial document request.

## Shared Search And Head Tags

The shared head-tag schema connects route `head: 'key'` declarations to typed search params for both client navigation and backend head-tag definitions.

```ts
import { z } from 'zod';
import { defineHeadTagSchema } from '@richie-router/core';

export const headTagSchema = defineHeadTagSchema({
  'app-shell': {},
  'post-detail': {},
  'search-page': {
    searchSchema: z.object({
      query: z.string().default('router'),
      limit: z.coerce.number().default(5),
    }),
  },
});
```

If a route references a head-tag key with a `searchSchema`, generated route types flow through `Link`, `navigate`, and `Route.useSearch()`.

Server head tags are defined with `defineHeadTags(...)`:

```ts
import { defineHeadTags } from '@richie-router/server';
import { routeManifest } from '../shared/route-manifest.gen';
import { headTagSchema } from '../shared/head-tag-schema';

export const headTags = defineHeadTags(routeManifest, headTagSchema, {
  'app-shell': {
    staleTime: 60_000,
    head: async () => ({
      meta: [
        { title: '@richie-router/ Demo' },
        { name: 'description', content: 'SPA routing with server head tags.' },
      ],
    }),
  },
});
```

Each head-tag definition receives:

```ts
interface HeadTagContext<TSearch> {
  request: Request;
  params: Record<string, string>;
  search: TSearch;
}
```

`staleTime` is used by the client head cache for repeated navigations.

## Client Router

```tsx
import { createRouter } from '@richie-router/react';
import { routeTree } from '../shared/route-tree.gen';

export const router = createRouter({
  routeTree,
  headBasePath: '/head-api',
  defaultPreload: 'intent',
  defaultPreloadDelay: 50,
  scrollRestoration: true,
  scrollToTopSelectors: ['#main-content'],
});
```

`RouterProvider` renders the matched route component tree and reconciles managed nodes in `document.head`.

```tsx
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@richie-router/react';
import { router } from './router';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container.');

createRoot(container).render(<RouterProvider router={router} />);
```

## Server Request Handling

`handleHeadTagRequest()` is the scoped helper for the JSON endpoint used by client head-tag loaders. `handleRequest()` handles document requests and still supports head API requests as a convenience.

```ts
import { handleHeadTagRequest, handleRequest } from '@richie-router/server';

const headHandled = await handleHeadTagRequest(request, {
  headTags,
  headBasePath: '/head-api',
});

if (headHandled.matched) return headHandled.response;

const handled = await handleRequest(request, {
  routeManifest,
  headTags,
  headBasePath: '/head-api',
  html: {
    template,
  },
});

if (handled.matched) return handled.response;
```

Required template shape:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <!--richie-router-head-->
    <script type="module" src="/assets/client.js"></script>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
```

`<!--richie-router-head-->` is the only `@richie-router/` placeholder. On page requests, the server injects the merged head tags for all matched `head: 'key'` routes plus a small bootstrap script that sets `window.__RICHIE_ROUTER_HEAD__`. On head API requests, the server returns JSON shaped like `{ head, staleTime }`.

Head merging follows a few simple rules:

- `title`: last wins
- `meta[name]` and `meta[property]`: child overrides parent
- `meta[charset]` and `link[rel+href]`: deduplicated
- `style` and `script`: appended in match order

## Type Safety, Navigation, And Hooks

Generated route types power:

- `Link`
- `navigate`
- `getRouteApi`
- `Route.useParams()`
- `Route.useSearch()`

Example:

```tsx
import { Link, linkOptions } from '@richie-router/react';

<Link to="/posts/$postId" params={{ postId: 'alpha' }}>
  Open post
</Link>;

linkOptions({
  to: '/search',
  search: { query: 'router', limit: 2 },
});
```

Navigation APIs include:

- `router.navigate(...)`
- `router.preloadRoute(...)`
- `useNavigate()`
- `<Link />`
- `createLink(...)`
- `linkOptions(...)`

Public hooks include:

- `useRouter()`
- `useMatches()`
- `useMatch({ from })`
- `useParams({ from })`
- `useSearch({ from })`
- `useNavigate()`
- `useLocation()`
- `useRouterState({ select })`
- `useBlocker(...)`
- `useElementScrollRestoration()`

Route instances also expose `Route.useParams()`, `Route.useSearch()`, `Route.useNavigate()`, and `Route.useMatch()`.

Preloading and scroll restoration are router concerns only. `@richie-router/` can preload route matching and head tags, but it does not preload page data.

## What `@richie-router/` Is Not

`@richie-router/` is intentionally:

- client-rendered (but can create the the `<head>` tag on the server)
- type-safe for route params and search
- able to resolve document head tags on the server
- explicit about not executing frontend code on the backend
- not responsible for route-level data loading
- not a React SSR framework

## Apps In This Repository

This workspace includes two runnable apps:

### Demo

The demo app lives in `demo/` and uses generated file routes, a shared head-tag schema, a server-safe route manifest, client rendering, server head-tag resolution, a real `/api/posts` endpoint, and type-checked navigation helpers.
