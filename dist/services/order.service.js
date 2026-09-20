import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { orders, tickets, users } from "../db/schema.js";
import { sendMatchTicketEmail, sendOrderReceiptEmail } from "./email.service.js";
export async function createOrder(input) {
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
export async function getOrdersByUser(userId) {
    return db
        .select()
        .from(orders)
        .where(eq(orders.userId, userId))
        .orderBy(desc(orders.createdAt));
}
export async function getOrderById(id) {
    const matches = await db
        .select()
        .from(orders)
        .where(eq(orders.id, id));
    return matches[0] ?? null;
}
export async function updateOrderStatus(id, status) {
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
export async function completePaidOrder(orderId, squadTransactionId) {
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
        squadTransactionId: squadTransactionId ?? order.squadTransactionId ?? null,
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
        await db.insert(tickets).values({
            orderId: updatedOrder.id,
            ticketCode,
            matchName: updatedOrder.itemName,
            venue: "Samuel Ogbemudia Stadium, Benin City",
            sentAt: new Date(),
        });
        await sendMatchTicketEmail({
            to: updatedOrder.customerEmail,
            orderId: updatedOrder.id,
            customerName: updatedOrder.customerName,
            matchName: updatedOrder.itemName,
            ticketCode,
            seatTier: updatedOrder.itemCategory,
            amount: Number(updatedOrder.amount),
            venue: "Samuel Ogbemudia Stadium, Benin City",
        });
    }
    else if (updatedOrder.type === "merch") {
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
            totalAmount: Number(updatedOrder.amount) +
                Number(updatedOrder.deliveryFee),
            paymentReference: updatedOrder.paymentReference ?? undefined,
        });
    }
    return updatedOrder;
}
