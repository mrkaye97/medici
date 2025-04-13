import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from 'server';

const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000',
    }),
  ],
});

const user = await trpc.userById.query('1');
const createdUser = await trpc.userCreate.mutate({ name: 'sachinraja' });

console.log(user);
console.log(createdUser);