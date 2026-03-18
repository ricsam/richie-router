import { z } from 'zod';
import { defineHeadTagSchema } from '@richie-router/core';

export const headTagSchema = defineHeadTagSchema({
  'docs-shell': {},
  'document-page': {},
  'docs-search': {
    searchSchema: z.object({
      q: z.string().default(''),
    }),
  },
});

export type HeadTagSchema = typeof headTagSchema;
