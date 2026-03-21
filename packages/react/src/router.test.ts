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

function createNestedHeadRouteTree() {
  const rootRoute = createRootRoute({
    component: () => null,
  });
  const postsRoute = createFileRoute('/posts')({
    component: () => null,
    head: [
      { tag: 'title', children: 'Posts' },
    ],
  });
  const postRoute = createFileRoute('/posts/$postId')({
    component: () => null,
  });

  rootRoute._setServerHead(true);
  postRoute._setServerHead(true);
  postsRoute._addFileChildren({
    post: postRoute,
  });

  return rootRoute._addFileChildren({
    posts: postsRoute,
  });
}

function createRootServerHeadTree() {
  const rootRoute = createRootRoute({
    component: () => null,
  });
  const indexRoute = createFileRoute('/')({
    component: () => null,
  });
  const aboutRoute = createFileRoute('/about')({
    component: () => null,
  });

  rootRoute._setServerHead(true);

  return rootRoute._addFileChildren({
    index: indexRoute,
    about: aboutRoute,
  });
}

function createNestedServerHeadTree() {
  const rootRoute = createRootRoute({
    component: () => null,
  });
  const postsRoute = createFileRoute('/posts')({
    component: () => null,
  });
  const postRoute = createFileRoute('/posts/$postId')({
    component: () => null,
  });

  rootRoute._setServerHead(true);
  postsRoute._setServerHead(true);
  postRoute._setServerHead(true);
  postsRoute._addFileChildren({
    post: postRoute,
  });

  return rootRoute._addFileChildren({
    posts: postsRoute,
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

      return new Response(JSON.stringify({
        head: [],
        routeHeads: [
          { routeId: '/about', head: [] },
        ],
      }), {
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
      expect(fetchCalls[0]).toBe('/project/head-api?href=%2Fproject%2Fabout');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('uses one document head request and preserves inline head precedence', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/posts/alpha'],
    });
    const fetchCalls: string[] = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      fetchCalls.push(url);

      return new Response(JSON.stringify({
        head: [
          { tag: 'title', children: 'Site' },
          { tag: 'title', children: 'Alpha' },
        ],
        routeHeads: [
          {
            routeId: '__root__',
            head: [{ tag: 'title', children: 'Site' }],
            staleTime: 60_000,
          },
          {
            routeId: '/posts/$postId',
            head: [{ tag: 'title', children: 'Alpha' }],
            staleTime: 10_000,
          },
        ],
        staleTime: 10_000,
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }) as typeof fetch;

    try {
      const router = createRouter({
        routeTree: createNestedHeadRouteTree(),
        history,
      });

      await router.load();

      expect(fetchCalls).toEqual(['/head-api?href=%2Fposts%2Falpha']);
      expect(router.state.head).toEqual([
        { tag: 'title', children: 'Alpha' },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('reuses a fresh root server head across navigations without refetching', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/'],
    });
    const fetchCalls: string[] = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: string | URL | Request) => {
      fetchCalls.push(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);

      return new Response(JSON.stringify({
        head: [
          { tag: 'title', children: 'Site' },
        ],
        routeHeads: [
          {
            routeId: '__root__',
            head: [{ tag: 'title', children: 'Site' }],
            staleTime: 60_000,
          },
        ],
        staleTime: 60_000,
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }) as typeof fetch;

    try {
      const router = createRouter({
        routeTree: createRootServerHeadTree(),
        history,
      });

      await router.load();
      await router.navigate({
        to: '/about',
      });

      expect(fetchCalls).toEqual(['/head-api?href=%2F']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('seeds the route head cache from the dehydrated snapshot', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/about'],
    });
    const fetchCalls: string[] = [];
    const originalFetch = globalThis.fetch;
    const globalWithWindow = globalThis as typeof globalThis & {
      window?: any;
    };
    const originalWindow = globalWithWindow.window;

    globalThis.fetch = (async (input: string | URL | Request) => {
      fetchCalls.push(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);

      return new Response(JSON.stringify({
        head: [
          { tag: 'title', children: 'Site' },
        ],
        routeHeads: [
          {
            routeId: '__root__',
            head: [{ tag: 'title', children: 'Site' }],
            staleTime: 60_000,
          },
        ],
        staleTime: 60_000,
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }) as typeof fetch;

    globalWithWindow.window = {
      __RICHIE_ROUTER_HEAD__: {
        href: '/about',
        head: [
          { tag: 'title', children: 'Site' },
        ],
        routeHeads: [
          {
            routeId: '__root__',
            head: [{ tag: 'title', children: 'Site' }],
            staleTime: 60_000,
          },
        ],
      },
    };

    try {
      const router = createRouter({
        routeTree: createRootServerHeadTree(),
        history,
      });

      await router.load();

      expect(fetchCalls).toHaveLength(0);
      expect(router.state.head).toEqual([
        { tag: 'title', children: 'Site' },
      ]);
    } finally {
      globalThis.fetch = originalFetch;

      if (originalWindow === undefined) {
        Reflect.deleteProperty(globalWithWindow, 'window');
      } else {
        originalWindow.__RICHIE_ROUTER_HEAD__ = undefined;
        globalWithWindow.window = originalWindow;
      }
    }
  });

  test('reuses the initial merged head snapshot without fetching when the branch has no inline head', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/about'],
    });
    const fetchCalls: string[] = [];
    const originalFetch = globalThis.fetch;
    const globalWithWindow = globalThis as typeof globalThis & {
      window?: any;
    };
    const originalWindow = globalWithWindow.window;

    globalThis.fetch = (async (input: string | URL | Request) => {
      fetchCalls.push(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);

      return new Response('{}', {
        status: 500,
      });
    }) as typeof fetch;

    globalWithWindow.window = {
      __RICHIE_ROUTER_HEAD__: {
        href: '/about',
        head: [
          { tag: 'title', children: 'About from SSR' },
        ],
      },
    };

    try {
      const router = createRouter({
        routeTree: createTestRouteTree({ serverHead: true }),
        history,
      });

      await router.load();

      expect(fetchCalls).toHaveLength(0);
      expect(router.state.head).toEqual([
        { tag: 'title', children: 'About from SSR' },
      ]);
    } finally {
      globalThis.fetch = originalFetch;

      if (originalWindow === undefined) {
        Reflect.deleteProperty(globalWithWindow, 'window');
      } else {
        originalWindow.__RICHIE_ROUTER_HEAD__ = undefined;
        globalWithWindow.window = originalWindow;
      }
    }
  });

  test('uses the merged document head without route fallback requests when the branch has no inline head', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/posts/alpha'],
    });
    const fetchCalls: string[] = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      fetchCalls.push(url);

      return new Response(JSON.stringify({
        head: [
          { tag: 'meta', name: 'description', content: 'Nested server head' },
          { tag: 'title', children: 'Alpha' },
        ],
        staleTime: 10_000,
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }) as typeof fetch;

    try {
      const router = createRouter({
        routeTree: createNestedServerHeadTree(),
        history,
      });

      await router.load();

      expect(fetchCalls).toEqual(['/head-api?href=%2Fposts%2Falpha']);
      expect(router.state.head).toEqual([
        { tag: 'meta', name: 'description', content: 'Nested server head' },
        { tag: 'title', children: 'Alpha' },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('keeps loadRouteHead as the route-scoped override path', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/about'],
    });
    const fetchCalls: string[] = [];
    const loadRouteHeadCalls: string[] = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: string | URL | Request) => {
      fetchCalls.push(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);

      return new Response('{}', {
        status: 500,
      });
    }) as typeof fetch;

    try {
      const router = createRouter({
        routeTree: createTestRouteTree({ serverHead: true }),
        history,
        loadRouteHead: async ({ routeId }) => {
          loadRouteHeadCalls.push(routeId);
          return {
            head: [
              { tag: 'title', children: 'About override' },
            ],
            staleTime: 1_000,
          };
        },
      });

      await router.load();

      expect(loadRouteHeadCalls).toEqual(['/about']);
      expect(fetchCalls).toHaveLength(0);
      expect(router.state.head).toEqual([
        { tag: 'title', children: 'About override' },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
