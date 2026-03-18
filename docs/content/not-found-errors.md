# Not Found Errors

@richie-router/ supports both route-level 404 UI and programmatic not-found flows.

## Default not-found UI

```tsx
const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => <div>Nothing matched this route.</div>,
});
```

## Route-level override

```tsx
export const Route = createFileRoute('/docs')({
  component: DocsLayout,
  notFoundComponent: () => <p>Pick a document from the list.</p>,
});
```

## Throw a not-found error from route code

```tsx
import { createFileRoute, notFound } from '@richie-router/react';

export const Route = createFileRoute('/posts/$postId')({
  beforeLoad: async ({ params }) => {
    if (!(await postExists(params.postId))) {
      notFound();
    }
  },
  component: PostPage,
});
```

Use this when a route technically matches, but the requested entity does not exist.
