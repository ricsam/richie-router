# Preloading

@richie-router/ can preload route transitions before the user clicks.

## Router defaults

```tsx
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadDelay: 50,
});
```

`intent` starts preloading on hover and focus. `render` starts it when the link mounts. `false` disables it.

## Per-link control

```tsx
<Link
  to="/posts/$postId"
  params={{ postId: 'alpha' }}
  preload="intent"
>
  Hover to preload
</Link>
```

## Programmatic preloading

```tsx
await router.preloadRoute({
  to: '/search',
  search: { q: 'head tags' },
});
```

## What gets preloaded

@richie-router/ preloads routing work and server head tags. It does not include a built-in data loading layer.
