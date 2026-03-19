/* eslint-disable */
import { createRouteNode } from '@richie-router/core';
import { routerSchema } from './router-schema.ts';

const __rootRoute = createRouteNode('__root__', {}, { isRoot: true })._setSearchSchema((routerSchema as any)['__root__']?.searchSchema as never)._setServerHead((routerSchema as any)['__root__']?.serverHead);
const IndexRoute = createRouteNode('/', {}).update({ id: '/', path: '/', getParentRoute: () => __rootRoute } as const)._setSearchSchema((routerSchema as any)['/']?.searchSchema as never)._setServerHead((routerSchema as any)['/']?.serverHead);
const DocsSplatslugRoute = createRouteNode('/docs/$slug', {}).update({ id: '/docs/$slug', path: '/docs/$slug', getParentRoute: () => __rootRoute } as const)._setSearchSchema((routerSchema as any)['/docs/$slug']?.searchSchema as never)._setServerHead((routerSchema as any)['/docs/$slug']?.serverHead);
const SearchRoute = createRouteNode('/search', {}).update({ id: '/search', path: '/search', getParentRoute: () => __rootRoute } as const)._setSearchSchema((routerSchema as any)['/search']?.searchSchema as never)._setServerHead((routerSchema as any)['/search']?.serverHead);


const __rootRouteChildren = {
  IndexRoute,
  DocsSplatslugRoute,
  SearchRoute,
};
export const routeManifest = __rootRoute._addFileChildren(__rootRouteChildren);
