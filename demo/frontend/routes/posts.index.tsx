import { createFileRoute } from '@richie-router/react';

export const Route = createFileRoute('/posts/')({
  component: PostsIndexPage,
});

function PostsIndexPage() {
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Pick a post</h1>
      <p>Select a post from the list to exercise dynamic params and server-resolved head tags.</p>
    </div>
  );
}
