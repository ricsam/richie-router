import { createClient } from '@richie-rpc/client';
import { docsContract } from '../shared/contract';

export const docsClient = createClient(docsContract, {
  baseUrl: typeof window === 'undefined' ? 'http://localhost:3001' : window.location.origin,
});
