import type { PageServerLoad } from './$types';
import { isBreezConfigured, getBreezBalance } from '$lib/server/breez';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  try {
    const enabled = isBreezConfigured();

    let balanceSats: number | null = null;

    if (enabled) {
      // Optionnel : si tu as une fonction pour lire le solde depuis Breez
      const info = await getBreezBalance(); // à implémenter dans breez.ts
      balanceSats = info?.balanceSats ?? null;
    }

    return {
      breez: {
        enabled,
        balanceSats
        // NE PAS renvoyer mnemonic ni apiKey ici
      }
    };
  } catch (e) {
    throw error(500, 'Erreur lors du chargement de la configuration Breez');
  }
};
