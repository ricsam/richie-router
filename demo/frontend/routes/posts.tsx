import { Link, Outlet, createFileRoute } from '@richie-router/react';
import { usePosts } from '../use-posts';

export const Route = createFileRoute('/posts')({
  component: PostsLayout,
  head: [
    { tag: 'title', children: 'Post Library' },
    { tag: 'meta', name: 'description', content: 'A nested route using client-rendered content and server head tags.' },
  ],
});

function PostsLayout() {
  const { posts, error, isLoading } = usePosts();

  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)',
        gap: '1.5rem',
      }}
    >
      <aside
        style={{
          border: '1px solid rgba(29, 20, 13, 0.14)',
          borderRadius: '1rem',
          padding: '1rem',
          background: 'rgba(255, 251, 245, 0.92)',
        }}
        >
          <h2 style={{ marginTop: 0 }}>Posts</h2>
          {isLoading ? <p>Loading posts...</p> : null}
          {error ? <p>{error.message}</p> : null}
          <ul style={{ display: 'grid', gap: '0.75rem', padding: 0, listStyle: 'none' }}>
          {posts.map(post => (
            <li key={post.id}>
              <Link to="/posts/$postId" params={{ postId: post.id }}>
                {post.title}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <div
        style={{
          border: '1px solid rgba(29, 20, 13, 0.14)',
          borderRadius: '1rem',
          padding: '1.25rem',
          background: 'rgba(255, 251, 245, 0.92)',
        }}
      >
        <Outlet />
      </div>
    </section>
  );
}
