# Creating a Router

@richie-router/ starts with generated file routes and a single client-side router instance.

## 1. Generate the route artifacts

The tooling step produces two files:

- `route-tree.gen.ts` for the client router
- `route-manifest.gen.ts` for the backend head-tag matcher

```ts
import { generateRouteTree } from '@richie-router/tooling';

await generateRouteTree({
  routesDir: './frontend/routes',
  headTagSchema: './shared/head-tag-schema.ts',
  output: './shared/route-tree.gen.ts',
  manifestOutput: './shared/route-manifest.gen.ts',
});
```

## 2. Create the router

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
