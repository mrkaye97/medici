// @ts-nocheck
import { JWT_SECRET } from '$env/static/private';
import prisma from '$lib/prisma';
import { fail } from '@sveltejs/kit';
import { md5 } from 'hash-wasm';
import jwt from 'jsonwebtoken';
import type { Actions } from './$types';

export const actions = {
  default: async ({ request, cookies }: import('./$types').RequestEvent) => {
    try {
      const data = await request.formData();
      const email = data.get('email') as string;
      const password = data.get('password') as string;

      // 👇 replace this with a non-naiive hashing algorithm
      const passwordHash = await md5(password);

      const { id, name } = await prisma.user.findFirstOrThrow({
        where: { email, passwordHash },
        select: { id: true, name: true }
      });

      cookies.set('jwt', jwt.sign({ id, name }, JWT_SECRET), { path: '/', secure: false });

      return { success: true };
      // 👆 or, if we're using HTTP headers based auth, we could return the token,
      // and let the client set the header on subsequent requests
    } catch {
      return fail(401, { error: 'Authentication failed' });
    }
  }
};
;null as any as Actions;