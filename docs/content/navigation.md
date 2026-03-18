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
