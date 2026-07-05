export interface CreateOrderInput {
  orderId: string;
  amount: number;
  currency?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
}

export interface CreateOrderResult {
  providerOrderId: string;
  paymentSessionId?: string;
  paymentLink?: string;
  status: "created";
}

export interface VerifyPaymentResult {
  providerOrderId: string;
  status: "paid" | "pending" | "failed";
  amount: number;
}

/**
 * Every real gateway (Cashfree, Razorpay, ...) implements this so booking logic never
 * depends on a specific provider's SDK — swap the binding in payment.service.ts only.
 */
export interface PaymentProvider {
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  verifyPayment(providerOrderId: string): Promise<VerifyPaymentResult>;
}
