import { createRouter, type RouterOptions } from '@richie-router/react';
import { routeTree } from './route-tree.gen';

function DefaultNotFound() {
  return (
    <div>
      <h1>Route not found</h1>
      <p>The requested page does not exist in the demo route tree.</p>
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

export function createDemoRouter(overrides: Partial<RouterOptions<typeof routeTree>> = {}) {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultPreloadDelay: 50,
    defaultPendingMs: 1000,
    defaultPendingMinMs: 500,
    defaultNotFoundComponent: DefaultNotFound,
    defaultErrorComponent: DefaultError,
    scrollRestoration: true,
    scrollToTopSelectors: ['#main-content'],
    trailingSlash: 'never',
    ...overrides,
  });
}

export const router = createDemoRouter();

declare module '@richie-router/react' {
  interface Register {
    router: typeof router;
  }
}
