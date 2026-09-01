import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { orders, users } from "../db/schema.js";

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
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function getOrdersByUser(userId: string) {
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function getOrderById(id: string) {
  const matches = await db.select().from(orders).where(eq(orders.id, id));
  return matches[0] ?? null;
}

export async function updateOrderStatus(id: string, status: "pending" | "paid" | "processing" | "completed" | "cancelled") {
  const [order] = await db
    .update(orders)
    .set({ status, updatedAt: new Date() })
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
