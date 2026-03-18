# Type Utilities

@richie-router/ leans on inference first, but it still exposes a few useful route-aware types and helpers.

## Common helpers

```ts
import type { RouteById, RoutePaths, NavigateOptions, LinkProps } from '@richie-router/react';
import type { InferHeadTagSearchSchema, ResolveAllParams } from '@richie-router/core';
```

Useful cases:

- `RoutePaths` for constraining route targets
- `NavigateOptions<'/posts/$postId'>` for helper functions that forward navigation
- `ResolveAllParams<'/posts/$postId'>` for typed path params in shared code
- `InferHeadTagSearchSchema<typeof headTagSchema, 'search-page'>` for reusing the schema output type

## Route APIs are usually enough

In most app code, the simplest option is still to let the route object carry the types:

```tsx
const postsRoute = getRouteApi('/posts/$postId');

function SharedWidget() {
  const params = postsRoute.useParams();
  return <span>{params.postId}</span>;
}
```

That keeps the types derived from the generated route tree instead of manually repeating them.
