# SEO and Head Tags

@richie-router/ does not do React SSR. The server-side SEO story is focused on document head tags only.

## Server-resolved head tags

Mark the route in `routerSchema`:

```ts
export const routerSchema = defineRouterSchema({
  '/posts/$postId': {
    serverHead: true,
  },
});
```

The route file stays focused on the client:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  component: PostPage,
});
```

Then resolve that route ID on the backend:

```ts
export const headTags = defineHeadTags(routeManifest, routerSchema, {
  '/posts/$postId': {
    staleTime: 10_000,
    head: async ({ params }) => {
      const post = await loadPostMeta(params.postId);

      return [
        { tag: 'title', children: `${post.title} | @richie-router/` },
        { tag: 'meta', name: 'description', content: post.excerpt },
        { tag: 'meta', property: 'og:title', content: post.title },
        { tag: 'meta', property: 'og:image', content: post.coverImage },
        {
          tag: 'link',
          rel: 'canonical',
          href: `https://example.com/posts/${post.id}`,
        },
      ];
    },
  },
});
```

## Client-only head tags

If the metadata does not need to be present in the initial HTML response, use a static object or a function in the route file:

```tsx
export const Route = createFileRoute('/about')({
  component: AboutPage,
  head: [
    { tag: 'title', children: 'About @richie-router/' },
    {
      tag: 'meta',
      name: 'description',
      content: 'Client-only metadata for a static page.',
    },
  ],
});
```

## HTML template

The backend injects the merged head result into `<!--richie-router-head-->` inside your template. That keeps the app client-rendered while still letting crawlers and social previews see route-specific titles and meta tags.
