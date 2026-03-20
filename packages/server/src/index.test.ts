import { describe, expect, test } from 'bun:test';
import { defineRouterSchema, redirect, createRouteNode } from '@richie-router/core';
import { defineHeadTags, handleRequest, handleSpaRequest } from './index';

function createTestArtifacts(options?: { redirectAbout?: boolean }) {
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
  });

  const headTags = defineHeadTags(rootRoute, routerSchema, {
    '/about': {
      head: () => {
        if (options?.redirectAbout) {
          redirect({ to: '/' });
        }

        return {
          meta: [{ title: 'About' }],
        };
      },
    },
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
    },
  };
}

describe('handleSpaRequest', () => {
  test('matches document requests under the basePath with a routeManifest', async () => {
    const { routeManifest } = createTestArtifacts();

    const result = await handleSpaRequest(new Request('https://example.com/project/about'), {
      routeManifest,
      basePath: '/project',
      html: {
        template: '<html><head><!--richie-router-head--></head><body><div id="app"></div></body></html>',
      },
    });

    expect(result.matched).toBe(true);
    expect(result.response.status).toBe(200);

    const html = await result.response.text();
    expect(html).not.toContain('window.__RICHIE_ROUTER_HEAD__');
    expect(html).toContain('<div id="app"></div>');
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

  test('requires the head placeholder for string templates', async () => {
    const { routeManifest } = createTestArtifacts();

    let thrown: unknown;
    try {
      await handleSpaRequest(new Request('https://example.com/project/about'), {
        routeManifest,
        basePath: '/project',
        html: {
          template: '<html><head></head><body></body></html>',
        },
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain('<!--richie-router-head-->');
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
      head: {
        meta: [{ title: 'About' }],
      },
    });
  });
});
