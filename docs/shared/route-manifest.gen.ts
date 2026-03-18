/* eslint-disable */
import { createRouteNode } from '@richie-router/core';
import { headTagSchema } from './head-tag-schema.ts';

const __rootRoute = createRouteNode('__root__', { head: 'docs-shell' }, { isRoot: true })._setSearchSchema((headTagSchema as any)['docs-shell']?.searchSchema as never);
const IndexRoute = createRouteNode('/', {}).update({ id: '/', path: '/', getParentRoute: () => __rootRoute } as const);
const DocsSplatslugRoute = createRouteNode('/docs/$slug', { head: 'document-page' }).update({ id: '/docs/$slug', path: '/docs/$slug', getParentRoute: () => __rootRoute } as const)._setSearchSchema((headTagSchema as any)['document-page']?.searchSchema as never);
const SearchRoute = createRouteNode('/search', { head: 'docs-search' }).update({ id: '/search', path: '/search', getParentRoute: () => __rootRoute } as const)._setSearchSchema((headTagSchema as any)['docs-search']?.searchSchema as never);


const __rootRouteChildren = {
  IndexRoute,
  DocsSplatslugRoute,
  SearchRoute,
};
export const routeManifest = __rootRoute._addFileChildren(__rootRouteChildren);
