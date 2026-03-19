# Search Params

Search params in @richie-router/ are typed at the route boundary through the shared `routerSchema`.

## Define shared route search

```ts
import { z } from 'zod';
import { defineRouterSchema } from '@richie-router/core';

export const routerSchema = defineRouterSchema({
  '/search': {
    searchSchema: z.object({
      query: z.string().default('router'),
      limit: z.coerce.number().default(5),
    }),
  },
});
```

Inside the component, `Route.useSearch()` now returns the validated shape for that route.

## Navigation stays typed

```tsx
<Link
  to="/search"
  search={{ query: 'head tags', limit: 10 }}
>
  Search
</Link>
```

## Server head tags use the same schema

If a route also sets `serverHead: true`, the backend head resolver receives the same parsed search shape as the client.
