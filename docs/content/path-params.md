# Path Params

Dynamic segments come from file names and flow straight into typed route params.

## File naming

```text
frontend/routes/
  posts.$postId.tsx
  teams.$teamId.members.$memberId.tsx
```

This produces:

- `/posts/:postId`
- `/teams/:teamId/members/:memberId`

## Reading params

```tsx
export const Route = createFileRoute('/posts/$postId')({
  component: PostPage,
});

function PostPage() {
  const { postId } = Route.useParams();
  return <h1>{postId}</h1>;
}
```

## Navigating with params

```tsx
<Link to="/posts/$postId" params={{ postId: 'alpha' }}>
  Open Alpha
</Link>
```

Missing params are compile-time errors, so dynamic URLs stay honest.

Path params still use normal URL encoding for reserved characters, but `@` is preserved in path segments so username-style routes can render clean URLs like `/@alice`.
