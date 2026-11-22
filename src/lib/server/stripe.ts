import Stripe from "stripe";
import { getStripeEnv, isStripeConfigured } from "./config";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!isStripeConfigured()) return null;
  if (!stripeClient) {
    const { secretKey } = getStripeEnv();
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2026-11-18.endive",
      typescript: true,
    });
  }
  return stripeClient;
}

export async function createRentCheckoutSession(input: {
  paymentRefId: string;
  amountCents: number;
  month: string;
  tenantEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.tenantEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.amountCents,
          product_data: {
            name: `Rent — ${input.month}`,
            description: "PropertMax hosted rent payment (card never stored in-app)",
          },
        },
      },
    ],
    metadata: {
      paymentRefId: input.paymentRefId,
      month: input.month,
    },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
  if (!session.url) throw new Error("Stripe Checkout session missing url");
  return { sessionId: session.id, url: session.url };
}

export function constructStripeEvent(
  rawBody: string,
  signature: string | null,
): Stripe.Event {
  const stripe = getStripe();
  const { webhookSecret } = getStripeEnv();
  if (!stripe || !webhookSecret) {
    throw new Error("Stripe webhook not configured");
  }
  if (!signature) throw new Error("Missing Stripe-Signature header");
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}
