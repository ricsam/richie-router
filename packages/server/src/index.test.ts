import { describe, expect, test } from 'bun:test';
import { defineRouterSchema, redirect, createRouteNode } from '@richie-router/core';
import { defineHeadTags, handleRequest } from './index';

function createTestRouteManifest(options?: { redirectAbout?: boolean }) {
  const rootRoute = createRouteNode('__root__', {}, { isRoot: true });
  const indexRoute = createRouteNode('/', {});
  const aboutRoute = createRouteNode('/about', {});

  aboutRoute._setServerHead(true);
  rootRoute._addFileChildren({
    index: indexRoute,
    about: aboutRoute,
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
  };
}

describe('handleRequest basePath', () => {
  test('matches document requests under the basePath', async () => {
    const { routeManifest, headTags } = createTestRouteManifest();

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
    const { routeManifest, headTags } = createTestRouteManifest();

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
    const { routeManifest, headTags } = createTestRouteManifest({
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
    const { routeManifest, headTags } = createTestRouteManifest();

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
