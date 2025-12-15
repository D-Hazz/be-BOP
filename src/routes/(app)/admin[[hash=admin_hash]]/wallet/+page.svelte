<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  let mnemonic = '';
  let apiKey = '';
  let balance = 0;
  let transactions: any[] = [];
  let loading = false;
  let error: string | null = null;

  $: network = $page.url.searchParams.get('network') || 'mainnet';

  async function loadWallet() {
    loading = true;
    error = null;
    try {
      const res = await fetch(`/api/admin/breez/wallet?network=${network}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Erreur ${res.status}`);
      }
      const data = await res.json();
      if (data.balanceSats !== undefined) {
        balance = data.balanceSats;
        transactions = data.transactions ?? [];
      }
    } catch (e: any) {
      error = e?.message ?? 'Erreur inconnue';
    } finally {
      loading = false;
    }
  }

  onMount(loadWallet);
</script>

<div class="max-w-4xl mx-auto p-6">
  <h1 class="text-3xl font-bold mb-8">Portefeuille Breez SDK</h1>

  <div class="grid md:grid-cols-2 gap-6 mb-8">
    <div class="bg-white p-6 rounded-lg shadow">
      <h2 class="text-xl font-semibold mb-4">Configuration</h2>
      <form method="POST" action={`/api/admin/breez/config?network=${network}`} use:enhance>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">
              Mnemonic Seed (12/24 mots)
            </label>
            <textarea
              name="mnemonic"
              bind:value={mnemonic}
              rows="3"
              class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="word1 word2 word3 ..."
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Breez API Key</label>
            <input
              name="apiKey"
              bind:value={apiKey}
              type="password"
              class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="sk_..."
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Sauvegarde...' : 'Sauvegarder & Connecter'}
          </button>
        </div>
      </form>
    </div>

    <div class="bg-white p-6 rounded-lg shadow">
      <h2 class="text-xl font-semibold mb-4">Solde Actuel</h2>
      <div class="text-3xl font-bold text-green-600 mb-2">
        {balance.toLocaleString()} sats
      </div>
      <div class="text-sm text-gray-600">
        ({(balance / 100000000).toFixed(8)} BTC)
      </div>
      {#if transactions.length}
        <div class="mt-6">
          <h3 class="font-medium mb-3">5 dernières transactions</h3>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            {#each transactions.slice(0, 5) as tx}
              <div class="flex justify-between text-sm py-1">
                <span>{tx.description || 'Paiement'}</span>
                <span class={tx.amountSat > 0 ? 'text-green-600' : 'text-red-600'}>
                  {tx.amountSat.toLocaleString()} sats
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>

  {#if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
      {error}
    </div>
  {/if}
</div>
