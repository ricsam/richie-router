import { describe, expect, test } from 'bun:test';
import { defineRouterSchema, redirect, createRouteNode } from '@richie-router/core';
import { defineHeadTags, handleHeadRequest, handleHeadTagRequest, handleRequest, handleSpaRequest, matchesPassthroughPath, matchesSpaPath } from './index';

function createTestArtifacts(options?: {
  redirectAbout?: boolean;
  customHeadElement?: boolean;
  aboutStaleTime?: number;
  headBasePath?: string;
}) {
  const rootRoute = createRouteNode('__root__', {}, { isRoot: true });
  const indexRoute = createRouteNode('/', {});
  const authRoute = createRouteNode('/_auth', {});
  const authDashboardRoute = createRouteNode('/_auth/dashboard', {});
  const aboutRoute = createRouteNode('/about', {});
  const postsRoute = createRouteNode('/posts', {});
  const postsIndexRoute = createRouteNode('/posts/', {});
  const postsPostIdRoute = createRouteNode('/posts/$postId', {});

  aboutRoute._setServerHead(true);

  authRoute._addFileChildren({
    dashboard: authDashboardRoute,
  });
  postsRoute._addFileChildren({
    index: postsIndexRoute,
    postId: postsPostIdRoute,
  });
  rootRoute._addFileChildren({
    index: indexRoute,
    auth: authRoute,
    about: aboutRoute,
    posts: postsRoute,
  });

  const routerSchema = defineRouterSchema({
    '/about': {
      serverHead: true,
    },
  }, {
    passthrough: ['/api/$'],
    headBasePath: options?.headBasePath,
  });

  const headTags = defineHeadTags(rootRoute, routerSchema, {
    '/about': {
      staleTime: options?.aboutStaleTime,
      head: () => {
        if (options?.redirectAbout) {
          redirect({ to: '/' });
        }

        return [
          { tag: 'title', children: 'About' },
          ...(options?.customHeadElement
            ? [{
                tag: 'link' as const,
                rel: 'icon',
                href: '/favicon.ico',
                sizes: 'any',
              }]
            : []),
        ];
      },
    },
  });
  rootRoute._setHostedRouting({
    headBasePath: options?.headBasePath ?? '/head-api',
    passthrough: [options?.headBasePath ?? '/head-api', '/api/$'],
  });

  return {
    routeManifest: rootRoute,
    headTags,
    spaRoutesManifest: {
      routes: [
        { id: '__root__', to: '/', parentId: null, isRoot: true },
        { id: '/', to: '/', parentId: '__root__', isRoot: false },
        { id: '/_auth', to: '/', parentId: '__root__', isRoot: false },
        { id: '/_auth/dashboard', to: '/dashboard', parentId: '/_auth', isRoot: false },
        { id: '/about', to: '/about', parentId: '__root__', isRoot: false },
        { id: '/posts', to: '/posts', parentId: '__root__', isRoot: false },
        { id: '/posts/', to: '/posts', parentId: '/posts', isRoot: false },
        { id: '/posts/$postId', to: '/posts/$postId', parentId: '/posts', isRoot: false },
      ],
      spaRoutes: ['/', '/about', '/dashboard', '/posts', '/posts/$postId'],
      hostedRouting: {
        headBasePath: options?.headBasePath ?? '/head-api',
        passthrough: [options?.headBasePath ?? '/head-api', '/api/$'],
      },
    },
  };
}

