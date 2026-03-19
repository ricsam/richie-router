import { createFileRoute } from '@richie-router/react';
import { usePosts } from '../use-posts';

export const Route = createFileRoute('/posts/$postId')({
  component: PostDetailPage,
});

function PostDetailPage() {
  const { postId } = Route.useParams();
  const { posts, error, isLoading } = usePosts();
  const post = posts.find(entry => entry.id === postId);

  return (
    <article>
      <p style={{ textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: '0.8rem', opacity: 0.7 }}>
        Post ID: {postId}
      </p>
      <h1 style={{ marginTop: 0 }}>{post?.title ?? 'Client-rendered post page'}</h1>
      <p style={{ fontStyle: 'italic', opacity: 0.8 }}>
        The HTML response does not include this article body. It is fetched from `/api/posts` and rendered only in the browser.
      </p>
      {isLoading ? <p>Loading post content...</p> : null}
      {error ? <p>{error.message}</p> : null}
      <div style={{ lineHeight: 1.7 }}>{post?.body ?? 'No matching post was found in the API response.'}</div>
    </article>
  );
}
