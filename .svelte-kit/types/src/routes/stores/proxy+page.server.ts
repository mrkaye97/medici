// @ts-nocheck
import { createContext } from '$lib/trpc/context';
import { router } from '$lib/trpc/router';
import type { PageServerLoad } from './$types';

export const load = async (event: Parameters<PageServerLoad>[0]) => ({
  stores: router
    .createCaller(await createContext(event))
    .stores.list(event.url.searchParams.get('q') || undefined)
});
