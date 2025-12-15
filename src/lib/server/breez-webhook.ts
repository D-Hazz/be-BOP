// À appeler via cron toutes les 30s ou webhook Breez
export async function processBreezPayments() {
  if (!isBreezConfigured()) return;
  
  const pending = await checkPendingPayments();
  for (const payment of pending) {
    // Cherche order avec invoiceId == payment.id
    const order = await collections.orders.findOne({
      'payments': { 
        $elemMatch: { 
          'invoice.id': payment.id,
          status: { $in: ['pending', 'created'] }
        }
      }
    });

    if (order && payment.confirmed) {
      await onOrderPayment(
        order, 
        order.payments.find((p: any) => p.invoice?.id === payment.id)!,
        { amount: payment.amountSat, currency: 'SAT' }
      );
    }
  }
}