function createCompetingHeadArtifacts() {
  const rootRoute = createRouteNode('__root__', {}, { isRoot: true });
  const usernameRoute = createRouteNode('/$username', {});
  const usernameIndexRoute = createRouteNode('/$username/', {});
  const usernameSlugRoute = createRouteNode('/$username/$slug', {});
  const loginRoute = createRouteNode('/login', {});
  const registerRoute = createRouteNode('/register', {});
  const tagsTagRoute = createRouteNode('/tags/$tag', {});

  usernameRoute._setServerHead(true);
  usernameIndexRoute._setServerHead(true);
  usernameSlugRoute._setServerHead(true);
  loginRoute._setServerHead(true);
  registerRoute._setServerHead(true);
  tagsTagRoute._setServerHead(true);

  usernameRoute._addFileChildren({
    index: usernameIndexRoute,
    slug: usernameSlugRoute,
  });

  rootRoute._addFileChildren({
    username: usernameRoute,
    login: loginRoute,
    register: registerRoute,
    tags: tagsTagRoute,
  });

  const routerSchema = defineRouterSchema({
    '/$username/': {
      serverHead: true,
    },
    '/$username/$slug': {
      serverHead: true,
    },
    '/login': {
      serverHead: true,
    },
    '/register': {
      serverHead: true,
    },
    '/tags/$tag': {
      serverHead: true,
    },
  });

  const headTags = defineHeadTags(rootRoute, routerSchema, {
    '/$username/': {
      head: ({ params }) => [
        { tag: 'title', children: `User ${params.username}` },
      ],
    },
    '/$username/$slug': {
      head: ({ params }) => [
        { tag: 'title', children: `Post ${params.username}/${params.slug}` },
      ],
    },
    '/login': {
      head: () => [
        { tag: 'title', children: 'Login' },
      ],
    },
    '/register': {
      head: () => [
        { tag: 'title', children: 'Register' },
      ],
    },
    '/tags/$tag': {
      head: ({ params }) => [
        { tag: 'title', children: `Tag ${params.tag}` },
      ],
    },
  });

  return {
    headTags,
  };
}

function createUsernameRedirectArtifacts() {
  const rootRoute = createRouteNode('__root__', {}, { isRoot: true });
  const usernameRoute = createRouteNode('/$username', {});
  const legacyUsernameRoute = createRouteNode('/legacy/$username', {});

  usernameRoute._setServerHead(true);
  legacyUsernameRoute._setServerHead(true);

  rootRoute._addFileChildren({
    username: usernameRoute,
    legacyUsername: legacyUsernameRoute,
  });

  const routerSchema = defineRouterSchema({
    '/$username': {
      serverHead: true,
    },
    '/legacy/$username': {
      serverHead: true,
    },
  });

  const headTags = defineHeadTags(rootRoute, routerSchema, {
    '/$username': {
      head: ({ params }) => [
        { tag: 'title', children: `User ${params.username}` },
      ],
    },
    '/legacy/$username': {
      head: ({ params }) => {
        redirect({
          to: '/$username',
          params: {
            username: params.username,
          },
        });
      },
    },
  });

  return {
    routeManifest: rootRoute,
    headTags,
  };
}

