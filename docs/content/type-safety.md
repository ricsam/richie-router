# Type Safety

@richie-router/ pushes generated route types through navigation, hooks, and route APIs so you write less manual typing.

## Route-aware links and navigation

```tsx
import { Link, useNavigate } from '@richie-router/react';

function PostsNav() {
  const navigate = useNavigate();

  return (
    <>
      <Link to="/posts/$postId" params={{ postId: 'alpha' }}>
        Alpha
      </Link>
      <button
        type="button"
        onClick={() => {
          void navigate({
            to: '/search',
            search: { query: 'router', limit: 3 },
          });
        }}
      >
        Search
      </button>
    </>
  );
}
```

These calls fail at compile time if the path params or search params do not match the generated route types.

## Route-local hooks

Every route object exposes typed helpers:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  component: PostPage,
});

function PostPage() {
  const { postId } = Route.useParams();
  const search = Route.useSearch();

  return <div>{postId}</div>;
}
```

## Shared components

If you need typed route state outside the route module, use `getRouteApi`.

```tsx
import { getRouteApi } from '@richie-router/react';

const postsRoute = getRouteApi('/posts/$postId');

function SharedPostInfo() {
  const params = postsRoute.useParams();
  return <span>{params.postId}</span>;
}
```

## Search params from head-tag schemas

Routes with `head: 'key'` can pick up typed search params from the shared head-tag schema, even though the backend never imports the frontend route modules.
