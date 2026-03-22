# Navigation

@richie-router/ uses the browser History API for navigation and gives you the same typed route targeting everywhere.

## Use links

```tsx
<Link to="/docs/$slug" params={{ slug: 'creating-a-router' }}>
  Start here
</Link>
```

## Navigate in code

```tsx
import { useNavigate } from '@richie-router/react';

function SearchButton() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        void navigate({
          to: '/search',
          search: { q: 'type safety' },
          replace: true,
        });
      }}
    >
      Open search
    </button>
  );
}
```

## Useful options

```ts
type NavigateOptions = {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown> | true;
  hash?: string;
  replace?: boolean;
  resetScroll?: boolean;
  state?: Record<string, unknown>;
  ignoreBlocker?: boolean;
};
```

Programmatic and declarative navigation use the same route definitions, so the types stay consistent.

## Match routes imperatively

`useMatchRoute()` mirrors the common TanStack Router pattern for checking whether a route matches the current location.

```tsx
import { useMatchRoute } from '@richie-router/react';

function BranchNav() {
  const matchRoute = useMatchRoute();
  const isPostsSection = Boolean(matchRoute({ to: '/posts', fuzzy: true }));

  return <span>{isPostsSection ? 'Inside posts' : 'Outside posts'}</span>;
}
```
