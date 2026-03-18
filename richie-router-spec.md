# Richie Router — Specification

> A file-based, fully type-safe router for React with a strict frontend/backend/shared architecture.
> No isomorphic JavaScript. Loaders live on the server. Types flow through a shared layer.

**Packages:**
- `@richie-router/react` — Client-side router, components, hooks
- `@richie-router/core` — Shared types, schema definitions, route tree types (pure TS, no runtime dependencies on React or Node)
- `@richie-router/server` — WHATWG-compatible server helpers (loader execution, head injection, HTML handling)
- `@richie-router/tooling` — Build-time route tree generation (Node/Bun API, no CLI), esbuild plugin

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File-Based Routing](#2-file-based-routing)
3. [Route Tree Generation](#3-route-tree-generation)
4. [Route Configuration API](#4-route-configuration-api)
5. [Router Creation](#5-router-creation)
6. [Type Safety](#6-type-safety)
7. [Loader System](#7-loader-system)
8. [Head Management](#8-head-management)
9. [Navigation](#9-navigation)
10. [Link Component](#10-link-component)
11. [Hooks](#11-hooks)
12. [Outlets and Nested Routing](#12-outlets-and-nested-routing)
13. [Search Params](#13-search-params)
14. [Path Params](#14-path-params)
15. [Authenticated Routes](#15-authenticated-routes)
16. [Not Found Errors](#16-not-found-errors)
17. [Navigation Blocking](#17-navigation-blocking)
18. [Scroll Restoration](#18-scroll-restoration)
19. [Route Masking](#19-route-masking)
20. [Preloading](#20-preloading)
21. [Custom Search Param Serialization](#21-custom-search-param-serialization)
22. [Server Integration](#22-server-integration)
23. [SSR Behavior](#23-ssr-behavior)
24. [History Types](#24-history-types)
25. [Type Utilities](#25-type-utilities)
26. [Custom Link Components](#26-custom-link-components)
27. [Link Options](#27-link-options)
28. [Error Handling](#28-error-handling)
29. [Pending States](#29-pending-states)

---

## 1. Architecture Overview

Richie Router enforces a strict three-zone architecture:

```
frontend (browser only)          @richie-router/react
  RouterProvider, Link, Outlet, hooks
  Route components (routes/*.tsx)
  Client-side navigation via History pushState
  Head reconciliation on navigation
  Loader data fetched from server via HTTP

shared (pure TypeScript)         @richie-router/core
  route-tree.gen.ts (generated)
  loader-schema.ts (user-authored)
  Type definitions, Zod schemas

backend (server only)            @richie-router/server
  defineLoaders() — loader implementations
  handleRequest() — WHATWG Request/Response handler
  Head injection into HTML
  Loader API endpoint serving
```

**Key architectural difference from TanStack Router:** Loaders are *never* defined in route files. Route files are frontend-only and contain only component, head, and metadata. Loader implementations live on the backend. The shared loader schema provides the type bridge between `Route.useLoaderData()` on the frontend and `defineLoaders()` on the backend.

---

## 2. File-Based Routing

### Directory Structure

Routes are defined in a configurable directory (default: `./routes`). The file structure maps directly to URL paths.

```
/routes/
  __root.tsx                     # Root layout (always renders, wraps everything)
  index.tsx                      # /
  about.tsx                      # /about
  models.tsx                     # /models
  profile.tsx                    # /profile
  admin/
    route.tsx                    # /admin layout (renders Outlet)
    index.tsx                    # /admin (exact match)
    settings.tsx                 # /admin/settings
    analytics.tsx                # /admin/analytics
    models.tsx                   # /admin/models
    users.tsx                    # /admin/users layout
    users.index.tsx              # /admin/users (exact)
    users.$userId.tsx            # /admin/users/:userId
    cores.tsx                    # /admin/cores layout
    cores.index.tsx              # /admin/cores (exact)
    cores.$coreId.tsx            # /admin/cores/:coreId
  chat/
    index.tsx                    # /chat
    new.tsx                      # /chat/new
    $id.tsx                      # /chat/:id
  _auth/                         # Pathless layout (no URL segment)
    route.tsx                    # Auth guard layout
    dashboard.tsx                # /dashboard (not /_auth/dashboard)
    settings.tsx                 # /settings
  knowledge-base/
    index.tsx                    # /knowledge-base
    files/
      $.tsx                      # /knowledge-base/files/* (catch-all/splat)
```

### File Naming Conventions

- `__root.tsx` — Root layout, always rendered. Wraps entire app.
- `index.tsx` — Index route, exact path match. `/admin` exactly.
- `route.tsx` — Layout route for directory. Wraps children, renders `<Outlet />`.
- `$paramName.tsx` — Dynamic segment. `$userId` matches `:userId`.
- `$.tsx` — Catch-all / splat route. Captures remaining path.
- `_prefix/` — Pathless layout (no URL segment). `_auth/` for auth guards.
- `(group)/` — Route group (organizational only). No URL impact.
- `-filename.tsx` — Ignored file. `-utils.tsx` is skipped.

### Flat Routing (Dot Notation)

Dots in filenames denote nesting without requiring subdirectories:

```
admin/users.tsx          -> /admin/users (layout)
admin/users.index.tsx    -> /admin/users (exact match)
admin/users.$userId.tsx  -> /admin/users/:userId
```

Both directory and dot styles can be mixed freely.

### Non-Nested Routes

A trailing `_` suffix on a segment breaks out of the parent's component tree:

```
posts.tsx          -> /posts layout
posts_.$postId.tsx -> /posts/:postId (renders independently, NOT inside posts layout)
```

---

## 3. Route Tree Generation

Route tree generation is a **programmatic Node/Bun API**. There is no CLI. It is intended to be called from a build script, an esbuild plugin, or a file watcher.

### API

```ts
import { generateRouteTree } from '@richie-router/tooling'

await generateRouteTree({
  routesDir: './frontend/routes',
  loaderSchema: './shared/loader-schema.ts',
  output: './shared/route-tree.gen.ts',
  quoteStyle: 'single',       // 'single' | 'double' (default: 'single')
  semicolons: true,            // default: true
})
```

### Watch Mode

```ts
import { watchRouteTree } from '@richie-router/tooling'

const watcher = await watchRouteTree({
  routesDir: './frontend/routes',
  loaderSchema: './shared/loader-schema.ts',
  output: './shared/route-tree.gen.ts',
})

// Later:
watcher.close()
```

### esbuild Plugin (First-Class)

The primary build integration. Runs `watchRouteTree` in development and `generateRouteTree` for production builds:

```ts
// build.ts
import { build } from 'esbuild';
import { richieRouterPlugin } from '@richie-router/tooling/esbuild';

await build({
  entryPoints: ['./frontend/main.tsx'],
  bundle: true,
  outdir: './dist',
  plugins: [
    richieRouterPlugin({
      routesDir: './frontend/routes',
      loaderSchema: './shared/loader-schema.ts',
      output: './shared/route-tree.gen.ts',
    }),
  ],
});
```

The plugin:

- In `watch` mode: starts `watchRouteTree`, regenerates `route-tree.gen.ts` on file changes, triggers esbuild rebuild.
- In `build` mode: runs `generateRouteTree` once before bundling.
- **Auto-manages the path argument** in `createFileRoute('/path')` calls. When files are created, moved, or renamed, the plugin rewrites the string literal to match the file's route path.

### Vite Adapter (Convenience Wrapper)

```ts
// vite.config.ts
import { richieRouter } from '@richie-router/tooling/vite'

export default defineConfig({
  plugins: [
    richieRouter({
      routesDir: './frontend/routes',
      loaderSchema: './shared/loader-schema.ts',
      output: './shared/route-tree.gen.ts',
    }),
    react(),
  ],
})
```

### Generated File Structure (route-tree.gen.ts)

The generated file is the critical type-safety bridge. It has seven sections:

```ts
// shared/route-tree.gen.ts (generated, do not edit)
/* eslint-disable */
// @ts-nocheck

// --- 1. Loader schema import ---
// This import bridges frontend route types to backend loader data types.
import type { LoaderSchema } from './loader-schema';
import type { InferLoaderData, InferSearchSchema } from '@richie-router/core';

// --- 2. Route imports ---
import { Route as rootRouteImport } from '../frontend/routes/__root';
import { Route as IndexRouteImport } from '../frontend/routes/index';
import { Route as AboutRouteImport } from '../frontend/routes/about';
import { Route as PostsRouteImport } from '../frontend/routes/posts';
import { Route as PostsIndexRouteImport } from '../frontend/routes/posts.index';
import { Route as PostsPostIdRouteImport } from '../frontend/routes/posts.$postId';
import { Route as SearchRouteImport } from '../frontend/routes/search';
import { Route as AdminRouteImport } from '../frontend/routes/admin/route';
import { Route as AdminIndexRouteImport } from '../frontend/routes/admin/index';

// --- 3. Route updates ---
const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRouteImport,
} as any);

const PostsPostIdRoute = PostsPostIdRouteImport.update({
  id: '/posts/$postId',
  path: '/posts/$postId',
  getParentRoute: () => PostsRouteImport,
} as any);

// ... more updates

// --- 4. Loader-to-route type mapping ---
// Maps route IDs to their loader names (as declared in createFileRoute).
// This allows TypeScript to resolve: route -> loader name -> data type.
export interface RouteLoaderMap {
  '/posts/$postId': 'fetch-post';
  '/search': 'search-results';
  '/posts': 'fetch-posts';
  '/admin': never;
  '/about': never;
}

// For each route, what is its loader data type?
export interface RouteLoaderData {
  '/posts/$postId': InferLoaderData<LoaderSchema, 'fetch-post'>;
  '/search': InferLoaderData<LoaderSchema, 'search-results'>;
  '/posts': InferLoaderData<LoaderSchema, 'fetch-posts'>;
  '/admin': undefined;
  '/about': undefined;
}

// For routes whose loader has a searchSchema
export interface RouteLoaderSearchSchema {
  '/search': InferSearchSchema<LoaderSchema, 'search-results'>;
}

// --- 5. Pre-computed type interfaces ---
// Avoids expensive recursive type inference in the editor.
export interface FileRoutesByFullPath {
  '/': typeof IndexRoute;
  '/about': typeof AboutRoute;
  '/posts': typeof PostsRouteWithChildren;
  '/posts/': typeof PostsIndexRoute;
  '/posts/$postId': typeof PostsPostIdRoute;
  '/search': typeof SearchRoute;
  '/admin': typeof AdminRouteWithChildren;
  '/admin/': typeof AdminIndexRoute;
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute;
  '/about': typeof AboutRoute;
  '/posts': typeof PostsIndexRoute;
  '/posts/$postId': typeof PostsPostIdRoute;
  '/search': typeof SearchRoute;
  '/admin': typeof AdminIndexRoute;
}

export interface FileRouteTypes {
  fullPaths: '/' | '/about' | '/posts' | '/posts/$postId' | '/search' | '/admin';
  to: '/' | '/about' | '/posts' | '/posts/$postId' | '/search' | '/admin';
  id: '__root__' | '/' | '/about' | '/posts' | '/posts/' | '/posts/$postId'
    | '/search' | '/admin' | '/admin/';
  fileRoutesById: FileRoutesById;
}

// --- 6. Module augmentation ---
declare module '@richie-router/react' {
  interface Register {
    routeTree: typeof routeTree;
    loaderData: RouteLoaderData;
    loaderMap: RouteLoaderMap;
    loaderSearchSchema: RouteLoaderSearchSchema;
  }
}

// --- 7. Route tree assembly ---
const PostsRouteChildren = { PostsIndexRoute, PostsPostIdRoute };
const PostsRouteWithChildren = PostsRouteImport
  ._addFileChildren(PostsRouteChildren);

const AdminRouteChildren = { AdminIndexRoute };
const AdminRouteWithChildren = AdminRouteImport
  ._addFileChildren(AdminRouteChildren);

const rootRouteChildren = {
  IndexRoute,
  AboutRoute,
  PostsRouteWithChildren,
  SearchRoute,
  AdminRouteWithChildren,
};

export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>();
```

**Implementation note:** The exact shape of `RouteLoaderMap`, `RouteLoaderData`, and `RouteLoaderSearchSchema` will need iteration through real TypeScript testing. The goal is that `InferLoaderData<LoaderSchema, 'fetch-post'>` resolves to the Zod-inferred output type of the loader's `dataSchema`. The interfaces shown above represent the design intent; the actual implementation may use different type-level machinery (conditional types, mapped types, template literal types) to achieve the same DX.

---

## 4. Route Configuration API

### createFileRoute(path)(options)

The primary API for defining a route. **This is a curried function.** The path string argument is the route's full path and is **auto-managed** by the esbuild plugin / generator. You never write or update it manually. When you create, move, or rename route files, the tooling rewrites this string.

The path argument is what gives TypeScript the anchor to know *which route this file represents*, enabling it to look up the correct types for params, search, loader data, etc. from the generated `route-tree.gen.ts`.

```tsx
// routes/posts.$postId.tsx
import { createFileRoute } from '@richie-router/react';

export const Route = createFileRoute('/posts/$postId')({
  loader: 'fetch-post',
  component: PostPage,
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData.post.title },
      { name: 'description', content: loaderData.post.excerpt },
      { property: 'og:title', content: loaderData.post.title },
      { property: 'og:image', content: loaderData.post.coverImage },
    ],
  }),
});

function PostPage() {
  // Fully typed: { post: { id: string; title: string; body: string; ... } }
  const { post } = Route.useLoaderData();
  // Fully typed: { postId: string }
  const { postId } = Route.useParams();

  return <article><h1>{post.title}</h1></article>;
}
```

**Why the path argument?** Without it, TypeScript has no way to know which route definition lives in which file. The path connects the route to its entry in `FileRoutesByFullPath`, which in turn connects to `RouteLoaderData`, `RouteLoaderMap`, param types, and search types. This is the same approach TanStack Router uses, and it is the cornerstone of the entire type-safety system.

### createRootRoute(options)

Used exclusively in `__root.tsx`. Does not take a path argument:

```tsx
// routes/__root.tsx
import { createRootRoute, Outlet, HeadContent } from '@richie-router/react';

export const Route = createRootRoute({
  component: RootLayout,
  head: () => ({
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
      { name: 'description', content: 'My App is a web application' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico' },
    ],
    styles: [
      {
        media: 'all and (max-width: 500px)',
        children: 'p { color: blue; background-color: yellow; }',
      },
    ],
    scripts: [
      { src: 'https://www.google-analytics.com/analytics.js', async: true },
    ],
  }),
});

function RootLayout() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
      </body>
    </html>
  );
}
```

### Route Options

```ts
interface RouteOptions<TPath extends string> {
  // Components
  component?: React.ComponentType;
  pendingComponent?: React.ComponentType;
  errorComponent?: React.ComponentType<{ error: Error; reset: () => void }>;
  notFoundComponent?: React.ComponentType;

  // Head management
  head?: HeadConfig | ((ctx: {
    loaderData: RouteLoaderData[TPath];
    params: ResolveAllParams<TPath>;
    search: ResolveFullSearchSchema<TPath>;
    matches: RouteMatch[];
  }) => HeadConfig);

  // Loader reference (string key matching loader-schema.ts)
  loader?: string; // validated by generated types

  // Search param validation
  validateSearch?: (raw: Record<string, unknown>) => TSearchSchema;

  // SSR control
  ssr?: boolean; // default: true

  // Lifecycle
  beforeLoad?: (ctx: {
    location: ParsedLocation;
    params: ResolveAllParams<TPath>;
    search: ResolveFullSearchSchema<TPath>;
    navigate: NavigateFn;
    cause: 'enter' | 'stay';
  }) => void | Promise<void>;

  // Timing
  pendingMs?: number;     // default: 1000
  pendingMinMs?: number;  // default: 500

  // Static metadata
  staticData?: Record<string, unknown>;
}
```

### Head Config Shape

```ts
interface HeadConfig {
  meta?: HeadTag[];
  links?: HeadLinkTag[];
  styles?: HeadStyleTag[];
  scripts?: HeadScriptTag[];
}

type HeadTag =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string }
  | { httpEquiv: string; content: string }
  | { charset: string };

interface HeadLinkTag {
  rel: string; href: string;
  type?: string; media?: string; sizes?: string; crossorigin?: string;
}

interface HeadStyleTag {
  children: string; media?: string;
}

interface HeadScriptTag {
  src?: string; children?: string;
  type?: string; async?: boolean; defer?: boolean;
}
```

---

## 5. Router Creation

The `routeTree` is the shared, serializable route tree definition. The `router` is a frontend runtime object. These are intentionally separate.

### Frontend Router

```tsx
// frontend/main.tsx
import { createRouter, RouterProvider } from '@richie-router/react';
import { routeTree } from '../shared/route-tree.gen';

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadDelay: 50,
  defaultPendingMs: 1000,
  defaultPendingMinMs: 500,
  defaultNotFoundComponent: DefaultNotFound,
  defaultErrorComponent: DefaultError,
  scrollRestoration: true,
  scrollToTopSelectors: ['#main-content'],
  loaderBasePath: '/loader-api',
  trailingSlash: 'never',
});

// This one line makes everything globally type-safe
declare module '@richie-router/react' {
  interface Register {
    router: typeof router;
  }
}

function App() {
  return (
    <React.Suspense fallback={<LoadingFallback />}>
      <RouterProvider router={router} />
    </React.Suspense>
  );
}
```

### Memory History

```ts
import { createRouter, createMemoryHistory } from '@richie-router/react';
import { routeTree } from '../shared/route-tree.gen';

const memoryHistory = createMemoryHistory({
  initialEntries: ['/admin/settings'],
});

const router = createRouter({ routeTree, history: memoryHistory });
```

### Hash History

```ts
import { createRouter, createHashHistory } from '@richie-router/react';
const router = createRouter({ routeTree, history: createHashHistory() });
```

Browser history is the default when `history` is omitted.

---

## 6. Type Safety

This is the most important section. Richie Router aims for the same level of DX as TanStack Router: **zero manual type annotations** for route params, search params, loader data, and navigation.

### The Three Pillars

**Pillar 1: `createFileRoute('/path')` — the route identity anchor**

When you write `createFileRoute('/posts/$postId')`, that path string tells TypeScript which entry in `FileRoutesByFullPath` this route maps to. From that single string, TS resolves:

- **Path params:** `'/posts/$postId'` -> `{ postId: string }` (via `ParsePathParams` utility type)
- **Loader name:** via `RouteLoaderMap['/posts/$postId']` -> `'fetch-post'`
- **Loader data:** via `RouteLoaderData['/posts/$postId']` -> `{ post: { id: string; ... } }`
- **Search schema:** via the route's `validateSearch` or `RouteLoaderSearchSchema`
- **Parent params:** accumulated via `getParentRoute` in the generated tree

The path string is auto-managed by the esbuild plugin. You never type it yourself.

**Pillar 2: The `Register` interface — global type permeation**

```ts
declare module '@richie-router/react' {
  interface Register {
    router: typeof router;
  }
}
```

This module augmentation makes the router's types available to every exported hook and component without passing type parameters. Internally:

```ts
type RegisteredRouter = Register extends { router: infer TRouter }
  ? TRouter
  : AnyRouter;
```

The generated `route-tree.gen.ts` additionally augments `Register` with `loaderData`, `loaderMap`, and `loaderSearchSchema`.

**Pillar 3: Pre-computed generated interfaces — fast editor performance**

Rather than forcing TypeScript to recursively walk the entire route tree on every keystroke, the generator pre-declares concrete interfaces:

```ts
export interface FileRouteTypes {
  fullPaths: '/' | '/about' | '/posts/$postId' | '/search';
  to: '/' | '/about' | '/posts/$postId' | '/search';
}
```

TS does a union lookup instead of recursive inference. For large apps (100+ routes), this is the difference between a snappy editor and multi-second delays.

### How Each API Gets Its Types

`<Link to="/posts/$postId" params={{ postId: '5' }}>` — `to` autocompletes from `FileRouteTypes['to']`. When `to` is set, `params` narrows to the target route's path params. Type error if you forget a required param.

`Route.useLoaderData()` — Returns `RouteLoaderData['/posts/$postId']` which resolves through generated interfaces to the Zod-inferred output type.

`Route.useParams()` — Returns `ResolveAllParams<'/posts/$postId'>`, accumulated from the route and all ancestors.

`Route.useSearch()` — Returns the output of the route's `validateSearch`, merged with ancestor search schemas.

`useParams({ from: '/posts/$postId' })` — Standalone hooks look up the route by path. Omitting `from` gives a partial union of all types (loose mode). Mismatched `from` at runtime throws an error.

`getRouteApi('/posts/$postId')` — Pre-bound API for code-split components that cannot import `Route` directly.

### What the Tooling Auto-Manages

The esbuild plugin and `watchRouteTree` automatically:

1. Write/update the path argument in `createFileRoute('/...')` when files are created, moved, or renamed.
2. Generate `route-tree.gen.ts` with all type interfaces, loader mappings, and module augmentation.
3. Scaffold empty route files with the correct `createFileRoute` boilerplate when a new file is detected.

### Type-Level Utilities (exact signatures TBD during implementation)

```ts
// Extracts param names from a path string
type ParsePathParams<TPath> = ...
// '/posts/$postId' -> 'postId'
// '/orgs/$orgId/teams/$teamId' -> 'orgId' | 'teamId'
// '/files/$' -> '_splat'

// Accumulates params from parent chain
type ResolveAllParams<TPath> = { [K in ParsePathParams<TPath>]: string }

// Infers Zod output type from loader schema dataSchema
type InferLoaderData<TSchema, TLoaderName> = ...

// Infers Zod output type from loader schema searchSchema
type InferSearchSchema<TSchema, TLoaderName> = ...
```

---

## 7. Loader System

### Loader Schema Definition (Shared)

```ts
// shared/loader-schema.ts
import { z } from 'zod';
import { defineLoaderSchema } from '@richie-router/core';

export const loaderSchema = defineLoaderSchema({
  'fetch-post': {
    dataSchema: z.object({
      post: z.object({
        id: z.string(),
        title: z.string(),
        excerpt: z.string(),
        body: z.string(),
        coverImage: z.string(),
      }),
    }),
  },
  'fetch-posts': {
    dataSchema: z.object({
      posts: z.array(z.object({
        id: z.string(),
        title: z.string(),
        excerpt: z.string(),
      })),
    }),
  },
  'search-results': {
    searchSchema: z.object({
      query: z.string(),
      limit: z.coerce.number().default(20),
      offset: z.coerce.number().default(0),
    }),
    dataSchema: z.object({
      numResults: z.number(),
      results: z.array(z.object({
        id: z.string(),
        title: z.string(),
        snippet: z.string(),
      })),
    }),
  },
});

export type LoaderSchema = typeof loaderSchema;
```

### Loader Implementation (Backend)

```ts
// backend/server.ts
import { defineLoaders, handleRequest } from '@richie-router/server';
import { routeTree } from '../shared/route-tree.gen';
import { loaderSchema } from '../shared/loader-schema';

const loaders = defineLoaders(routeTree, loaderSchema, {
  'fetch-post': {
    staleTime: 10_000,
    loader: async ({ request, params, search }) => {
      const post = await db.posts.findUnique({ where: { id: params.postId } });
      if (!post) throw new Response('Not Found', { status: 404 });
      return { post };
    },
  },

  'fetch-posts': {
    staleTime: 5_000,
    loader: async ({ request, params, search }) => {
      const posts = await db.posts.findMany();
      return { posts };
    },
  },

  'search-results': {
    staleTime: 5_000,
    loader: async ({ request, params, search }) => {
      const results = await searchIndex.query({
        query: search.query,
        limit: search.limit,
        offset: search.offset,
      });
      return { numResults: results.total, results: results.hits };
    },
    loaderDependencies: ({ search }) => ({
      query: search.query,
      limit: search.limit,
      offset: search.offset,
    }),
  },
});
```

### How Loaders Execute

**On SSR:** Server matches route, executes loader directly, injects data + head into HTML. Client hydrates without refetching.

**On client navigation:** Client checks cache freshness (`staleTime`). If stale: fetches `GET /loader-api/{loaderName}?params=...&search=...`. Server returns JSON. Client caches and renders.

**Cache:** Keyed by `loaderName + params + loaderDependencies`. `staleTime: 0` (default) always refetches. In-memory on client, discarded on full page reload.

---

## 8. Head Management

```tsx
// Static head
export const Route = createFileRoute('/about')({
  component: AboutPage,
  head: {
    meta: [
      { title: 'About Us' },
      { name: 'description', content: 'Learn about our company' },
    ],
  },
});

// Dynamic head from loader data
export const Route = createFileRoute('/posts/$postId')({
  loader: 'fetch-post',
  component: PostPage,
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData.post.title },
      { name: 'description', content: loaderData.post.excerpt },
      { property: 'og:title', content: loaderData.post.title },
      { property: 'og:description', content: loaderData.post.excerpt },
      { property: 'og:image', content: loaderData.post.coverImage },
      { property: 'og:type', content: 'article' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
});
```

`<HeadContent />` renders head tags from all matched routes. Place in root layout's `<head>`.

**Reconciliation:** Title: last wins. Meta name/property: deduplicated, child overrides parent. Links: deduplicated by rel+href. Scripts/Styles: appended in match order. On client navigation, diffs against current `document.head`.

---

## 9. Navigation

All navigation uses `history.pushState`/`replaceState`.

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
  mask?: MaskOptions;
  ignoreBlocker?: boolean;
}
```

`redirect()` — thrown from `beforeLoad` to redirect before render.

---

## 10. Link Component

Renders a real `<a>` with valid `href`. Preserves cmd/ctrl+click.

```tsx
<Link to="/about">About</Link>
<Link to="/posts/$postId" params={{ postId: '123' }}>View Post</Link>
<Link to="/shop" search={{ pageIndex: 3, sortBy: 'price', desc: true }}>Shop</Link>
<Link to="/products" search={true}>Keep Filters</Link>
<Link to="/products" search={(prev) => ({ ...prev, page: prev.page + 1 })}>Next</Link>
<Link to="/about" activeProps={{ className: 'font-bold' }}>About</Link>
<Link to="/about">{({ isActive }) => <span>{isActive ? 'HERE' : 'About'}</span>}</Link>
<Link to="/posts/$postId" params={{ postId: '5' }} preload="intent">Post 5</Link>
```

---

## 11. Hooks

All hooks available standalone (with `from`) or as `Route.*` methods (auto-scoped).

- `Route.useLoaderData()` / `useLoaderData({ from })` — typed loader data
- `Route.useParams()` / `useParams({ from })` — path params
- `Route.useSearch()` / `useSearch({ from })` — validated search params
- `Route.useNavigate()` / `useNavigate()` — navigation function
- `useRouter()` — router instance, `router.invalidate()`, `router.state`
- `useMatches()` — all matched routes root to leaf
- `useMatch({ from })` — specific route match
- `useLocation()` — current location
- `useRouterState({ select })` — subscribe to router state slices

---

## 12. Outlets and Nested Routing

```tsx
export const Route = createFileRoute('/admin')({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="flex">
      <AdminSidebar />
      <main className="flex-1"><Outlet /></main>
    </div>
  );
}
```

For `/admin/users/123`: `RootLayout -> AdminLayout -> UsersLayout -> UserPage`, each connected by `<Outlet />`. If a route has no component, it renders `<Outlet />` as pass-through.

---

## 13. Search Params

Structured JSON parsing. Numbers/booleans coerced. Nested structures as URL-safe JSON.

```tsx
export const Route = createFileRoute('/products')({
  validateSearch: (raw) => searchSchema.parse(raw),
  component: ProductsPage,
});
```

Child routes inherit parent search schemas.

---

## 14. Path Params

```
$paramName.tsx  -> { paramName: string }
$.tsx           -> { _splat: string }
```

Child routes accumulate ancestor params.

---

## 15. Authenticated Routes

```tsx
// routes/_authenticated/route.tsx
export const Route = createFileRoute('/_authenticated')({
  component: () => <Outlet />,
  beforeLoad: async ({ location }) => {
    if (!await checkAuth()) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
});
```

`isRedirect()` helper for try/catch in `beforeLoad`.

---

## 16. Not Found Errors

```tsx
throw notFound();
```

Hierarchy: route `notFoundComponent` -> router `defaultNotFoundComponent` -> root `notFoundComponent`.

---

## 17. Navigation Blocking

```tsx
useBlocker({
  shouldBlockFn: ({ current, next }) => isDirty,
  withResolver: true,
  enableBeforeUnload: isDirty,
});
```

Returns `{ proceed, reset, status, next }` for custom UI. Also available as `<Block />` component.

---

## 18. Scroll Restoration

```ts
createRouter({ routeTree, scrollRestoration: true, scrollToTopSelectors: ['#main'] })
```

Per-link: `resetScroll={false}`. Element-level: `useElementScrollRestoration()`. Custom key: `getScrollRestorationKey`.

---

## 19. Route Masking

Inline: `<Link to="/modal" mask={{ to: '/clean-url' }}>`. Declarative: `createRouteMask()` on router. Masks stored in `history.state`, shared URLs get unmasked version.

---

## 20. Preloading

```ts
createRouter({ routeTree, defaultPreload: 'intent', defaultPreloadDelay: 50 })
```

Per-link: `preload="intent"`. Programmatic: `router.preloadRoute({ to, params })`.

---

## 21. Custom Search Param Serialization

```ts
createRouter({ routeTree, parseSearch: qs.parse, stringifySearch: qs.stringify })
```

---

## 22. Server Integration

```ts
const handle = await handleRequest(request, {
  routeTree, loaders, html,
  loaderBasePath: '/loader-api',
  routeBasePath: '/',
});

if (handle.matched) return handle.response;
```

Loader API requests: executes loader, returns JSON. Page requests: matches route, runs loader, injects head + dehydrated data into HTML.

---

## 23. SSR Behavior

Default: all routes SSR. Server injects `window.__RICHIE_ROUTER_DATA__`. Client hydrates without refetch. Per-route: `ssr: false` for client-only pages.

---

## 24. History Types

`createBrowserHistory()` (default), `createHashHistory()`, `createMemoryHistory({ initialEntries })`.

---

## 25. Type Utilities

`RegisteredRouter`, `RoutePaths`, `RouteById`, `LinkProps`, `getRouteApi('/path')`.

---

## 26. Custom Link Components

```tsx
const CustomLink = createLink(MyStyledAnchor);
// Fully type-safe to, params, search
```

---

## 27. Link Options

```ts
const opts = linkOptions({ to: '/posts/$postId', params: { postId: '5' } });
<Link {...opts}>View Post</Link>
navigate(opts);
```

---

## 28. Error Handling

Route-level `errorComponent`, `onError`, `onCatch`. Router-level `defaultErrorComponent`.

---

## 29. Pending States

`pendingComponent`, `pendingMs`, `pendingMinMs` per-route or as router defaults.

```tsx
const isLoading = useRouterState({ select: (s) => s.status === 'loading' });
```

---

## Appendix: Package Exports

### @richie-router/react

**Components:** RouterProvider, Link, Outlet, HeadContent, Block

**Route Factories:** createFileRoute, createRootRoute, createLink, createRouteMask

**Navigation:** redirect, notFound, isRedirect, isNotFound, linkOptions

**Hooks:** useNavigate, useParams, useSearch, useLoaderData, useRouter, useMatches, useMatch, useLocation, useRouterState, useBlocker, useElementScrollRestoration

**History:** createBrowserHistory, createHashHistory, createMemoryHistory

**Router:** createRouter

**Types:** RegisteredRouter, RoutePaths, RouteById, LinkProps, NavigateOptions

**Utilities:** getRouteApi

### @richie-router/core

**Schema:** defineLoaderSchema

**Types:** HeadConfig, HeadTag, HeadLinkTag, HeadStyleTag, HeadScriptTag, RouteTree, FileRouteTypes, InferLoaderData, InferSearchSchema

### @richie-router/server

**Server:** defineLoaders, handleRequest

### @richie-router/tooling

**Generation:** generateRouteTree, watchRouteTree

**esbuild:** richieRouterPlugin (from @richie-router/tooling/esbuild)

**Vite:** richieRouter (from @richie-router/tooling/vite)
