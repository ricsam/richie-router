import { Outlet, createFileRoute, redirect } from '@richie-router/react';

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
  beforeLoad: async ({ location }) => {
    const rawSearch = location.search as Record<string, unknown>;
    if (rawSearch.auth !== true) {
      throw redirect({
        to: '/',
        search: {
          redirect: location.pathname,
        },
      });
    }
  },
});

function AuthLayout() {
  return <Outlet />;
}
