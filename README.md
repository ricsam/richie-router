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

`basePath` and `headBasePath` are related but different. `basePath` is the SPA pathname prefix, such as `https://host.com/project/*`. It changes route matching, `useLocation()`, and generated link/history hrefs. `headBasePath` is only the JSON endpoint used by server head loaders. If you omit `headBasePath`, it defaults to `${basePath}/head-api` when `basePath` is set, otherwise `/head-api`. Override it explicitly if your head API lives somewhere else, for example `headBasePath: '/head-api'`.

```tsx
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@richie-router/react';
import { router } from './router';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container.');

createRoot(container).render(<RouterProvider router={router} />);
```

## Server Request Handling

`matchesSpaRequest()` is the low-level matcher for deciding whether a request should be handled by your SPA shell. `handleSpaRequest()` builds on that and serves SPA document requests without any server head-tag work. It accepts either a server-safe `routeManifest` or a parsed `spa-routes.gen.json` manifest. `handleHeadTagRequest()` is the scoped helper for the JSON endpoint used by client head-tag loaders. `handleRequest()` composes both concerns as a convenience when you want SPA document handling plus server head tags.

```ts
import { matchesSpaRequest } from '@richie-router/server';

if (matchesSpaRequest(request, {
  spaRoutesManifest,
  basePath: '/project',
})) {
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

If you also want Richie Router to resolve server head tags, use `handleHeadTagRequest()` directly or let `handleRequest()` handle both concerns:

```ts
import { handleHeadTagRequest, handleRequest } from '@richie-router/server';

const headHandled = await handleHeadTagRequest(request, {
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

`basePath` on `matchesSpaRequest()`, `handleSpaRequest()`, and `handleRequest()` is the SPA document prefix. It strips that prefix before matching backend SPA routes, and `handleRequest()` also prefixes redirect responses with it. `headBasePath` is separate and still refers to the concrete head API endpoint path. If you omit `headBasePath`, both `handleHeadTagRequest()` and `handleRequest()` default it to `${basePath}/head-api` when `basePath` is set, otherwise `/head-api`.

If you call `handleHeadTagRequest()` directly, pass either `basePath`, the actual `headBasePath`, or both when your head API lives somewhere custom.

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

`<!--richie-router-head-->` is the only `@richie-router/` placeholder. `handleSpaRequest()` strips it when present and leaves string templates without it unchanged. On head-enabled page requests through `handleRequest()`, the server injects the merged head tags for all matched routes with `serverHead: true` plus a small bootstrap script that sets `window.__RICHIE_ROUTER_HEAD__`. On head API requests, the server resolves head by `routeId` and returns JSON shaped like `{ head, staleTime }`.

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
