# SEO and Head Tags

@richie-router/ does not do React SSR. The server-side SEO story is focused on document head tags only.

## Server-resolved head tags

Use a string `head` key in the route file:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  component: PostPage,
  head: 'post-detail',
});
```

Then resolve that key on the backend:

```ts
export const headTags = defineHeadTags(routeManifest, headTagSchema, {
  'post-detail': {
    staleTime: 10_000,
    head: async ({ params }) => {
      const post = await loadPostMeta(params.postId);

      return {
        meta: [
          { title: `${post.title} | @richie-router/` },
          { name: 'description', content: post.excerpt },
          { property: 'og:title', content: post.title },
          { property: 'og:image', content: post.coverImage },
        ],
        links: [
          { rel: 'canonical', href: `https://example.com/posts/${post.id}` },
        ],
      };
    },
  },
});
```

## Client-only head tags

If the metadata does not need to be present in the initial HTML response, use a static object or a function:

```tsx
export const Route = createFileRoute('/about')({
  component: AboutPage,
  head: {
    meta: [
      { title: 'About @richie-router/' },
      { name: 'description', content: 'Client-only metadata for a static page.' },
    ],
  },
});
```

## HTML template

The backend injects the merged head result into `<!--richie-router-head-->` inside your template. That keeps the app client-rendered while still letting crawlers and social previews see route-specific titles and meta tags.
