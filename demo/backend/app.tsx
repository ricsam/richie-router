import path from 'node:path';
import { defineHeadTags, handleRequest } from '@richie-router/server';
import { routeManifest } from '../shared/route-manifest.gen';
import { headTagSchema } from '../shared/head-tag-schema';
import indexHtml from '../frontend/index.html';

const posts = [
  {
    id: 'alpha',
    title: 'Alpha Release Notes',
    excerpt: 'The first cut of Richie Router with generated file routes.',
    coverImage: 'https://example.com/images/alpha.png',
  },
  {
    id: 'typed-nav',
    title: 'Typed Navigation Deep Dive',
    excerpt: 'Making Link and navigate route-aware without manual annotations.',
    coverImage: 'https://example.com/images/typed-nav.png',
  },
  {
    id: 'head-tags',
    title: 'Server Head Tags',
    excerpt: 'Resolving SEO metadata on the server without rendering React there.',
    coverImage: 'https://example.com/images/head-tags.png',
  },
] as const;

export const headTags = defineHeadTags(routeManifest, headTagSchema, {
  'app-shell': {
    staleTime: 60_000,
    head: async () => ({
      meta: [
        { title: 'Richie Router Demo' },
        { name: 'description', content: 'A Bun + TypeScript demo for Richie Router server head tags.' },
      ],
    }),
  },
  'post-detail': {
    staleTime: 10_000,
    head: async ({ params }) => {
      const post = posts.find(entry => entry.id === params.postId);
      if (!post) {
        throw new Response('Not Found', { status: 404 });
      }

      return {
        meta: [
          { title: `${post.title} | Richie Router Demo` },
          { name: 'description', content: post.excerpt },
          { property: 'og:title', content: post.title },
          { property: 'og:image', content: post.coverImage },
        ],
      };
    },
  },
  'search-page': {
    staleTime: 5_000,
    head: async ({ search }) => ({
      meta: [
        { title: `Search: ${search.query}` },
        {
          name: 'description',
          content: `Search demo page for "${search.query}" with limit ${search.limit}.`,
        },
      ],
    }),
  },
});

export function startDemoServer(options?: { port?: number }) {
  return Bun.serve({
    port: options?.port ?? 3000,
    routes: {
      '/': indexHtml
    },
    async fetch(request) {

      const indexUrl = new URL(request.url);
      indexUrl.pathname = '/';

      const htmlTemplate = (await (await fetch(indexUrl)).text()).toString()
      
      const handled = await handleRequest(request, {
        routeManifest,
        headTags,
        headBasePath: '/head-api',
        html: {
          template: htmlTemplate,
        },
      });

      if (handled.matched) {
        return handled.response;
      }
      const url = new URL(request.url);

      if (url.pathname === '/api/posts') {
        return new Response(JSON.stringify(posts), {
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      return new Response('Not Found', { status: 404 });
    },
    'development': process.env.NODE_ENV==='production' ? false : {
      'console': true,
      'hmr': true,
    }
  });
}
