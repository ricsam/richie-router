/* eslint-disable */
import { createRouteNode } from '@richie-router/core';
import { headTagSchema } from './head-tag-schema.ts';

const __rootRoute = createRouteNode('__root__', { head: 'app-shell' }, { isRoot: true })._setSearchSchema((headTagSchema as any)['app-shell']?.searchSchema as never);
const IndexRoute = createRouteNode('/', {}).update({ id: '/', path: '/', getParentRoute: () => __rootRoute } as const);
const _authRouteRoute = createRouteNode('/_auth', {}).update({ id: '/_auth', path: '/_auth', getParentRoute: () => __rootRoute } as const);
const _authDashboardRoute = createRouteNode('/_auth/dashboard', {}).update({ id: '/_auth/dashboard', path: '/_auth/dashboard', getParentRoute: () => _authRouteRoute } as const);
const AboutRoute = createRouteNode('/about', {}).update({ id: '/about', path: '/about', getParentRoute: () => __rootRoute } as const);
const PostsRoute = createRouteNode('/posts', {}).update({ id: '/posts', path: '/posts', getParentRoute: () => __rootRoute } as const);
const PostsIndexRoute = createRouteNode('/posts/', {}).update({ id: '/posts/', path: '/posts/', getParentRoute: () => PostsRoute } as const);
const PostsSplatpostIdRoute = createRouteNode('/posts/$postId', { head: 'post-detail' }).update({ id: '/posts/$postId', path: '/posts/$postId', getParentRoute: () => PostsRoute } as const)._setSearchSchema((headTagSchema as any)['post-detail']?.searchSchema as never);
const SearchRoute = createRouteNode('/search', { head: 'search-page' }).update({ id: '/search', path: '/search', getParentRoute: () => __rootRoute } as const)._setSearchSchema((headTagSchema as any)['search-page']?.searchSchema as never);

const _authRouteRouteChildren = {
  _authDashboardRoute,
};
const _authRouteRouteWithChildren = _authRouteRoute._addFileChildren(_authRouteRouteChildren);
const PostsRouteChildren = {
  PostsIndexRoute,
  PostsSplatpostIdRoute,
};
const PostsRouteWithChildren = PostsRoute._addFileChildren(PostsRouteChildren);

const __rootRouteChildren = {
  IndexRoute,
  _authRouteRouteWithChildren,
  AboutRoute,
  PostsRouteWithChildren,
  SearchRoute,
};
export const routeManifest = __rootRoute._addFileChildren(__rootRouteChildren);
