# Navigation Blocking

@richie-router/ exposes a `useBlocker` hook for client-side navigation blocking.

## Basic confirmation flow

```tsx
import React from 'react';
import { useBlocker } from '@richie-router/react';

function EditorPage() {
  const [dirty, setDirty] = React.useState(false);

  useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: dirty,
  });

  return <textarea onChange={() => setDirty(true)} />;
}
```

## Build a custom dialog

```tsx
function SettingsPage() {
  const blocker = useBlocker({
    shouldBlockFn: ({ next }) => next?.pathname !== '/save-complete',
    withResolver: true,
    enableBeforeUnload: true,
  });

  return blocker.status === 'blocked' ? (
    <div>
      <p>Leave without saving?</p>
      <button type="button" onClick={blocker.proceed}>
        Leave
      </button>
      <button type="button" onClick={blocker.reset}>
        Stay
      </button>
    </div>
  ) : null;
}
```

## Current status

Use `useBlocker` for real navigation blocking today. The exported `<Block />` component is present, but its current implementation is only a placeholder.
