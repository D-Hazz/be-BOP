import { env } from '$env/dynamic/private';
import * as breez from '@breeztech/breez-sdk-liquid/web';

let sdk: any = null;
let config: any = null;
let network: 'mainnet' | 'testnet' = 'mainnet';

export async function refreshConfig() {
  sdk = null;
  config = null;
}

export function getNetwork(): 'mainnet' | 'testnet' {
  return (env.BREEZ_NETWORK as 'mainnet' | 'testnet') || 'mainnet';
}

export function isBreezConfigured(): boolean {
  const net = getNetwork();
  return Boolean(
    env[`BREEZ_API_KEY_${net.toUpperCase()}`] && 
    env[`BREEZ_MNEMONIC_${net.toUpperCase()}`]
  );
}

async function ensureSdk() {
  if (sdk) return sdk;
  
  if (!isBreezConfigured()) {
    throw new Error('Breez SDK non configuré');
  }

  network = getNetwork();
  
  // Init Wasm
  if (typeof (breez as any).default === 'function') {
    await (breez as any).default();
  }

  const apiKey = env[`BREEZ_API_KEY_${network.toUpperCase()}`]!;
  const mnemonic = env[`BREEZ_MNEMONIC_${network.toUpperCase()}`]!;
  
  config = (breez as any).defaultConfig(network, apiKey);
  sdk = await (breez as any).connect({ config, mnemonic });
  
  console.info(`[breez] SDK initialisé (${network})`);
  return sdk;
}

// Wallet info avec cache
const cache = new Map();
export async function getBalanceAndHistory() {
  const cacheKey = `breez_${network}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30000) { // 30s cache
    return cached.data;
  }

  const s = await ensureSdk();
  const info = await s.getInfo();
  const txs = await s.listPayments({});
  
  const sats = info.walletInfo?.balanceSat ?? 0;
  const data = {
    balanceSats: sats,
    transactions: (txs || []).slice(0, 50).map((tx: any) => ({
      id: tx.id,
      amountSat: Math.abs(tx.amountSat ?? 0),
      description: tx.details?.description || '',
      timestamp: tx.timestamp || 0,
      confirmed: tx.confirmed
    })).reverse()
  };

  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

// Facture Lightning pour Nostr/orders
export async function createLightningInvoice(
  amountSat: number, 
  description: string,
  expiresInSeconds = 3600
) {
  const s = await ensureSdk();
  
  const prepare = await s.prepareReceivePayment({
    paymentMethod: 'lightning',
    amount: amountSat > 0 ? { type: 'bitcoin', payerAmountSat: amountSat } : undefined,
    validityPeriodSeconds: expiresInSeconds
  });

  const res = await s.receivePayment({ prepareResponse: prepare });
  return {
    paymentRequest: res.destination as string,
    id: res.id as string,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000)
  };
}

// Paiement sortant (LNURL, factures)
export async function payLightningInvoice(invoice: string) {
  const s = await ensureSdk();
  const prepare = await s.prepareSendPayment({ destination: invoice });
  return await s.sendPayment({ prepareResponse: prepare });
}

// Webhook listener (à appeler via cron/queue)
export async function checkPendingPayments() {
  const s = await ensureSdk();
  const payments = await s.listPayments({ 
    includeInFlight: true,
    limit: 100 
  });
  
  return payments.filter((p: any) => 
    p.paymentType === 'receive' && 
    !p.confirmed && 
    Date.now() - (p.timestamp || 0) * 1000 < 360000000 // 1h
  );
}
