import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { orders } from "../db/schema.js";
import { env } from "../config/env.js";
import {
  completePaidOrder,
  getOrderById,
} from "./order.service.js";

type SquadInitializeResponse = {
  status?: number;
  success?: boolean;
  message?: string;
  data?: {
    checkout_url?: string;
    transaction_ref?: string;
    transaction_reference?: string;
    [key: string]: unknown;
  };
};

function requireSquadConfig() {
  if (!env.squad.baseUrl) {
    throw new Error("SQUAD_API_BASE_URL is not configured.");
  }

  if (!env.squad.apiKey && !env.squad.secretKey) {
    throw new Error("No Squad API credentials are configured.");
  }
}

function getSquadAuthHeaders() {
  const apiKey = env.squad.apiKey?.trim();
  const secretKey = env.squad.secretKey?.trim();

  const authValue = apiKey || secretKey;

  if (!authValue) {
    throw new Error("SQUAD API credentials are missing.");
  }

  return {
    Authorization: `Bearer ${authValue}`,
    "X-API-Key": apiKey || secretKey || "",
    "Content-Type": "application/json",
  };
}

function generateTransactionReference(orderId: string) {
  return `BIF-${orderId}-${Date.now()}`;
}

export async function initializeSquadPayment(orderId: string) {
  requireSquadConfig();

  const order = await getOrderById(orderId);

  if (!order) {
    throw new Error("Order not found.");
  }

  if (order.status !== "pending") {
    throw new Error(
      `Order cannot be paid because its status is "${order.status}".`,
    );
  }

  if (order.paymentReference) {
    throw new Error(
      "A Squad payment has already been initialized for this order.",
    );
  }

  const transactionReference =
    generateTransactionReference(order.id);

  const totalAmount =
    Number(order.amount) + Number(order.deliveryFee);

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error("Invalid order amount.");
  }

  // Squad expects the amount in kobo for NGN.
  const amountInKobo = Math.round(totalAmount * 100);

  const frontendCallbackUrl = `${env.frontendUrl.replace(/\/$/, "")}/payment/success`;

  const response = await fetch(
    `${env.squad.baseUrl.replace(/\/$/, "")}/transaction/initiate`,
    {
      method: "POST",
      headers: getSquadAuthHeaders(),
      body: JSON.stringify({
        amount: amountInKobo,
        email: order.customerEmail,
        currency: "NGN",
        initiate_type: "inline",
        transaction_ref: transactionReference,
        callback_url: frontendCallbackUrl,
      }),
    },
  );

  const payload =
    (await response.json()) as SquadInitializeResponse;

  if (!response.ok || !payload.success) {
    console.error("Squad initialize response:", payload);

    throw new Error(
      payload.message ??
        "Squad payment initialization failed.",
    );
  }

  const checkoutUrl = payload.data?.checkout_url;

  if (!checkoutUrl) {
    console.error("Squad response missing checkout URL:", payload);

    throw new Error(
      "Squad did not return a checkout URL.",
    );
  }

  await db
    .update(orders)
    .set({
      paymentReference: transactionReference,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  return {
    orderId: order.id,
    reference: transactionReference,
    checkoutUrl,
    amount: totalAmount,
    currency: "NGN",
  };
}

export function validateSquadWebhook(
  rawBody: string,
  signature: string,
) {
  if (!env.squad.secretKey) {
    throw new Error("SQUAD_SECRET_KEY is not configured.");
  }

  const expectedSignature = crypto
    .createHmac("sha512", env.squad.secretKey)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  } catch {
    return false;
  }
}

type SquadWebhookPayload = {
  transaction_ref?: string;
  transaction_reference?: string;
  id?: string | number;
  transaction_id?: string | number;
  status?: string;
  transaction_status?: string;
  amount?: number | string;
  currency?: string;
  [key: string]: unknown;
};

export async function verifySquadPayment(
  referenceOrPayload:
    | string
    | SquadWebhookPayload,
) {
  const reference =
    typeof referenceOrPayload === "string"
      ? referenceOrPayload
      : referenceOrPayload.transaction_ref ??
        referenceOrPayload.transaction_reference;

  if (!reference) {
    throw new Error(
      "Squad transaction reference was not provided.",
    );
  }

  const matches = await db
    .select()
    .from(orders)
    .where(eq(orders.paymentReference, reference));

  const order = matches[0] ?? null;

  if (!order) {
    throw new Error(
      `No Bendel order found for Squad reference "${reference}".`,
    );
  }

  // If called from webhook, use the webhook data.
  if (typeof referenceOrPayload !== "string") {
    const status = String(
      referenceOrPayload.status ??
        referenceOrPayload.transaction_status ??
        "",
    ).toLowerCase();

    const successfulStatuses = new Set([
      "success",
      "successful",
      "paid",
      "completed",
    ]);

    if (!successfulStatuses.has(status)) {
      return {
        verified: false,
        order,
        status,
      };
    }

    const amount =
      Number(referenceOrPayload.amount ?? 0);

    const expectedAmount =
      Math.round(
        (Number(order.amount) +
          Number(order.deliveryFee)) *
          100,
      );

    if (amount && amount !== expectedAmount) {
      throw new Error(
        "Squad payment amount does not match the order amount.",
      );
    }

    const transactionId =
      referenceOrPayload.id ??
      referenceOrPayload.transaction_id;

    const updatedOrder = await completePaidOrder(
      order.id,
      transactionId ? String(transactionId) : null,
    );

    return {
      verified: true,
      order: updatedOrder,
      status,
    };
  }

  /*
   * For a browser verification request, query Squad.
   *
   * Squad's transaction query endpoint requires date filters,
   * so we query a small window around the order creation date.
   */
  requireSquadConfig();

  const startDate = new Date(
    order.createdAt.getTime() - 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);

  const endDate = new Date(
    Date.now() + 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);

  const url = new URL(
    `${env.squad.baseUrl.replace(/\/$/, "")}/transaction`,
  );

  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("reference", reference);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.squad.secretKey}`,
      "Content-Type": "application/json",
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    console.error("Squad verification response:", payload);

    throw new Error(
      payload?.message ??
        "Unable to verify transaction with Squad.",
    );
  }

  return payload;
}