import { z } from 'zod';
import { defineHeadTagSchema } from '@richie-router/core';

export const headTagSchema = defineHeadTagSchema({
  'app-shell': {},
  'post-detail': {},
  'search-page': {
    searchSchema: z.object({
      query: z.string().default('router'),
      limit: z.coerce.number().default(5),
    }),
  },
});

export type HeadTagSchema = typeof headTagSchema;
