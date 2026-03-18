# Custom Link Components

If you already have a design-system link, wrap it with `createLink` to make it route-aware.

## Example

```tsx
import { createLink } from '@richie-router/react';

function ButtonLink(props: React.ComponentProps<'a'>) {
  return (
    <a
      {...props}
      style={{
        display: 'inline-flex',
        padding: '0.75rem 1rem',
        borderRadius: '999px',
        border: '1px solid currentColor',
      }}
    />
  );
}

export const AppLink = createLink(ButtonLink);
```

Use it just like the built-in `Link`:

```tsx
<AppLink to="/docs/$slug" params={{ slug: 'type-safety' }}>
  Read the guide
</AppLink>
```

You still get typed params, typed search, preloading, active props, and client-side navigation.
