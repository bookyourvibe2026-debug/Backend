import { randomUUID } from "crypto";
import { logger } from "../../config/logger";
import { CreateOrderInput, CreateOrderResult, PaymentProvider, VerifyPaymentResult } from "./payment.provider";

/**
 * Stand-in for a real gateway (Cashfree, Razorpay, ...) until credentials are available.
 * Marks every order "paid" immediately so the booking flow can be built and tested end-to-end
 * now; swapping in CashfreeProvider later requires no changes outside payment.service.ts.
 */
export class MockPaymentProvider implements PaymentProvider {
  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const providerOrderId = `mock_${randomUUID()}`;
    logger.info({ providerOrderId, orderId: input.orderId, amount: input.amount }, "MockPaymentProvider: order created");
    return { providerOrderId, status: "created" };
  }

  async verifyPayment(providerOrderId: string): Promise<VerifyPaymentResult> {
    logger.info({ providerOrderId }, "MockPaymentProvider: verifying payment (auto-approved)");
    return { providerOrderId, status: "paid", amount: 0 };
  }
}
