import { z } from 'zod';

export const demoPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  excerpt: z.string(),
  body: z.string(),
  coverImage: z.string(),
});

export const demoPostsSchema = z.array(demoPostSchema);

export type DemoPost = z.infer<typeof demoPostSchema>;
