import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { orders, tickets, users } from "../db/schema.js";
import { getNextHomeFixture, getFixtureDisplayName } from "./fixture.service.js";
import { sendMatchTicketEmail, sendOrderReceiptEmail } from "./email.service.js";


export async function createOrder(input: {
  userId?: string | null;
  type: "ticket" | "merch";
  itemId: string;
  itemName: string;
  itemCategory: string;
  customerName: string;
  customerEmail: string;
  phone: string;
  deliveryMethod: "pickup" | "delivery";
  address?: string | null;
  amount: number;
  deliveryFee?: number;
  paymentReference?: string | null;
  squadTransactionId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const [order] = await db
    .insert(orders)
    .values({
      userId: input.userId ?? null,
      type: input.type,
      itemId: input.itemId,
      itemName: input.itemName,
      itemCategory: input.itemCategory,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      phone: input.phone,
      deliveryMethod: input.deliveryMethod,
      address: input.address ?? null,
      amount: String(input.amount),
      deliveryFee: String(input.deliveryFee ?? 0),
      paymentReference: input.paymentReference ?? null,
      squadTransactionId: input.squadTransactionId ?? null,
      status: "pending",
      metadata: input.metadata ?? null,
    })
    .returning();

  return order;
}

export async function listOrders() {
  return db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt));
}

export async function getOrdersByUser(userId: string) {
  return db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
}

export async function getOrderById(id: string) {
  const matches = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id));

  return matches[0] ?? null;
}

export async function updateOrderStatus(
  id: string,
  status:
    | "pending"
    | "paid"
    | "processing"
    | "completed"
    | "cancelled",
) {
  const [order] = await db
    .update(orders)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id))
    .returning();

  return order;
}

export async function getUsersWithOrders() {
  return db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));
}

export async function completePaidOrder(
  orderId: string,
  squadTransactionId?: string | null,
) {
  const order = await getOrderById(orderId);

  if (!order) {
    throw new Error("Order not found.");
  }

  // Idempotency:
  // If the webhook arrives more than once, do not create
  // another ticket or send another confirmation email.
  if (order.status === "paid" || order.status === "processing" || order.status === "completed") {
    return order;
  }

  const [updatedOrder] = await db
    .update(orders)
    .set({
      status: "paid",
      squadTransactionId:
        squadTransactionId ?? order.squadTransactionId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id))
    .returning();

  if (!updatedOrder) {
    throw new Error("Unable to update paid order.");
  }

  if (updatedOrder.type === "ticket") {
    const ticketCode = `TKT-${Date.now()
      .toString()
      .slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const upcomingFixture = await getNextHomeFixture();
    const fixtureTitle = getFixtureDisplayName(upcomingFixture) || updatedOrder.itemName;
    const fixtureVenue = upcomingFixture?.venue || "Samuel Ogbemudia Stadium, Benin City";
    const fixtureDate = upcomingFixture?.date || new Date().toISOString();

    await db.insert(tickets).values({
      orderId: updatedOrder.id,
      ticketCode,
      matchName: fixtureTitle,
      venue: fixtureVenue,
      eventDate: new Date(fixtureDate),
      sentAt: new Date(),
    });

    await sendMatchTicketEmail({
      to: updatedOrder.customerEmail,
      orderId: updatedOrder.id,
      customerName: updatedOrder.customerName,
      matchName: fixtureTitle,
      ticketCode,
      seatTier: updatedOrder.itemCategory,
      amount: Number(updatedOrder.amount),
      venue: fixtureVenue,
      eventDate: fixtureDate,
    });
  } else if (updatedOrder.type === "merch") {
    await sendOrderReceiptEmail({
      to: updatedOrder.customerEmail,
      orderId: updatedOrder.id,
      customerName: updatedOrder.customerName,
      itemName: updatedOrder.itemName,
      itemCategory: updatedOrder.itemCategory,
      deliveryMethod: updatedOrder.deliveryMethod,
      address: updatedOrder.address ?? undefined,
      amount: Number(updatedOrder.amount),
      deliveryFee: Number(updatedOrder.deliveryFee),
      totalAmount:
        Number(updatedOrder.amount) +
        Number(updatedOrder.deliveryFee),
      paymentReference: updatedOrder.paymentReference ?? undefined,
    });
  }

  return updatedOrder;
}