describe('handleSpaRequest', () => {
  test('treats "/" as the root basePath and trims trailing slashes', () => {
    const { spaRoutesManifest } = createTestArtifacts();

    expect(matchesSpaPath('/about', {
      spaRoutesManifest,
      basePath: '/',
    })).toBe(true);

    expect(matchesSpaPath('/project/about', {
      spaRoutesManifest,
      basePath: '/project/',
    })).toBe(true);
  });

  test('exposes a pure SPA matcher for host-side routing decisions', () => {
    const { spaRoutesManifest, routeManifest } = createTestArtifacts();

    expect(matchesSpaPath('/project/about', {
      spaRoutesManifest,
      basePath: '/project',
    })).toBe(true);

    expect(matchesSpaPath('/project/posts/123', {
      routeManifest,
      basePath: '/project',
    })).toBe(true);

    expect(matchesSpaPath('/project/api/health', {
      spaRoutesManifest,
      basePath: '/project',
    })).toBe(false);
  });

  test('exposes passthrough matching for host-side routing decisions', () => {
    const { spaRoutesManifest, routeManifest } = createTestArtifacts();

    expect(matchesPassthroughPath('/project/head-api', {
      spaRoutesManifest,
      basePath: '/project',
    })).toBe(true);

    expect(matchesPassthroughPath('/project/api/health', {
      routeManifest,
      basePath: '/project',
    })).toBe(true);

    expect(matchesPassthroughPath('/project/about', {
      spaRoutesManifest,
      basePath: '/project',
    })).toBe(false);
  });

  test('matches document requests under the basePath with a routeManifest', async () => {
    const { routeManifest } = createTestArtifacts();

    const result = await handleSpaRequest(new Request('https://example.com/project/about'), {
      routeManifest,
      basePath: '/project',
      headers: {
        'cache-control': 'no-cache',
      },
      html: {
        template: '<html><head><!--richie-router-head--></head><body><div id="app"></div></body></html>',
      },
    });

    expect(result.matched).toBe(true);
    expect(result.response.status).toBe(200);

    const html = await result.response.text();
    expect(html).not.toContain('window.__RICHIE_ROUTER_HEAD__');
    expect(html).toContain('<div id="app"></div>');
    expect(result.response.headers.get('cache-control')).toBe('no-cache');
  });

  test('matches document requests under the basePath with a spaRoutesManifest', async () => {
    const { spaRoutesManifest } = createTestArtifacts();

    const result = await handleSpaRequest(new Request('https://example.com/project/about'), {
      spaRoutesManifest,
      basePath: '/project',
      html: {
        template: '<html><head><!--richie-router-head--></head><body><div id="app"></div></body></html>',
      },
    });

    expect(result.matched).toBe(true);
    expect(result.response.status).toBe(200);
  });

  test('does not match sibling paths that only share the same prefix', async () => {
    const { spaRoutesManifest } = createTestArtifacts();

    const result = await handleSpaRequest(new Request('https://example.com/projectish/about'), {
      spaRoutesManifest,
      basePath: '/project',
      html: {
        template: '<html><head><!--richie-router-head--></head><body></body></html>',
      },
    });

    expect(result.matched).toBe(false);
    expect(result.response.status).toBe(404);
  });

  test('matches dynamic and pathless-derived public routes from a spaRoutesManifest', async () => {
    const { spaRoutesManifest } = createTestArtifacts();

    for (const pathname of ['/project/dashboard', '/project/posts/123']) {
      const result = await handleSpaRequest(new Request(`https://example.com${pathname}`), {
        spaRoutesManifest,
        basePath: '/project',
        html: {
          template: '<html><head><!--richie-router-head--></head><body><div id="app"></div></body></html>',
        },
      });

      expect(result.matched).toBe(true);
      expect(result.response.status).toBe(200);
    }
  });

  test('allows string templates without the head placeholder', async () => {
    const { routeManifest } = createTestArtifacts();

    const result = await handleSpaRequest(new Request('https://example.com/project/about'), {
      routeManifest,
      basePath: '/project',
      html: {
        template: '<html><head></head><body><div id="app"></div></body></html>',
      },
    });

    expect(result.matched).toBe(true);
    expect(await result.response.text()).toContain('<div id="app"></div>');
  });
});

