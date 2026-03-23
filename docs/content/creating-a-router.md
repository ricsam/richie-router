# Creating a Router

@richie-router/ starts with generated file routes and a single client-side router instance.

## 1. Generate the route artifacts

The tooling step produces these files:

- `route-tree.gen.ts` for the client router
- `route-manifest.gen.ts` for the backend head-tag matcher
- `spa-routes.gen.json` (optional) for backend SPA-route forwarding rules
- `router-schema.ts` for shared search schemas and server-head flags

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

## 2. Create the router

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

`basePath` is the SPA pathname prefix, such as `https://host.com/project/*`. It changes route matching, `useLocation()`, and generated link/history hrefs. `headBasePath` now lives in `defineRouterSchema(..., { headBasePath })`, alongside `passthrough`. If you omit it, Richie Router defaults to `/head-api`, and that path is implicitly treated as a passthrough route.

## 3. Register the router type

This powers typed `Link`, `useNavigate`, `useParams`, and `useSearch` calls across the app.

```tsx
declare module '@richie-router/react' {
  interface Register {
    router: typeof router;
  }
}
```

## 4. Mount the app

@richie-router/ is SPA-only. The server returns the HTML shell and head tags, then the client mounts into `#app`.

```tsx
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@richie-router/react';
import { router } from './router';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container.');

createRoot(container).render(<RouterProvider router={router} />);
```
