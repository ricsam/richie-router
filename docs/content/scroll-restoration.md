# Scroll Restoration

@richie-router/ includes router-level scroll restoration for SPA navigation.

## Enable it on the router

```tsx
const router = createRouter({
  routeTree,
  scrollRestoration: true,
  scrollToTopSelectors: ['#main-content'],
});
```

With this enabled, @richie-router/ restores history scroll positions and also scrolls the configured containers to the top after navigation.

## Skip the reset for a navigation

```tsx
<Link to="/docs/$slug" params={{ slug: 'type-safety' }} resetScroll={false}>
  Keep scroll
</Link>
```

```tsx
await navigate({
  to: '/search',
  search: { q: 'router' },
  resetScroll: false,
});
```

## Current status

`scrollRestoration` and `scrollToTopSelectors` are implemented today.

The exported `useElementScrollRestoration()` hook exists, but the current implementation is still a placeholder. If you need per-element restoration today, use the router-wide restoration plus explicit scroll management inside your components.
