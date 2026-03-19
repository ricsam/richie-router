import { z } from 'zod';
import { defineRouterSchema } from '@richie-router/core';

export const routerSchema = defineRouterSchema({
  __root__: {
    serverHead: true,
  },
  '/docs/$slug': {
    serverHead: true,
  },
  '/search': {
    serverHead: true,
    searchSchema: z.object({
      q: z.string().default(''),
    }),
  },
});

export type RouterSchema = typeof routerSchema;
