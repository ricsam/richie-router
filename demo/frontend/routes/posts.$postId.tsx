import { createFileRoute } from '@richie-router/react';
import { postCatalog } from '../post-catalog';

export const Route = createFileRoute('/posts/$postId')({
  component: PostDetailPage,
  head: 'post-detail',
});

function PostDetailPage() {
  const { postId } = Route.useParams();
  const post = postCatalog.find(entry => entry.id === postId);

  return (
    <article>
      <p style={{ textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: '0.8rem', opacity: 0.7 }}>
        Post ID: {postId}
      </p>
      <h1 style={{ marginTop: 0 }}>{post?.title ?? 'Client-rendered post page'}</h1>
      <p style={{ fontStyle: 'italic', opacity: 0.8 }}>
        The HTML response does not include this article body. It is rendered only in the browser.
      </p>
      <div style={{ lineHeight: 1.7 }}>
        {post?.body ??
          'This route still renders with typed params even when the backend only contributes document head tags.'}
      </div>
    </article>
  );
}
