import { env } from '$env/dynamic/private';
import { isBitcoinConfigured as isBitcoindConfigured } from './bitcoind';
import { isLndConfigured } from './lnd';
import { isPhoenixdConfigured } from './phoenixd';
import { runtimeConfig } from './runtime-config';
import { isSumupEnabled } from './sumup';
import { isStripeEnabled } from './stripe';
import { isPaypalEnabled } from './paypal';
import { isBitcoinNodelessConfigured } from './bitcoin-nodeless';
import { isSwissBitcoinPayConfigured } from './swiss-bitcoin-pay';
import { isBtcpayServerConfigured } from './btcpay-server';
import { isBreezConfigured, createLightningInvoice } from './breez';
import { differenceInSeconds } from 'date-fns';

export const ALL_PAYMENT_METHODS = [
  'card',
  'bank-transfer',
  'bitcoin',
  'lightning',
  'point-of-sale',
  'free',
  'paypal'
] as const;
export type PaymentMethod = (typeof ALL_PAYMENT_METHODS)[number];

export const ALL_PAYMENT_PROCESSORS = [
  'bitcoin-nodeless',
  'bitcoind',
  'btcpay-server',
  'lnd',
  'paypal',
  'phoenixd',
  'stripe',
  'sumup',
  'swiss-bitcoin-pay',
  'Breez SDK'
] as const;
export type PaymentProcessor = (typeof ALL_PAYMENT_PROCESSORS)[number];

export const paymentMethods = (opts?: {
  hasPosOptions?: boolean;
  includePOS?: boolean;
  includeDisabled?: boolean;
  totalSatoshis?: number;
}) =>
  env.VITEST
    ? [...ALL_PAYMENT_METHODS]
    : [...new Set([...runtimeConfig.paymentMethods.order, ...ALL_PAYMENT_METHODS])].filter(
        (method) => {
          if (!opts?.includeDisabled && runtimeConfig.paymentMethods.disabled.includes(method)) {
            return false;
          }
          if (opts?.totalSatoshis !== undefined && opts.totalSatoshis === 0) {
            return method === 'free';
          }
          switch (method) {
            case 'card':
              return isSumupEnabled() || isStripeEnabled();
            case 'paypal':
              return isPaypalEnabled();
            case 'bank-transfer':
              return runtimeConfig.sellerIdentity?.bank;
            case 'bitcoin':
              return isBitcoindConfigured || isBitcoinNodelessConfigured();
            case 'lightning':
              return (
                isBreezConfigured() ||      // Breez prioritaire
                isSwissBitcoinPayConfigured() ||
                isBtcpayServerConfigured() ||
                isLndConfigured() ||
                isPhoenixdConfigured()
              );
            case 'point-of-sale':
              return opts?.hasPosOptions || opts?.includePOS;
            case 'free':
              return opts?.totalSatoshis === undefined;
            case 'Breez SDK':
              return isBreezConfigured();
            default:
              return true;
          }
        }
      );

// Export pour usage dans orders.ts
export async function generateLightningPaymentInfo(
  params: {
    method: 'lightning';
    orderId: string;
    orderNumber: number;
    toPay: { amount: number; currency: string };
    paymentId: string;
    expiresAt?: Date;
  }
) {
  const { orderId, orderNumber, toPay, expiresAt } = params;
  const satoshis = Math.round(toPay.amount); // Assure entier
  const label = runtimeConfig.lightningQrCodeDescription === 'brandAndOrderNumber' 
    ? `${runtimeConfig.brandName} - Order #${orderNumber.toLocaleString('en')}`
    : runtimeConfig.brandName;

  // PRIORITÉ Lightning : Breez > SwissBP > BTCPay > Phoenix > LND
  const preference = runtimeConfig.paymentProcessorPreferences?.lightning;
  const hardcodedPriority: PaymentProcessor[] = [
    'Breez SDK',
    'swiss-bitcoin-pay',
    'btcpay-server',
    'phoenixd',
    'lnd'
  ];

  const availability: Partial<Record<PaymentProcessor, boolean>> = {
    'Breez SDK': isBreezConfigured(),
    'swiss-bitcoin-pay': isSwissBitcoinPayConfigured(),
    'btcpay-server': isBtcpayServerConfigured(),
    'phoenixd': isPhoenixdConfigured(),
    'lnd': isLndConfigured()
  };

  const orderedProcessors = preference 
    ? preference.filter((p): p is PaymentProcessor => availability[p])
    : hardcodedPriority.filter(p => availability[p]);

  // Générateur Breez (prioritaire)
  const generators: Partial<Record<
    PaymentProcessor, 
    () => Promise<{
      address?: string;
      invoiceId?: string;
      processor?: PaymentProcessor;
      expiresAt?: Date;
    } | null>
  >> = {
    'Breez SDK': async () => {
      if (!isBreezConfigured()) return null;
      try {
        const invoice = await createLightningInvoice(
          satoshis,
          `${label} #${orderNumber}`,
          expiresAt ? differenceInSeconds(expiresAt, new Date()) : 3600
        );
        return {
          address: invoice.paymentRequest,
          invoiceId: invoice.id,
          processor: 'Breez SDK' as PaymentProcessor,
          expiresAt: invoice.expiresAt
        };
      } catch (error) {
        console.error('[Breez] Invoice creation failed:', error);
        return null;
      }
    },
    // Placeholders pour autres processeurs (à compléter selon ton orders.ts)
    'swiss-bitcoin-pay': async () => ({
      address: 'lnurl_sbp_placeholder',
      invoiceId: 'sbp_' + orderId,
      processor: 'swiss-bitcoin-pay'
    }),
    'btcpay-server': async () => ({
      address: 'lnbc_btcpay_placeholder',
      invoiceId: 'btcpay_' + orderId,
      processor: 'btcpay-server'
    }),
    'phoenixd': async () => ({
      address: 'lnbc_phoenix_placeholder',
      invoiceId: 'phoenix_' + orderId,
      processor: 'phoenixd'
    }),
    'lnd': async () => ({
      address: 'lnbc_lnd_placeholder',
      invoiceId: 'lnd_' + orderId,
      processor: 'lnd'
    })
  };

  for (const processor of orderedProcessors) {
    const generator = generators[processor];
    if (generator) {
      const result = await generator();
      if (result) return result;
    }
  }

  throw new Error('Aucun processeur Lightning disponible');
}
