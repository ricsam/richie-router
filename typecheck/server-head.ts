import { z } from 'zod';
import { defineRouterSchema } from '@richie-router/core';
import { defineHeadTags } from '@richie-router/server';
import { routeManifest } from '../demo/shared/route-manifest.gen';

const searchOnlySchema = defineRouterSchema({
  '/search': {
    serverHead: true,
    searchSchema: z.object({
      query: z.string(),
    }),
  },
});

defineHeadTags(routeManifest, searchOnlySchema, {
  '/search': {
    head: ({ search }) => {
      const query: string = search.query;
      return [
        { tag: 'title', children: query },
      ];
    },
  },
});

// @ts-expect-error serverHead routes require a matching definition
defineHeadTags(routeManifest, searchOnlySchema, {});

defineHeadTags(routeManifest, searchOnlySchema, {
  '/search': {
    head: ({ search }) => ([
      { tag: 'title', children: search.query },
    ]),
  },
  // @ts-expect-error only routes flagged with serverHead may appear here
  '/about': {
    head: () => ([
      { tag: 'title', children: 'About' },
    ]),
  },
});
