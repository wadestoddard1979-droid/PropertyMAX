import { updateStore } from "./db";
import { registerJobHandler } from "./jobs/queue";
import { markPaymentPaid } from "./payments";

/** Job-queue side effects for Stripe/demo payment webhooks. */
export function registerPaymentJobHandlers() {
  registerJobHandler("webhook.payment", async (job) => {
    const paymentId = String(job.payload.paymentId || "");
    const externalId =
      job.payload.externalId != null
        ? String(job.payload.externalId)
        : null;
    if (!paymentId) {
      console.info("[job-queue] webhook.payment missing paymentId", job.payload);
      return;
    }
    await updateStore((store) => {
      markPaymentPaid(store, paymentId, externalId, {
        via: "job.webhook.payment",
        ...(typeof job.payload.meta === "object" && job.payload.meta
          ? (job.payload.meta as Record<string, unknown>)
          : {}),
      });
    });
  });
}
