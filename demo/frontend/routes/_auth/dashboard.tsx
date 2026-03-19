import { createFileRoute } from '@richie-router/react';

export const Route = createFileRoute('/_auth/dashboard')({
  component: DashboardPage,
  head: {
    meta: [
      { title: 'Dashboard' },
      { name: 'description', content: 'A protected route behind a pathless layout.' },
    ],
  },
});

function DashboardPage() {
  const search = Route.useSearch();

  return (
    <section>
      <h1>Dashboard</h1>
      <p>Authenticated access: {search.auth ? 'enabled' : 'disabled'}.</p>
      <p>This route is mounted under the pathless `_auth` layout, so the URL stays clean and the guard stays client-only.</p>
    </section>
  );
}
