# @richie-router/ — Current Specification

`@richie-router/` is a file-based, type-safe React router for Bun + TypeScript with one strong architectural rule:

- the app is client-rendered
- the backend never imports or executes frontend route modules
- the only server-side route concern built into the library is document head resolution

That means there is no route-level data loading API in `@richie-router/` anymore. Data fetching is outside the scope of the library.

---

## 1. Architecture

`@richie-router/` is split into four packages:

- `@richie-router/react` — client router, components, hooks, head reconciliation
- `@richie-router/core` — shared route/head/search types and matching utilities
- `@richie-router/server` — server head tag registry and request handling
- `@richie-router/tooling` — route generation for both the client tree and the server manifest

The important boundary is:

- frontend route files live under `frontend/routes`
- backend code imports a generated `route-manifest.gen.ts`, not the frontend route files
- shared code only contains Bun/browser-safe TypeScript, such as Zod schemas

There is no React SSR. The returned HTML is always the SPA shell plus optional server-resolved head tags.

---

## 2. Generated Files

`@richie-router/` generates two different artifacts:

1. `route-tree.gen.ts`
This is the client route tree. It imports the route modules and powers the React router runtime, so it should live in a frontend-only location.

2. `route-manifest.gen.ts`
This is the server-safe route manifest. It contains route structure, path relationships, and shared route metadata from `routerSchema`. It does not import frontend route files.

Example generation:

```ts
import { generateRouteTree } from '@richie-router/tooling';

await generateRouteTree({
  routesDir: './frontend/routes',
  routerSchema: './shared/router-schema.ts',
  output: './frontend/route-tree.gen.ts',
  manifestOutput: './shared/route-manifest.gen.ts',
});
```

---

## 3. File-Based Routing

Routes are defined in a directory such as `frontend/routes`.

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

- `__root.tsx` — root React layout
- `index.tsx` — index route
- `route.tsx` — directory layout route
- `$param.tsx` — dynamic segment
- `$.tsx` — catch-all segment
- `_group/` — pathless layout
- `(group)/` — organization-only group
- `segment_` — breaks nesting

Examples:

```text
posts.tsx          -> /posts layout
posts.index.tsx    -> /posts
posts.$postId.tsx  -> /posts/:postId
_auth/dashboard.tsx -> /dashboard
```

---

## 4. Root Layout

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

The app mounts into `#app`, which is defined by the HTML template. The server does not inject rendered app HTML into that element.

---

## 5. Route Configuration API

### `createFileRoute(path)`

```tsx
import { createFileRoute } from '@richie-router/react';

export const Route = createFileRoute('/posts/$postId')({
  component: PostPage,
});
```

### `createRootRoute(options)`

```tsx
import { createRootRoute } from '@richie-router/react';

export const Route = createRootRoute({
  component: RootLayout,
});
```

### Route options

```ts
interface RouteOptions<TPath extends string, TSearch> {
  component?: React.ComponentType;
  pendingComponent?: React.ComponentType;
  errorComponent?: React.ComponentType<{ error: Error; reset: () => void }>;
  notFoundComponent?: React.ComponentType;

  head?:
    | HeadConfig
    | ((ctx: {
        params: ResolveAllParams<TPath>;
        search: TSearch;
        matches: RouteMatch[];
      }) => HeadConfig);

  beforeLoad?: (ctx: {
    location: ParsedLocation;
    params: ResolveAllParams<TPath>;
    search: TSearch;
    navigate: (options: RedirectTarget) => Promise<void>;
    cause: 'enter' | 'stay';
  }) => void | Promise<void>;

  pendingMs?: number;
  pendingMinMs?: number;
  staticData?: Record<string, unknown>;
}
```

### Meaning of `head`

`head` is client-only:

1. `head: { ... }`
Client-only static head tags.

2. `head: ({ params, search, matches }) => ({ ... })`
Client-only computed head tags.

The server never evaluates route head functions or imports route modules to read static route head objects.

---

## 6. Shared Router Schema

The shared schema connects route IDs to typed search params and optional `serverHead: true` flags for both:

- client navigation types
- backend head definitions

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

export type RouterSchema = typeof routerSchema;
```

If a route has a `searchSchema`, that schema feeds into the generated route types. `Link`, `navigate`, and `Route.useSearch()` all become aware of that search shape.

---

## 7. Client Router Creation

```tsx
import { createRouter } from '@richie-router/react';
import { routeTree } from './route-tree.gen';

export const router = createRouter({
  routeTree,
  headBasePath: '/head-api',
  defaultPreload: 'intent',
  defaultPreloadDelay: 50,
  scrollRestoration: true,
  scrollToTopSelectors: ['#main-content'],
});
```

`RouterProvider` renders the matched route component tree and reconciles managed head tags in `document.head`.

```tsx
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@richie-router/react';
import { router } from './router';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container.');

createRoot(container).render(<RouterProvider router={router} />);
```

---

## 8. Server Head Tags

Backend head tags are defined with `defineHeadTags(...)`.

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

  '/posts/$postId': {
    staleTime: 10_000,
    head: async ({ params }) => {
      const post = await db.posts.findUnique({ where: { id: params.postId } });
      if (!post) throw new Response('Not Found', { status: 404 });

      return {
        meta: [
          { title: `${post.title} | @richie-router/ Demo` },
          { name: 'description', content: post.excerpt },
          { property: 'og:title', content: post.title },
        ],
      };
    },
  },

  '/search': {
    staleTime: 5_000,
    head: async ({ search }) => ({
      meta: [
        { title: `Search: ${search.query}` },
        { name: 'description', content: `Search page for "${search.query}".` },
      ],
    }),
  },
});
```

Each head tag definition receives:

