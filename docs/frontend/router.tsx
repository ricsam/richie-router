import { createRouter, type RouterOptions } from '@richie-router/react';
import { routeTree } from '../shared/route-tree.gen';

function DefaultNotFound() {
  return (
    <div>
      <h1>Document not found</h1>
      <p>The requested docs page does not exist.</p>
    </div>
  );
}

function DefaultError(props: { error: Error; reset: () => void }) {
  return (
    <div>
      <h1>Something went wrong</h1>
      <pre>{props.error.message}</pre>
      <button type="button" onClick={props.reset}>
        Try again
      </button>
    </div>
  );
}

export function createDocsRouter(overrides: Partial<RouterOptions<typeof routeTree>> = {}) {
  return createRouter({
    routeTree,
    headBasePath: '/head-api',
    defaultPreload: 'intent',
    defaultPreloadDelay: 40,
    defaultNotFoundComponent: DefaultNotFound,
    defaultErrorComponent: DefaultError,
    scrollRestoration: true,
    scrollToTopSelectors: ['#docs-main'],
    trailingSlash: 'never',
    ...overrides,
  });
}

export const router = createDocsRouter();

declare module '@richie-router/react' {
  interface Register {
    router: typeof router;
  }
}
