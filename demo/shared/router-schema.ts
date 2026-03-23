import { z } from 'zod';
import { defineRouterSchema } from '@richie-router/core';

export const routerSchema = defineRouterSchema({
  __root__: {
    serverHead: true,
  },
  '/posts/$postId': {
    serverHead: true,
  },
  '/search': {
    serverHead: true,
    searchSchema: z.object({
      query: z.string().default('router'),
      limit: z.coerce.number().default(5),
    }),
  },
  '/_auth/dashboard': {
    searchSchema: z.object({
      auth: z.coerce.boolean().default(false),
    }),
  },
}, {
  passthrough: ['/api/$'],
});

export type RouterSchema = typeof routerSchema;
