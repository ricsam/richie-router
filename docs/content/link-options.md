# Link Options

`linkOptions()` is a small helper for building typed navigation objects once and reusing them.

## Reuse typed route targets

```tsx
import { Link, linkOptions } from '@richie-router/react';

const searchLink = linkOptions({
  to: '/search',
  search: {
    q: 'router',
  },
});

function Header() {
  return <Link {...searchLink}>Search docs</Link>;
}
```

## Why it helps

- keeps shared navigation objects type-safe
- catches missing params before runtime
- lets you reuse the same target across links, buttons, and programmatic navigation

```tsx
const postLink = linkOptions({
  to: '/posts/$postId',
  params: { postId: 'alpha' },
});
```

If the route shape changes, TypeScript will point at the reusable object instead of letting drift spread across the app.
