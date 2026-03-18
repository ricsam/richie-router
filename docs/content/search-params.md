# Search Params

Search params in @richie-router/ are typed at the route boundary.

## Validate route search

```tsx
import { z } from 'zod';
import { createFileRoute } from '@richie-router/react';

const searchSchema = z.object({
  query: z.string().default('router'),
  limit: z.coerce.number().default(5),
});

export const Route = createFileRoute('/search')({
  validateSearch: raw => searchSchema.parse(raw),
  component: SearchPage,
});
```

Inside the component, `Route.useSearch()` now returns the validated shape.

## Navigation stays typed

```tsx
<Link
  to="/search"
  search={{ query: 'head tags', limit: 10 }}
>
  Search
</Link>
```

## Head tags can participate too

If a route uses `head: 'search-page'`, the search type can also come from the shared head-tag schema. That keeps the backend head resolver and the frontend navigation types aligned.
