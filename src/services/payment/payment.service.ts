import { MockPaymentProvider } from "./mock.provider";
import { PaymentProvider } from "./payment.provider";

// Swap this binding for a CashfreeProvider (or similar) once gateway credentials are issued —
// no other module reaches into the concrete provider directly.
export const paymentProvider: PaymentProvider = new MockPaymentProvider();
