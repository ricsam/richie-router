# Route Masking

@richie-router/ already reserves route-masking fields in its navigation API:

```ts
type NavigateOptions = {
  to: string;
  mask?: { to: string };
};
```

It also exports a helper:

```ts
import { createRouteMask } from '@richie-router/react';

const modalMask = createRouteMask({
  to: '/photos',
});
```

## Current status

The type surface is present, but route masking does not have runtime behavior wired up yet. Treat `mask` and `createRouteMask()` as placeholders for future work, not as a production feature.

If you need modal-style URLs today, the practical approach is to model them as normal routes and keep the view state in search params or app state.
