/* eslint-disable */
import { createRouteNode } from '@richie-router/core';
import { routerSchema } from './router-schema.ts';

const __rootRoute = createRouteNode('__root__', {}, { isRoot: true })._setSearchSchema((routerSchema as any)['__root__']?.searchSchema as never)._setServerHead((routerSchema as any)['__root__']?.serverHead);
const IndexRoute = createRouteNode('/', {}).update({ id: '/', path: '/', getParentRoute: () => __rootRoute } as const)._setSearchSchema((routerSchema as any)['/']?.searchSchema as never)._setServerHead((routerSchema as any)['/']?.serverHead);
const _authRouteRoute = createRouteNode('/_auth', {}).update({ id: '/_auth', path: '/_auth', getParentRoute: () => __rootRoute } as const)._setSearchSchema((routerSchema as any)['/_auth']?.searchSchema as never)._setServerHead((routerSchema as any)['/_auth']?.serverHead);
const _authDashboardRoute = createRouteNode('/_auth/dashboard', {}).update({ id: '/_auth/dashboard', path: '/_auth/dashboard', getParentRoute: () => _authRouteRoute } as const)._setSearchSchema((routerSchema as any)['/_auth/dashboard']?.searchSchema as never)._setServerHead((routerSchema as any)['/_auth/dashboard']?.serverHead);
const AboutRoute = createRouteNode('/about', {}).update({ id: '/about', path: '/about', getParentRoute: () => __rootRoute } as const)._setSearchSchema((routerSchema as any)['/about']?.searchSchema as never)._setServerHead((routerSchema as any)['/about']?.serverHead);
const PostsRoute = createRouteNode('/posts', {}).update({ id: '/posts', path: '/posts', getParentRoute: () => __rootRoute } as const)._setSearchSchema((routerSchema as any)['/posts']?.searchSchema as never)._setServerHead((routerSchema as any)['/posts']?.serverHead);
const PostsIndexRoute = createRouteNode('/posts/', {}).update({ id: '/posts/', path: '/posts/', getParentRoute: () => PostsRoute } as const)._setSearchSchema((routerSchema as any)['/posts/']?.searchSchema as never)._setServerHead((routerSchema as any)['/posts/']?.serverHead);
const PostsSplatpostIdRoute = createRouteNode('/posts/$postId', {}).update({ id: '/posts/$postId', path: '/posts/$postId', getParentRoute: () => PostsRoute } as const)._setSearchSchema((routerSchema as any)['/posts/$postId']?.searchSchema as never)._setServerHead((routerSchema as any)['/posts/$postId']?.serverHead);
const SearchRoute = createRouteNode('/search', {}).update({ id: '/search', path: '/search', getParentRoute: () => __rootRoute } as const)._setSearchSchema((routerSchema as any)['/search']?.searchSchema as never)._setServerHead((routerSchema as any)['/search']?.serverHead);

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
