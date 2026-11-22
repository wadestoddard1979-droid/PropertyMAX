import { enqueueJob, processDueJobs } from "@/lib/server/jobs/queue";
import { isStripeConfigured } from "@/lib/server/config";
import { constructStripeEvent } from "@/lib/server/stripe";
import { updateStore } from "@/lib/server/db";
import { markPaymentPaid } from "@/lib/server/payments";

export const runtime = "nodejs";

/**
 * Stripe webhook — stores payment_refs only (session id / status).
 * Never receives or vaults card PANs.
 */
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return Response.json(
      {
        error:
          "Stripe not configured — use demo checkout. Webhook ignored.",
      },
      { status: 400 },
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event;
  try {
    event = constructStripeEvent(rawBody, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return Response.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      id: string;
      metadata?: { paymentRefId?: string };
      payment_status?: string;
    };
    const paymentId = session.metadata?.paymentRefId;
    if (paymentId && session.payment_status === "paid") {
      await enqueueJob("webhook.payment", {
        paymentId,
        externalId: session.id,
        meta: { stripeEventId: event.id },
      });
      try {
        await processDueJobs(5);
      } catch {
        // Fall through to direct mark
        await updateStore((store) => {
          markPaymentPaid(store, paymentId, session.id, {
            stripeEventId: event.id,
          });
        });
      }
    }
  }

  return Response.json({ received: true });
}
