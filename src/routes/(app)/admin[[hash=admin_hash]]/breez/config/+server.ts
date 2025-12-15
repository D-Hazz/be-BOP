import { json, type RequestHandler } from '@sveltejs/kit';
import type { Actions } from './$types';
import { env } from '$env/dynamic/private';
import { isAdmin } from '$lib/server/auth';
import { breez } from '$lib/server/breez';

export const actions: Actions = {
  default: async ({ request, url, platform }) => {
    if (!isAdmin(request)) {
      return json({ error: 'Accès admin requis' }, { status: 403 });
    }

    const data = await request.formData();
    const mnemonic = data.get('mnemonic')?.toString();
    const apiKey = data.get('apiKey')?.toString();
    const network = url.searchParams.get('network') || 'mainnet';

    if (!mnemonic || !apiKey) {
      return json({ error: 'Mnemonic et API key requis' }, { status: 400 });
    }

    // Sauvegarde dans env ou KV (selon platform)
    if (platform?.env?.KV) {
      await platform.env.KV.put(`BREEZ_MNEMONIC_${network.toUpperCase()}`, mnemonic);
      await platform.env.KV.put(`BREEZ_API_KEY_${network.toUpperCase()}`, apiKey);
    }

    // Force refresh config
    await breez.refreshConfig?.();

    return json({ success: true, message: 'Portefeuille configuré' });
  }
};
