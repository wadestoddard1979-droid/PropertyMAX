import { AuthError, jsonError, requireSession } from "@/lib/server/auth";
import { isStripeConfigured } from "@/lib/server/config";
import { readStore, updateStore } from "@/lib/server/db";
import { enqueueJob, processDueJobs } from "@/lib/server/jobs/queue";
import {
  createCheckoutPaymentRef,
  markPaymentPaid,
  paymentsVisibleTo,
  setAutopay,
} from "@/lib/server/payments";
import { createRentCheckoutSession } from "@/lib/server/stripe";

export async function GET() {
  try {
    const session = await requireSession(["tenant", "owner", "manager"]);
    const store = await readStore();
    const payments = paymentsVisibleTo(store, session);
    const autopay = store.autopayEnrollments.filter((a) => {
      if (session.role === "tenant") return a.tenantUserId === session.id;
      return true;
    });
    return Response.json({
      payments,
      autopay,
      mode: isStripeConfigured() ? "stripe" : "demo",
      stripeConfigured: isStripeConfigured(),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(["tenant"]);
    const body = (await req.json()) as {
      action?: "checkout" | "autopay" | "demo_complete";
      propertyId?: string;
      month?: string;
      amountCents?: number;
      enabled?: boolean;
      dayOfMonth?: number;
      paymentId?: string;
      origin?: string;
    };

    if (body.action === "autopay") {
      if (!body.propertyId) throw new AuthError("propertyId required", 400);
      let enrollmentId = "";
      await updateStore((store) => {
        const enrollment = setAutopay(store, session, {
          propertyId: body.propertyId!,
          enabled: Boolean(body.enabled),
          dayOfMonth: body.dayOfMonth,
        });
        enrollmentId = enrollment.id;
      });
      const store = await readStore();
      const enrollment = store.autopayEnrollments.find(
        (a) => a.id === enrollmentId,
      );
      return Response.json({
        enrollment,
        note: "Autopay enrollment is a stub — PropertMax never vaults cards.",
      });
    }

    if (body.action === "demo_complete") {
      if (isStripeConfigured()) {
        throw new AuthError(
          "Demo complete is disabled when Stripe keys are configured",
          400,
        );
      }
      if (!body.paymentId) throw new AuthError("paymentId required", 400);
      await enqueueJob("webhook.payment", {
        paymentId: body.paymentId,
        externalId: `demo_${body.paymentId}`,
        meta: { demo: true, labeled: "DEMO — not a real charge" },
      });
      await processDueJobs(5);
      let store = await readStore();
      let payment = store.paymentRefs.find((p) => p.id === body.paymentId);
      if (!payment) throw new AuthError("Payment not found", 404);
      if (payment.status !== "paid") {
        await updateStore((s) => {
          markPaymentPaid(s, body.paymentId!, `demo_${body.paymentId}`, {
            demo: true,
            labeled: "DEMO — not a real charge",
          });
        });
        store = await readStore();
        payment = store.paymentRefs.find((p) => p.id === body.paymentId);
      }
      return Response.json({
        payment,
        mode: "demo",
        label: "DEMO checkout success — not a real charge",
      });
    }

    if (!body.propertyId) throw new AuthError("propertyId required", 400);
    const month = body.month || new Date().toISOString().slice(0, 7);
    const store = await readStore();
    const property = store.properties.find((p) => p.id === body.propertyId);
    if (!property) throw new AuthError("Property not found", 404);
    const amountCents =
      body.amountCents ?? Math.round(property.monthlyRent * 100);

    let paymentId = "";
    await updateStore((s) => {
      const ref = createCheckoutPaymentRef(s, session, {
        propertyId: body.propertyId!,
        month,
        amountCents,
      });
      paymentId = ref.id;
    });

    const origin =
      body.origin ||
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    if (isStripeConfigured()) {
      const checkout = await createRentCheckoutSession({
        paymentRefId: paymentId,
        amountCents,
        month,
        tenantEmail: session.email,
        successUrl: `${origin}/?paid=${paymentId}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/?canceled=${paymentId}`,
      });
      if (checkout) {
        await updateStore((s) => {
          const ref = s.paymentRefs.find((p) => p.id === paymentId);
          if (ref) {
            ref.externalId = checkout.sessionId;
            ref.updatedAt = new Date().toISOString();
          }
        });
        return Response.json({
          mode: "stripe",
          paymentId,
          url: checkout.url,
          sessionId: checkout.sessionId,
        });
      }
    }

    return Response.json({
      mode: "demo",
      paymentId,
      label:
        "DEMO MODE — Stripe keys not set. Simulate checkout success below. No real charge.",
      url: null,
    });
  } catch (err) {
    return jsonError(err);
  }
}
