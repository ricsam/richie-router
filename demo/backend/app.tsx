import { defineHeadTags, handleHeadTagRequest, handleRequest } from '@richie-router/server';
import { routeManifest } from '../shared/route-manifest.gen';
import { routerSchema } from '../shared/router-schema';
import type { DemoPost } from '../shared/posts';
import indexHtml from '../frontend/index.html';

const TEMPLATE_PATH = '/__richie-router-template';

const posts: DemoPost[] = [
  {
    id: 'alpha',
    title: 'Alpha Release Notes',
    excerpt: 'The first cut of Richie Router with generated file routes.',
    body: 'This page is client-rendered. The document head comes from the backend via a server head tag definition.',
    coverImage: 'https://example.com/images/alpha.png',
  },
  {
    id: 'typed-nav',
    title: 'Typed Navigation Deep Dive',
    excerpt: 'Making Link and navigate route-aware without manual annotations.',
    body: 'Route params and search stay type-safe even though the router is now fully client-rendered.',
    coverImage: 'https://example.com/images/typed-nav.png',
  },
  {
    id: 'head-tags',
    title: 'Server Head Tags',
    excerpt: 'Resolving SEO metadata on the server without rendering React there.',
    body: 'The backend matches the route manifest, resolves head tags, and returns the SPA shell with enriched head markup.',
    coverImage: 'https://example.com/images/head-tags.png',
  },
];

export const headTags = defineHeadTags(routeManifest, routerSchema, {
  __root__: {
    staleTime: 60_000,
    head: async () => ({
      meta: [
        { title: 'Richie Router Demo' },
        { name: 'description', content: 'A Bun + TypeScript demo for Richie Router server head tags.' },
      ],
    }),
  },
  '/posts/$postId': {
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
  '/search': {
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
      [TEMPLATE_PATH]: indexHtml,
    },
    async fetch(request) {
      const url = new URL(request.url);

      if (url.pathname === '/api/posts') {
        return new Response(JSON.stringify(posts), {
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      const handledHeadTagRequest = await handleHeadTagRequest(request, {
        headTags,
        headBasePath: '/head-api',
      });

      if (handledHeadTagRequest.matched) {
        return handledHeadTagRequest.response;
      }

      const templateUrl = new URL(request.url);
      templateUrl.pathname = TEMPLATE_PATH;

      const htmlTemplate = await (await fetch(templateUrl)).text();

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

      return new Response('Not Found', { status: 404 });
    },
    development:
      process.env.NODE_ENV === 'production'
        ? false
        : {
            console: true,
            hmr: true,
          },
  });
}
