# Custom Search Param Serialization

@richie-router/ ships with default search parsing and stringifying, but you can swap in your own serialization strategy at the router level.

## Router options

```tsx
import { createRouter } from '@richie-router/react';

const router = createRouter({
  routeTree,
  parseSearch: searchStr => {
    const params = new URLSearchParams(searchStr.startsWith('?') ? searchStr.slice(1) : searchStr);
    return {
      filters: params.getAll('filter'),
      page: Number(params.get('page') ?? 1),
    };
  },
  stringifySearch: search => {
    const params = new URLSearchParams();

    for (const filter of (search.filters as string[] | undefined) ?? []) {
      params.append('filter', filter);
    }

    params.set('page', String(search.page ?? 1));
    const value = params.toString();
    return value ? `?${value}` : '';
  },
});
```

## Where validation still lives

Custom serialization controls how the URL turns into raw search data. Route-level parsing still happens through the shared `routerSchema`.

## Good use cases

- repeated query params like `?filter=a&filter=b`
- compatibility with an existing URL format
- preserving a pre-existing API or product surface while adopting @richie-router/
