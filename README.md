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
- backend code imports a generated `route-manifest.gen.ts` (or reads `spa-routes.gen.json`), not the frontend route files
- shared code contains Bun/browser-safe TypeScript such as Zod schemas
- there is no React SSR; page requests return the SPA shell plus optional server-resolved head tags

## Generated Files

`@richie-router/` generates these artifacts from your route files:

1. `route-tree.gen.ts`

This is the client route tree. It imports route modules and powers the React runtime, so it should live in a frontend-only location.

2. `route-manifest.gen.ts`

This is the server-safe route manifest. It contains route structure, path relationships, and shared route metadata from `routerSchema`, but it does not import frontend route files.

3. `spa-routes.gen.json` (optional)

This is a plain JSON manifest you can consume in any backend to decide which request paths should be handled by your SPA frontend.
Route patterns in `spaRoutes` use the same file-route syntax (`$param`, `$`) as your generated route tree.

```ts
import { generateRouteTree } from '@richie-router/tooling';

await generateRouteTree({
  routesDir: './frontend/routes',
  routerSchema: './shared/router-schema.ts',
  output: './frontend/route-tree.gen.ts',
  manifestOutput: './shared/route-manifest.gen.ts',
  jsonOutput: './shared/spa-routes.gen.json',
});
```

The JSON file shape:

```json
{
  "routes": [
    { "id": "__root__", "to": "/", "parentId": null, "isRoot": true },
    { "id": "/", "to": "/", "parentId": "__root__", "isRoot": false }
  ],
  "spaRoutes": ["/", "/posts", "/posts/$postId"]
}
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
});
```

Common route options:

- `component`, `pendingComponent`, `errorComponent`, `notFoundComponent`
- `head`
- `beforeLoad`
- `pendingMs`, `pendingMinMs`
- `staticData`

`head` is client-only:

1. `head: { ... }` for client-only static head tags
2. `head: ({ params, search, matches }) => ({ ... })` for client-only computed head tags

`beforeLoad` is a client-side lifecycle. It can continue normally, throw `redirect(...)`, throw `notFound(...)`, or throw any other error. Because the backend never executes frontend route modules, `beforeLoad` does not run during the initial document request.

## Shared Router Schema

The shared `routerSchema` connects route IDs to typed search params and optional `serverHead: true` flags for both client navigation and backend head definitions.

```ts
import { z } from 'zod';
import { defineRouterSchema } from '@richie-router/core';

export const routerSchema = defineRouterSchema({
  __root__: {
    serverHead: true,
  },
  '/posts/$postId': {
    serverHead: true,
  },
  '/search': {
    serverHead: true,
    searchSchema: z.object({
      query: z.string().default('router'),
      limit: z.coerce.number().default(5),
    }),
  },
}, {
  passthrough: ['/api/$'],
});
```

If a route has a `searchSchema`, generated route types flow through `Link`, `navigate`, and `Route.useSearch()`.

Server head tags are defined with `defineHeadTags(...)` keyed by route ID:

```ts
import { defineHeadTags } from '@richie-router/server';
import { routeManifest } from '../shared/route-manifest.gen';
import { routerSchema } from '../shared/router-schema';

export const headTags = defineHeadTags(routeManifest, routerSchema, {
  __root__: {
    staleTime: 60_000,
    head: async () => [
      { tag: 'title', children: '@richie-router/ Demo' },
      {
        tag: 'meta',
        name: 'description',
        content: 'SPA routing with server head tags.',
      },
    ],
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

Set `staleTime` on each server head definition. The client reuses matching route-level entries for repeated navigations, and document head responses derive their top-level `staleTime` from the shortest matched value.

`HeadConfig` is a single array of first-class head elements. Use `tag: 'custom'` when you need an arbitrary `<head>` node:

```ts
head: () => [
  { tag: 'link', rel: 'icon', href: './public/favicon.png' },
  {
    tag: 'custom',
    name: 'meta',
    attrs: {
      name: 'theme-color',
      content: '#111827',
    },
  },
]
```

## Client Router

```tsx
import { createRouter } from '@richie-router/react';
import { routeTree } from './route-tree.gen';

