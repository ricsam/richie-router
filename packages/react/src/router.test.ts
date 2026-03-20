import { describe, expect, test } from 'bun:test';
import {
  createFileRoute,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from './router';

function createTestRouteTree(options?: { serverHead?: boolean }) {
  const rootRoute = createRootRoute({
    component: () => null,
  });
  const indexRoute = createFileRoute('/')({
    component: () => null,
  });
  const aboutRoute = createFileRoute('/about')({
    component: () => null,
  });

  aboutRoute._setServerHead(options?.serverHead);

  return rootRoute._addFileChildren({
    index: indexRoute,
    about: aboutRoute,
  });
}

describe('createRouter basePath', () => {
  test('strips the basePath from the current history location', () => {
    const history = createMemoryHistory({
      initialEntries: ['/project/about?tab=team#bio'],
    });
    const router = createRouter({
      routeTree: createTestRouteTree(),
      history,
      basePath: '/project',
    });

    expect(router.state.location.pathname).toBe('/about');
    expect(router.state.location.href).toBe('/about?tab=team#bio');
    expect(router.state.matches.at(-1)?.route.fullPath).toBe('/about');
  });

  test('prefixes generated hrefs and history writes with the basePath', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/project'],
    });
    const router = createRouter({
      routeTree: createTestRouteTree(),
      history,
      basePath: '/project',
    });

    expect(router.buildHref({ to: '/about' })).toBe('/project/about');

    await router.navigate({
      to: '/about',
      search: {
        tab: 'team',
      },
    });

    expect(history.location.href).toBe('/project/about?tab=team');
    expect(router.state.location.href).toBe('/about?tab=team');
  });

  test('uses the basePath for the default head API endpoint', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/project/about'],
    });
    const fetchCalls: string[] = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: string | URL | Request) => {
      fetchCalls.push(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);

      return new Response(JSON.stringify({ head: {} }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }) as typeof fetch;

    try {
      const router = createRouter({
        routeTree: createTestRouteTree({ serverHead: true }),
        history,
        basePath: '/project',
      });

      await router.load();

      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0]).toStartWith('/project/head-api?');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
