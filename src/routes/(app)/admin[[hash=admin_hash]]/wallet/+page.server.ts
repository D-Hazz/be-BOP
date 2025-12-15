// +page.server.ts
import type { PageServerLoad } from './$types';
import { isBreezConfigured } from '$lib/server/breez';
import { runtimeConfig } from '$lib/server/runtime-config';

export const load: PageServerLoad = async ({ url }) => {
  const network = url.searchParams.get('network') ?? 'mainnet';

  return {
    breezConfigured: isBreezConfigured(),
    network,
    // Exemple : si tu veux afficher la devise principale dans l’UI
    mainCurrency: runtimeConfig.mainCurrency
  };
};
