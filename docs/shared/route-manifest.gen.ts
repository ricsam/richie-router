/* eslint-disable */
import { createRouteNode, getRouteSchemaEntry, getRouterSchemaHostedRouting } from '@richie-router/core';
import { routerSchema } from './router-schema.ts';

const __rootRoute = createRouteNode('__root__', {}, { isRoot: true })._setSearchSchema(getRouteSchemaEntry(routerSchema, '__root__')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '__root__')?.serverHead);
const IndexRoute = createRouteNode('/', {}).update({ id: '/', path: '/', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/')?.serverHead);
const DocsSplatslugRoute = createRouteNode('/docs/$slug', {}).update({ id: '/docs/$slug', path: '/docs/$slug', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/docs/$slug')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/docs/$slug')?.serverHead);
const SearchRoute = createRouteNode('/search', {}).update({ id: '/search', path: '/search', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/search')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/search')?.serverHead);


const __rootRouteChildren = {
  IndexRoute,
  DocsSplatslugRoute,
  SearchRoute,
};
export const routeManifest = __rootRoute._addFileChildren(__rootRouteChildren)._setHostedRouting(getRouterSchemaHostedRouting(routerSchema));