describe('handleRequest basePath', () => {
  test('matches document requests under the basePath', async () => {
    const { routeManifest, headTags } = createTestArtifacts();

    const result = await handleRequest(new Request('https://example.com/project/about'), {
      routeManifest,
      headTags,
      basePath: '/project',
      html: {
        template: '<html><head><!--richie-router-head--></head><body><div id="app"></div></body></html>',
      },
    });

    expect(result.matched).toBe(true);
    expect(result.response.status).toBe(200);

    const html = await result.response.text();
    expect(html).toContain('About</title>');
    expect(html).toContain('<div id="app"></div>');
  });

  test('does not match sibling paths that only share the same prefix', async () => {
    const { routeManifest, headTags } = createTestArtifacts();

    const result = await handleRequest(new Request('https://example.com/projectish/about'), {
      routeManifest,
      headTags,
      basePath: '/project',
      html: {
        template: '<html><head><!--richie-router-head--></head><body></body></html>',
      },
    });

    expect(result.matched).toBe(false);
    expect(result.response.status).toBe(404);
  });

  test('prefixes redirects with the basePath', async () => {
    const { routeManifest, headTags } = createTestArtifacts({
      redirectAbout: true,
    });

    const result = await handleRequest(new Request('https://example.com/project/about'), {
      routeManifest,
      headTags,
      basePath: '/project',
      html: {
        template: '<html><head><!--richie-router-head--></head><body></body></html>',
      },
    });

    expect(result.matched).toBe(true);
    expect(result.response.status).toBe(302);
    expect(result.response.headers.get('location')).toBe('/project');
  });

  test('preserves @ in redirect targets built from params', async () => {
    const { routeManifest, headTags } = createUsernameRedirectArtifacts();

    const result = await handleRequest(new Request('https://example.com/project/legacy/%40alice'), {
      routeManifest,
      headTags,
      basePath: '/project',
      html: {
        template: '<html><head><!--richie-router-head--></head><body></body></html>',
      },
    });

    expect(result.matched).toBe(true);
    expect(result.response.status).toBe(302);
    expect(result.response.headers.get('location')).toBe('/project/@alice');
  });

  test('uses the basePath for default head API requests handled through handleRequest', async () => {
    const { routeManifest, headTags } = createTestArtifacts();

    const result = await handleRequest(
      new Request(
        'https://example.com/project/head-api?routeId=%2Fabout&params=%7B%7D&search=%7B%7D',
      ),
      {
        routeManifest,
        headTags,
        basePath: '/project',
        html: {
          template: '<html><head><!--richie-router-head--></head><body></body></html>',
        },
      },
    );

    expect(result.matched).toBe(true);
    expect(result.response.status).toBe(200);
    expect(await result.response.json()).toEqual({
      head: [
        { tag: 'title', children: 'About' },
      ],
    });
  });

  test('allows direct head tag handling with basePath shorthand', async () => {
    const { headTags } = createTestArtifacts();

    const result = await handleHeadTagRequest(
      new Request(
        'https://example.com/project/head-api?routeId=%2Fabout&params=%7B%7D&search=%7B%7D',
      ),
      {
        headTags,
        basePath: '/project',
      },
    );

    expect(result.matched).toBe(true);
    expect(result.response.status).toBe(200);
    expect(await result.response.json()).toEqual({
      head: [
        { tag: 'title', children: 'About' },
      ],
    });
  });

  test('reads a custom headBasePath from the router schema', async () => {
    const { headTags } = createTestArtifacts({
      headBasePath: '/meta',
    });

    const result = await handleHeadTagRequest(
      new Request(
        'https://example.com/project/meta?routeId=%2Fabout&params=%7B%7D&search=%7B%7D',
      ),
      {
        headTags,
        basePath: '/project',
      },
    );

    expect(result.matched).toBe(true);
    expect(result.response.status).toBe(200);
    expect(await result.response.json()).toEqual({
      head: [
        { tag: 'title', children: 'About' },
      ],
    });
  });

  test('resolves merged document head payloads for host-rendered HTML shells', async () => {
    const { headTags } = createTestArtifacts();

    const result = await handleHeadRequest(
      new Request(
        'https://example.com/project/head-api?href=%2Fproject%2Fabout',
      ),
      {
        headTags,
        basePath: '/project',
      },
    );

    expect(result.matched).toBe(true);
    expect(result.response.status).toBe(200);

    const payload = await result.response.json();
    expect(payload.href).toBe('/about');
    expect(payload.head).toEqual([
      { tag: 'title', children: 'About' },
    ]);
    expect(payload.routeHeads).toEqual([
      {
        routeId: '/about',
        head: [
          { tag: 'title', children: 'About' },
        ],
      },
    ]);
    expect(payload.richieRouterHead).toContain('About</title>');
    expect(payload.richieRouterHead).toContain('window.__RICHIE_ROUTER_HEAD__');
    expect(result.response.headers.get('cache-control')).toBe('private, no-store');
  });

  test('prefers static routes over dynamic siblings when resolving document head payloads', async () => {
    const { headTags } = createCompetingHeadArtifacts();

    const tagResult = await handleHeadRequest(
      new Request('https://example.com/head-api?href=%2Ftags%2Ftesting'),
      {
        headTags,
      },
    );

    expect(tagResult.matched).toBe(true);
    expect(await tagResult.response.json()).toMatchObject({
      href: '/tags/testing',
      routeHeads: [
        {
          routeId: '/tags/$tag',
          head: [
            { tag: 'title', children: 'Tag testing' },
          ],
        },
      ],
    });

    const loginResult = await handleHeadRequest(
      new Request('https://example.com/head-api?href=%2Flogin'),
      {
        headTags,
      },
    );

    expect(loginResult.matched).toBe(true);
    expect(await loginResult.response.json()).toMatchObject({
      href: '/login',
      routeHeads: [
        {
          routeId: '/login',
          head: [
            { tag: 'title', children: 'Login' },
          ],
        },
      ],
    });
  });

  test('returns redirect responses for document head payload requests', async () => {
    const { headTags } = createTestArtifacts({
      redirectAbout: true,
    });

    const result = await handleHeadRequest(
      new Request(
        'https://example.com/project/head-api?href=%2Fproject%2Fabout',
      ),
      {
        headTags,
        basePath: '/project',
      },
    );

    expect(result.matched).toBe(true);
    expect(result.response.status).toBe(302);
    expect(result.response.headers.get('location')).toBe('/project');
  });

  test('serializes custom head elements for rich host templates', async () => {
    const { headTags } = createTestArtifacts({
      customHeadElement: true,
    });

    const result = await handleHeadRequest(
      new Request(
        'https://example.com/project/head-api?href=%2Fproject%2Fabout',
      ),
      {
        headTags,
        basePath: '/project',
      },
    );

    const payload = await result.response.json();
    expect(payload.richieRouterHead).toContain('<link rel="icon" href="/favicon.ico" sizes="any" data-richie-router-head="true">');
  });

  test('derives cache-control headers from route staleTime', async () => {
    const { headTags } = createTestArtifacts({
      aboutStaleTime: 60_000,
    });

    const result = await handleHeadRequest(
      new Request(
        'https://example.com/project/head-api?routeId=%2Fabout&params=%7B%7D&search=%7B%7D',
      ),
      {
        headTags,
        basePath: '/project',
      },
    );

    expect(result.response.headers.get('cache-control')).toBe('private, max-age=60');
    expect(await result.response.json()).toEqual({
      head: [
        { tag: 'title', children: 'About' },
      ],
      staleTime: 60_000,
    });
  });

  test('derives document cache-control headers from the matched staleTime', async () => {
    const { headTags } = createTestArtifacts({
      aboutStaleTime: 5_000,
    });

    const result = await handleHeadRequest(
      new Request(
        'https://example.com/project/head-api?href=%2Fproject%2Fabout',
      ),
      {
        headTags,
        basePath: '/project',
      },
    );

    expect(result.response.headers.get('cache-control')).toBe('private, max-age=5');

    const payload = await result.response.json();
    expect(payload.staleTime).toBe(5_000);
    expect(payload.routeHeads).toEqual([
      {
        routeId: '/about',
        head: [
          { tag: 'title', children: 'About' },
        ],
        staleTime: 5_000,
      },
    ]);
  });

  test('preserves custom headers on successful document responses', async () => {
    const { routeManifest, headTags } = createTestArtifacts();

    const result = await handleRequest(new Request('https://example.com/project/about'), {
      routeManifest,
      headTags,
      basePath: '/project',
      headers: {
        'cache-control': 'no-cache',
      },
      html: {
        template: '<html><head><!--richie-router-head--></head><body><div id="app"></div></body></html>',
      },
    });

    expect(result.matched).toBe(true);
    expect(result.response.headers.get('cache-control')).toBe('no-cache');
  });
});
