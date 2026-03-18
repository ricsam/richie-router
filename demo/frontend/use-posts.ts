import React from 'react';
import { demoPostsSchema, type DemoPost } from '../shared/posts';

interface PostsState {
  posts: DemoPost[];
  error: Error | null;
  isLoading: boolean;
}

const INITIAL_STATE: PostsState = {
  posts: [],
  error: null,
  isLoading: true,
};

export function usePosts(): PostsState {
  const [state, setState] = React.useState<PostsState>(INITIAL_STATE);

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadPosts() {
      try {
        const response = await fetch('/api/posts', {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load posts (${response.status})`);
        }

        const payload = demoPostsSchema.parse(await response.json());
        React.startTransition(() => {
          setState({
            posts: payload,
            error: null,
            isLoading: false,
          });
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        React.startTransition(() => {
          setState({
            posts: [],
            error: error instanceof Error ? error : new Error('Unknown post loading error'),
            isLoading: false,
          });
        });
      }
    }

    void loadPosts();

    return () => {
      controller.abort();
    };
  }, []);

  return state;
}
