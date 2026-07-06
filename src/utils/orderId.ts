import { randomBytes } from "crypto";

export function generateOrderId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(3).toString("hex").toUpperCase();
  return `BYV-${stamp}-${random}`;
}