```ts
interface HeadTagContext<TSearch> {
  request: Request;
  params: Record<string, string>;
  search: TSearch;
}
```

The backend may throw:

- `Response`
- `notFound()`
- `redirect()`

`staleTime` is used by the client head cache for repeated navigations.

---

## 9. Request Handling

`handleHeadTagRequest()` is the scoped helper for the JSON endpoint used by client head-tag loaders. `handleRequest()` handles document requests and still supports head API requests as a convenience.

```ts
import { handleHeadTagRequest, handleRequest } from '@richie-router/server';

const template = await Bun.file('./frontend/index.html').text();

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

`<!--richie-router-head-->` is the only `@richie-router/` placeholder.

For page requests, the server injects:

- serialized head tags for all matched routes with `serverHead: true`
- a small bootstrap script that sets `window.__RICHIE_ROUTER_HEAD__`

For head API requests, the server returns JSON:

```json
{
  "head": {
    "meta": [{ "title": "Search: router" }]
  },
  "staleTime": 5000
}
```

---

## 10. Head Resolution Rules

### Initial document request

1. Backend matches the generated `route-manifest`
2. Backend resolves server heads for matched routes with `serverHead: true`
3. Backend injects the merged result into `<!--richie-router-head-->`
4. Backend returns the SPA shell
5. Client mounts the app into `#app`

### Client navigation

1. Client matches the route tree
2. Client runs `beforeLoad`
3. Client fetches any server heads for routes with `serverHead: true`
4. Client evaluates client-only head objects/functions
5. Client reconciles managed nodes in `document.head`

### Merge behavior

- `title`: last wins
- `meta[name]`: child overrides parent
- `meta[property]`: child overrides parent
- `meta[charset]`: deduplicated
- `link[rel+href]`: deduplicated
- `style` and `script`: appended in match order

---

## 11. Type Safety

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

This is rejected:

```tsx
// @ts-expect-error postId is required
<Link to="/posts/$postId">Broken</Link>;

// @ts-expect-error limit must be a number
linkOptions({ to: '/search', search: { query: 'router', limit: '2' } });
```

---

## 12. Navigation

All navigation uses the browser History API.

```ts
interface NavigateOptions {
  to: string;
  from?: string;
  params?: Record<string, string> | ((prev) => TParams);
  search?: TSearch | ((prev) => TSearch) | true;
  hash?: string;
  replace?: boolean;
  resetScroll?: boolean;
  state?: Record<string, unknown>;
  mask?: { to: string };
  ignoreBlocker?: boolean;
}
```

Available APIs:

- `router.navigate(...)`
- `router.preloadRoute(...)`
- `useNavigate()`
- `<Link />`
- `createLink(...)`
- `linkOptions(...)`

---

## 13. Hooks

Public hooks:

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

Route instance helpers:

- `Route.useParams()`
- `Route.useSearch()`
- `Route.useNavigate()`
- `Route.useMatch()`

---

## 14. Redirects and Errors

`beforeLoad` is a client-side lifecycle. It can:

- continue
- throw `redirect(...)`
- throw `notFound(...)`
- throw any other error

Example:

```tsx
import { createFileRoute, redirect } from '@richie-router/react';

export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ location }) => {
    const rawSearch = location.search as Record<string, unknown>;
    if (rawSearch.auth !== true) {
      throw redirect({
        to: '/',
        search: { redirect: location.pathname },
      });
    }
  },
});
```

Because the backend does not execute frontend code, `beforeLoad` does not run during the initial document request.

---

## 15. Scroll Restoration and Preloading

Router options:

```ts
createRouter({
  routeTree,
  scrollRestoration: true,
  scrollToTopSelectors: ['#main-content'],
  defaultPreload: 'intent',
  defaultPreloadDelay: 50,
});
```

- `preload="intent"` on `<Link />` starts head resolution early
- `preload="render"` starts it on mount
- `router.preloadRoute(...)` is available programmatically

Preloading only concerns routing and head tags. `@richie-router/` does not preload page data.

---

## 16. Package Exports

### `@richie-router/react`

Components:

- `RouterProvider`
- `Link`
- `Outlet`
- `Block`

Route factories:

- `createFileRoute`
- `createRootRoute`
- `createLink`
- `createRouteMask`

Hooks:

- `useRouter`
- `useMatches`
- `useMatch`
- `useParams`
- `useSearch`
- `useNavigate`
- `useLocation`
- `useRouterState`
- `useBlocker`
- `useElementScrollRestoration`

Navigation:

- `linkOptions`
- `redirect`
- `notFound`
- `isRedirect`
- `isNotFound`

History:

- `createBrowserHistory`
- `createHashHistory`
- `createMemoryHistory`

Utilities:

- `getRouteApi`
- `createRouter`

### `@richie-router/core`

Schema:

- `defineRouterSchema`

Head:

- `HeadConfig`
- `HeadTag`
- `HeadLinkTag`
- `HeadStyleTag`
- `HeadScriptTag`
- `serializeHeadConfig`
- `resolveHeadConfig`

Routing:

- `RouteNode`
- `createRouteNode`
- `matchRouteTree`
- `buildPath`

### `@richie-router/server`

Server:

- `defineHeadTags`
- `handleHeadTagRequest`
- `handleRequest`

### `@richie-router/tooling`

Generation:

- `generateRouteTree`
- `watchRouteTree`

Build integrations:

- `richieRouterPlugin` from `@richie-router/tooling/esbuild`
- `richieRouter` from `@richie-router/tooling/vite`

---

## 17. Summary

`@richie-router/` is:

- a client-rendered file router
- type-safe for route params and search
- able to resolve document head tags on the server
- explicit about not executing frontend code on the backend
- intentionally not responsible for route data loading
