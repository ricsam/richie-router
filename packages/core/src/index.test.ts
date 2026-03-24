import { describe, expect, test } from 'bun:test';
import { buildPath, createRouteNode, defineRouterSchema, getRouterSchemaHostedRouting, matchPathname, matchRouteTree } from './index';

function createCompetingRoutesTree() {
  const rootRoute = createRouteNode('__root__', {}, { isRoot: true });
  const indexRoute = createRouteNode('/', {});
  const usernameRoute = createRouteNode('/$username', {});
  const usernameIndexRoute = createRouteNode('/$username/', {});
  const usernameSlugRoute = createRouteNode('/$username/$slug', {});
  const loginRoute = createRouteNode('/login', {});
  const registerRoute = createRouteNode('/register', {});
  const tagsTagRoute = createRouteNode('/tags/$tag', {});

  usernameRoute._addFileChildren({
    index: usernameIndexRoute,
    slug: usernameSlugRoute,
  });

  rootRoute._addFileChildren({
    index: indexRoute,
    username: usernameRoute,
    login: loginRoute,
    register: registerRoute,
    tagsTag: tagsTagRoute,
  });

  return rootRoute;
}

describe('matchRouteTree specificity', () => {
  test('prefers static routes over dynamic username routes', () => {
    const routeTree = createCompetingRoutesTree();

    expect(matchRouteTree(routeTree, '/login')?.map(match => match.route.fullPath)).toEqual([
      '__root__',
      '/login',
    ]);

    expect(matchRouteTree(routeTree, '/register')?.map(match => match.route.fullPath)).toEqual([
      '__root__',
      '/register',
    ]);
  });

  test('prefers static prefixes over earlier dynamic branches', () => {
    const routeTree = createCompetingRoutesTree();

    expect(matchRouteTree(routeTree, '/tags/testing')?.map(match => match.route.fullPath)).toEqual([
      '__root__',
      '/tags/$tag',
    ]);
  });

  test('still matches dynamic username routes when they are the best fit', () => {
    const routeTree = createCompetingRoutesTree();

    expect(matchRouteTree(routeTree, '/alice')?.map(match => match.route.fullPath)).toEqual([
      '__root__',
      '/$username',
      '/$username/',
    ]);

    expect(matchRouteTree(routeTree, '/alice/hello-world')?.map(match => match.route.fullPath)).toEqual([
      '__root__',
      '/$username',
      '/$username/$slug',
    ]);
  });
});

describe('path params', () => {
  test('preserves @ when building dynamic paths', () => {
    expect(buildPath('/$username', { username: '@alice' })).toBe('/@alice');
    expect(buildPath('/files/$', { _splat: '@alice/posts' })).toBe('/files/@alice%2Fposts');
  });

  test('matches both literal and percent-encoded @ path params', () => {
    expect(matchPathname('/$username', '/@alice')).toEqual({
      params: {
        username: '@alice',
      },
    });

    expect(matchPathname('/$username', '/%40alice')).toEqual({
      params: {
        username: '@alice',
      },
    });
  });

  test('keeps encoding other reserved characters in path params', () => {
    expect(buildPath('/$username', { username: '@al ice?/#%' })).toBe('/@al%20ice%3F%2F%23%25');
  });
});

describe('router schema hosted routing', () => {
  test('normalizes headBasePath and treats it as implicit passthrough', () => {
    const routerSchema = defineRouterSchema({}, {
      passthrough: ['/api/$', 'api/$'],
      headBasePath: '/meta/',
    });

    expect(getRouterSchemaHostedRouting(routerSchema)).toEqual({
      headBasePath: '/meta',
      passthrough: ['/meta', '/api/$'],
    });
  });
});
