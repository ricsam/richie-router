import { describe, expect, test } from 'bun:test';
import { createRouteNode, matchRouteTree } from './index';

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
