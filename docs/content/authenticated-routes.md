# Authenticated Routes

Authenticated flows in @richie-router/ are client-side. The usual pattern is a pathless layout plus a `beforeLoad` guard.

## Guard a section with a pathless layout

```tsx
import { Outlet, createFileRoute, redirect } from '@richie-router/react';

export const Route = createFileRoute('/_auth')({
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
  component: AuthLayout,
});

function AuthLayout() {
  return <Outlet />;
}
```

## Add child routes underneath

```tsx
export const Route = createFileRoute('/_auth/dashboard')({
  component: DashboardPage,
});
```

The URL becomes `/dashboard`, but the `_auth` layout still participates in matching and can block navigation.

## Important boundary

Because @richie-router/ never executes frontend code on the backend, `beforeLoad` does not run during the initial document request. Protect sensitive data on the server separately from your client-side route guard.