export const router = createRouter({
  routeTree,
  // Optional when the app is mounted under a sub-path such as /project/*
  basePath: '/project',
  defaultPreload: 'intent',
  defaultPreloadDelay: 50,
  scrollRestoration: true,
  scrollToTopSelectors: ['#main-content'],
});
```

`RouterProvider` renders the matched route component tree and reconciles managed nodes in `document.head`.

`basePath` is the SPA pathname prefix, such as `https://host.com/project/*`. It changes route matching, `useLocation()`, and generated link/history hrefs. `headBasePath` now belongs to `defineRouterSchema(..., { headBasePath })`, alongside `passthrough`. If you omit it, Richie Router defaults to `/head-api`, and that path is always treated as an implicit passthrough route.

```tsx
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@richie-router/react';
import { router } from './router';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container.');

createRoot(container).render(<RouterProvider router={router} />);
```

## Server Request Handling

`matchesSpaPath()` is the low-level matcher for deciding whether a path should be handled by your SPA shell. `matchesPassthroughPath()` uses the same generated manifest metadata to keep server-only routes like `/api/$` and the head endpoint out of the SPA shell. `handleSpaRequest()` builds on SPA matching and serves document requests without any server head-tag work. It accepts either a server-safe `routeManifest` or a parsed `spa-routes.gen.json` manifest. `handleHeadRequest()` is the scoped helper for the JSON endpoint used by client head-tag loaders and host-owned HTML shells. `handleHeadTagRequest()` remains as a backwards-compatible alias. `handleRequest()` composes both concerns as a convenience when you want SPA document handling plus server head tags.

```ts
import { matchesPassthroughPath, matchesSpaPath } from '@richie-router/server';

if (
  !matchesPassthroughPath('/project/posts/hello-world', {
    spaRoutesManifest,
    basePath: '/project',
  }) &&
  matchesSpaPath('/project/posts/hello-world', {
  spaRoutesManifest,
  basePath: '/project',
  })
) {
  // Your host can render or serve the SPA shell here.
}
```

```ts
import { handleSpaRequest } from '@richie-router/server';

const spaHandled = await handleSpaRequest(request, {
  spaRoutesManifest,
  basePath: '/project',
  headers: {
    'cache-control': 'no-cache',
  },
  html: {
    template,
  },
});

if (spaHandled.matched) return spaHandled.response;
```

If you also want Richie Router to resolve server head tags, use `handleHeadRequest()` directly or let `handleRequest()` handle both concerns:

```ts
import { handleHeadRequest, handleRequest } from '@richie-router/server';

const headHandled = await handleHeadRequest(request, {
  headTags,
  basePath: '/project',
});

if (headHandled.matched) return headHandled.response;

const handled = await handleRequest(request, {
  routeManifest,
  headTags,
  basePath: '/project',
  html: {
    template,
  },
});

if (handled.matched) return handled.response;
```

`basePath` on `matchesSpaPath()`, `matchesPassthroughPath()`, `handleSpaRequest()`, and `handleRequest()` is the SPA document prefix. It strips that prefix before matching backend SPA routes, and `handleRequest()` also prefixes redirect responses with it. Richie Router normalizes `"/"` to the root app and trims a trailing slash for you, so `"/project/"` and `"/project"` behave the same. `headBasePath` comes from the shared router schema, not the request helpers.

If you call `handleHeadRequest()` directly, pass the same `headTags` object built from your shared router schema and an optional `basePath`. Route head requests still use `?routeId=...&params=...&search=...`. Host-owned shell requests can instead send `?href=/project/posts/hello-world` to receive `{ href, head, routeHeads, staleTime, richieRouterHead }` for the fully matched document head.

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

`<!--richie-router-head-->` is the only `@richie-router/` placeholder. `handleSpaRequest()` strips it when present and leaves string templates without it unchanged. On head-enabled page requests through `handleRequest()`, the server injects the merged head tags for all matched routes with `serverHead: true` plus a small bootstrap script that sets `window.__RICHIE_ROUTER_HEAD__`. On head API requests, the server resolves either route-level head payloads by `routeId` or full document head payloads by `href`. Document payloads include `routeHeads` so the client can preserve per-route merge order while still using a single `?href=` request.

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
- `useMatchRoute()`
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
