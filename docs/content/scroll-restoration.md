# Scroll Restoration

@richie-router/ currently includes router-level scroll reset behavior for SPA navigation.

## Enable it on the router

```tsx
const router = createRouter({
  routeTree,
  scrollRestoration: true,
  scrollToTopSelectors: ['#main-content'],
});
```

With this enabled, @richie-router/ scrolls the window to the top after successful navigation and also resets any configured containers to the top.

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

The scroll-to-top behavior behind `scrollRestoration` and `scrollToTopSelectors` is implemented today.

Full history-position restoration is not implemented yet, and the exported `useElementScrollRestoration()` hook is still a placeholder. If you need per-element restoration today, use the router-wide reset plus explicit scroll management inside your components.
