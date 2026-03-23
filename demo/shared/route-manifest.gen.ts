/* eslint-disable */
import { createRouteNode, getRouteSchemaEntry, getRouterSchemaHostedRouting } from '@richie-router/core';
import { routerSchema } from './router-schema.ts';

const __rootRoute = createRouteNode('__root__', {}, { isRoot: true })._setSearchSchema(getRouteSchemaEntry(routerSchema, '__root__')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '__root__')?.serverHead);
const IndexRoute = createRouteNode('/', {}).update({ id: '/', path: '/', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/')?.serverHead);
const _authRouteRoute = createRouteNode('/_auth', {}).update({ id: '/_auth', path: '/_auth', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/_auth')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/_auth')?.serverHead);
const _authDashboardRoute = createRouteNode('/_auth/dashboard', {}).update({ id: '/_auth/dashboard', path: '/_auth/dashboard', getParentRoute: () => _authRouteRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/_auth/dashboard')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/_auth/dashboard')?.serverHead);
const AboutRoute = createRouteNode('/about', {}).update({ id: '/about', path: '/about', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/about')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/about')?.serverHead);
const PostsRoute = createRouteNode('/posts', {}).update({ id: '/posts', path: '/posts', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/posts')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/posts')?.serverHead);
const PostsIndexRoute = createRouteNode('/posts/', {}).update({ id: '/posts/', path: '/posts/', getParentRoute: () => PostsRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/posts/')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/posts/')?.serverHead);
const PostsSplatpostIdRoute = createRouteNode('/posts/$postId', {}).update({ id: '/posts/$postId', path: '/posts/$postId', getParentRoute: () => PostsRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/posts/$postId')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/posts/$postId')?.serverHead);
const SearchRoute = createRouteNode('/search', {}).update({ id: '/search', path: '/search', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/search')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/search')?.serverHead);

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
export const routeManifest = __rootRoute._addFileChildren(__rootRouteChildren)._setHostedRouting(getRouterSchemaHostedRouting(routerSchema));
