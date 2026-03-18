# Outlets

Nested layouts in @richie-router/ render their matched children with `Outlet`.

## Layout route

```tsx
import { Outlet, createFileRoute } from '@richie-router/react';

export const Route = createFileRoute('/posts')({
  component: PostsLayout,
});

function PostsLayout() {
  return (
    <section>
      <aside>Post navigation</aside>
      <div>
        <Outlet />
      </div>
    </section>
  );
}
```

## Child routes

```text
frontend/routes/
  posts.tsx
  posts.index.tsx
  posts.$postId.tsx
```

This gives you:

- `/posts` for the index child
- `/posts/:postId` for the detail child

`Outlet` is how the matched child route renders inside the parent layout.
