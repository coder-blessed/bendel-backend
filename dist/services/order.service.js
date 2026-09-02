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
    // Send relevant email via Resend
    if (input.type === "ticket") {
        const ticketCode = `TKT-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
        // Create ticket record in database
        await db.insert(tickets).values({
            orderId: order.id,
            ticketCode,
            matchName: input.itemName,
            venue: "Samuel Ogbemudia Stadium, Benin City",
            sentAt: new Date(),
        });
        // Send match ticket confirmation email to customer
        await sendMatchTicketEmail({
            to: input.customerEmail,
            orderId: order.id,
            customerName: input.customerName,
            matchName: input.itemName,
            ticketCode,
            seatTier: input.itemCategory,
            amount: input.amount,
            venue: "Samuel Ogbemudia Stadium, Benin City",
        });
    }
    else if (input.type === "merch") {
        // Send merchandise order receipt email to customer
        await sendOrderReceiptEmail({
            to: input.customerEmail,
            orderId: order.id,
            customerName: input.customerName,
            itemName: input.itemName,
            itemCategory: input.itemCategory,
            deliveryMethod: input.deliveryMethod,
            address: input.address,
            amount: input.amount,
            deliveryFee: input.deliveryFee ?? 0,
            totalAmount: Number(input.amount) + Number(input.deliveryFee ?? 0),
            paymentReference: input.paymentReference,
        });
    }
    return order;
}
export async function listOrders() {
    return db.select().from(orders).orderBy(desc(orders.createdAt));
}
export async function getOrdersByUser(userId) {
    return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}
export async function getOrderById(id) {
    const matches = await db.select().from(orders).where(eq(orders.id, id));
    return matches[0] ?? null;
}
export async function updateOrderStatus(id, status) {
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
