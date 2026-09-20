import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  adminAuditLogs,
  orders,
  profiles,
  tickets,
  users,
} from "../db/schema.js";
import { comparePassword, hashPassword, signToken } from "../utils/auth.js";
import { sendMatchTicketEmail, sendOrderReceiptEmail } from "./email.service.js";

export async function ensureDefaultAdminUser() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD?.trim();

  if (!email || !password) {
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  if (existing) {
    const passwordMatches = await comparePassword(password, existing.passwordHash);
    const shouldPromoteToAdmin = existing.role !== "admin" || !existing.isActive || !existing.isEmailVerified;

    if (passwordMatches && !shouldPromoteToAdmin) {
      return;
    }

    const updatedPassword = passwordMatches ? existing.passwordHash : await hashPassword(password);

    await db
      .update(users)
      .set({
        passwordHash: updatedPassword,
        role: "admin",
        isActive: true,
        isEmailVerified: true,
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));

    return;
  }

  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    email: normalizedEmail,
    passwordHash,
    firstName: "Admin",
    lastName: "User",
    role: "admin",
    isActive: true,
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
  });
}

/**
 * Authenticates an admin user and returns a JWT token
 */
export async function loginAdmin(email: string, password: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase().trim()),
  });

  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  if (user.role !== "admin") {
    throw new Error("Admin access required");
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  // Record audit log
  await recordAdminAudit(user.id, "ADMIN_LOGIN", { email: user.email });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  };
}

/**
 * Creates a new administrative user
 */
export async function createAdminUser(data: {
  email: string;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
}) {
  const passwordHash = await hashPassword(data.password);

  const [user] = await db
    .insert(users)
    .values({
      email: data.email.toLowerCase().trim(),
      passwordHash,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      role: "admin",
      isActive: true,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    })
    .returning();

  return user;
}

/**
 * Records an action in the admin audit log
 */
export async function recordAdminAudit(
  adminId: string | null,
  action: string,
  details?: Record<string, unknown>
) {
  try {
    await db.insert(adminAuditLogs).values({
      adminId: adminId ?? null,
      action,
      details: details ?? null,
    });
  } catch (err) {
    console.warn("Failed to record admin audit log:", err);
  }
}

/**
 * Retrieves high-level analytics & metrics for the Admin Dashboard
 */
export async function getAdminOverviewStats() {
  const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
  const allTickets = await db.select().from(tickets).orderBy(desc(tickets.createdAt));

  // Compute revenue from orders that are paid or completed
  let totalRevenue = 0;
  let ticketRevenue = 0;
  let merchRevenue = 0;
  let pendingOrdersCount = 0;
  let paidOrdersCount = 0;
  let completedOrdersCount = 0;
  let cancelledOrdersCount = 0;

  for (const order of allOrders) {
    const amount = parseFloat(order.amount) || 0;
    const isPaid = order.status === "paid" || order.status === "completed";

    if (isPaid) {
      totalRevenue += amount;
      if (order.type === "ticket") {
        ticketRevenue += amount;
      } else {
        merchRevenue += amount;
      }
    }

    if (order.status === "pending") pendingOrdersCount++;
    else if (order.status === "paid") paidOrdersCount++;
    else if (order.status === "completed") completedOrdersCount++;
    else if (order.status === "cancelled") cancelledOrdersCount++;
  }

  const ticketOrdersCount = allOrders.filter((o) => o.type === "ticket").length;
  const merchOrdersCount = allOrders.filter((o) => o.type === "merch").length;

  const totalMembers = allUsers.filter((u) => u.role === "member").length;
  const verifiedMembers = allUsers.filter((u) => u.isEmailVerified).length;
  const adminCount = allUsers.filter((u) => u.role === "admin").length;

  // Recent 6 orders
  const recentOrders = allOrders.slice(0, 6);

  // Recent 6 users
  const recentUsers = allUsers.slice(0, 6).map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    isEmailVerified: u.isEmailVerified,
    createdAt: u.createdAt,
  }));

  return {
    kpis: {
      totalRevenue,
      ticketRevenue,
      merchRevenue,
      totalOrders: allOrders.length,
      pendingOrders: pendingOrdersCount,
      paidOrders: paidOrdersCount,
      completedOrders: completedOrdersCount,
      cancelledOrders: cancelledOrdersCount,
      ticketOrdersCount,
      merchOrdersCount,
      totalTicketsIssued: allTickets.length,
      totalUsers: allUsers.length,
      totalMembers,
      verifiedMembers,
      adminCount,
    },
    recentOrders,
    recentUsers,
  };
}

/**
 * Lists orders with optional filters, search, and pagination
 */
export async function listAdminOrders(filter: {
  status?: "pending" | "paid" | "processing" | "completed" | "cancelled";
  type?: "ticket" | "merch";
  search?: string;
  limit?: number;
  offset?: number;
}) {
  let query = db.select().from(orders);

  const conditions = [];

  if (filter.status) {
    conditions.push(eq(orders.status, filter.status));
  }
  if (filter.type) {
    conditions.push(eq(orders.type, filter.type));
  }
  if (filter.search && filter.search.trim()) {
    const term = `%${filter.search.trim()}%`;
    conditions.push(
      or(
        ilike(orders.customerName, term),
        ilike(orders.customerEmail, term),
        ilike(orders.phone, term),
        ilike(orders.itemName, term),
        ilike(orders.paymentReference, term)
      )
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const results = await query
    .orderBy(desc(orders.createdAt))
    .limit(filter.limit ?? 50)
    .offset(filter.offset ?? 0);

  return results;
}

/**
 * Gets full order details including linked tickets
 */
export async function getAdminOrder(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;

  const orderTickets = await db.select().from(tickets).where(eq(tickets.orderId, orderId));

  let customerUser = null;
  if (order.userId) {
    const [user] = await db.select().from(users).where(eq(users.id, order.userId));
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, order.userId));
    customerUser = { ...user, profile };
  }

  return {
    ...order,
    tickets: orderTickets,
    customerUser,
  };
}

/**
 * Updates an order status and performs auto-actions (e.g. ticket generation & emailing)
 */
export async function updateAdminOrderStatus(
  orderId: string,
  status: "pending" | "paid" | "processing" | "completed" | "cancelled",
  adminId?: string
) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) {
    throw new Error("Order not found");
  }

  const previousStatus = order.status;

  const [updatedOrder] = await db
    .update(orders)
    .set({ status, updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();

  // If newly marked as paid or completed, ensure tickets exist & email sent
  if ((status === "paid" || status === "completed") && previousStatus !== "paid" && previousStatus !== "completed") {
    if (order.type === "ticket") {
      const existingTickets = await db.select().from(tickets).where(eq(tickets.orderId, orderId));

      let ticketCode = existingTickets[0]?.ticketCode;
      if (!ticketCode) {
        ticketCode = `TKT-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
        await db.insert(tickets).values({
          orderId: order.id,
          ticketCode,
          matchName: order.itemName,
          venue: "Samuel Ogbemudia Stadium, Benin City",
          sentAt: new Date(),
        });
      }

      await sendMatchTicketEmail({
        to: order.customerEmail,
        orderId: order.id,
        customerName: order.customerName,
        matchName: order.itemName,
        ticketCode,
        seatTier: order.itemCategory,
        amount: parseFloat(order.amount),
        venue: "Samuel Ogbemudia Stadium, Benin City",
      });
    } else if (order.type === "merch") {
      await sendOrderReceiptEmail({
        to: order.customerEmail,
        orderId: order.id,
        customerName: order.customerName,
        itemName: order.itemName,
        itemCategory: order.itemCategory,
        deliveryMethod: order.deliveryMethod,
        address: order.address,
        amount: parseFloat(order.amount),
        deliveryFee: parseFloat(order.deliveryFee ?? "0"),
        totalAmount: parseFloat(order.amount) + parseFloat(order.deliveryFee ?? "0"),
        paymentReference: order.paymentReference,
      });
    }
  }

  await recordAdminAudit(adminId ?? null, "UPDATE_ORDER_STATUS", {
    orderId,
    previousStatus,
    newStatus: status,
  });

  return updatedOrder;
}

/**
 * Resends the notification email for an order (ticket or merchandise receipt)
 */
export async function resendOrderEmail(orderId: string, adminId?: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) {
    throw new Error("Order not found");
  }

  if (order.type === "ticket") {
    let [ticket] = await db.select().from(tickets).where(eq(tickets.orderId, orderId));
    let ticketCode = ticket?.ticketCode;

    if (!ticketCode) {
      ticketCode = `TKT-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const [newTicket] = await db
        .insert(tickets)
        .values({
          orderId: order.id,
          ticketCode,
          matchName: order.itemName,
          venue: "Samuel Ogbemudia Stadium, Benin City",
          sentAt: new Date(),
        })
        .returning();
      ticket = newTicket;
    }

    const emailResult = await sendMatchTicketEmail({
      to: order.customerEmail,
      orderId: order.id,
      customerName: order.customerName,
      matchName: order.itemName,
      ticketCode,
      seatTier: order.itemCategory,
      amount: parseFloat(order.amount),
      venue: "Samuel Ogbemudia Stadium, Benin City",
    });

    await recordAdminAudit(adminId ?? null, "RESEND_TICKET_EMAIL", { orderId, ticketCode });
    return { success: true, emailResult, ticketCode };
  } else {
    const emailResult = await sendOrderReceiptEmail({
      to: order.customerEmail,
      orderId: order.id,
      customerName: order.customerName,
      itemName: order.itemName,
      itemCategory: order.itemCategory,
      deliveryMethod: order.deliveryMethod,
      address: order.address,
      amount: parseFloat(order.amount),
      deliveryFee: parseFloat(order.deliveryFee ?? "0"),
      totalAmount: parseFloat(order.amount) + parseFloat(order.deliveryFee ?? "0"),
      paymentReference: order.paymentReference,
    });

    await recordAdminAudit(adminId ?? null, "RESEND_RECEIPT_EMAIL", { orderId });
    return { success: true, emailResult };
  }
}

/**
 * Lists all match tickets with associated order and event details
 */
export async function listAdminTickets(filter: { search?: string; limit?: number; offset?: number }) {
  let query = db
    .select({
      id: tickets.id,
      orderId: tickets.orderId,
      ticketCode: tickets.ticketCode,
      matchName: tickets.matchName,
      venue: tickets.venue,
      eventDate: tickets.eventDate,
      sentAt: tickets.sentAt,
      createdAt: tickets.createdAt,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      itemCategory: orders.itemCategory,
      orderStatus: orders.status,
    })
    .from(tickets)
    .leftJoin(orders, eq(tickets.orderId, orders.id));

  if (filter.search && filter.search.trim()) {
    const term = `%${filter.search.trim()}%`;
    query = query.where(
      or(
        ilike(tickets.ticketCode, term),
        ilike(tickets.matchName, term),
        ilike(orders.customerName, term),
        ilike(orders.customerEmail, term)
      )
    ) as typeof query;
  }

  const results = await query
    .orderBy(desc(tickets.createdAt))
    .limit(filter.limit ?? 50)
    .offset(filter.offset ?? 0);

  return results;
}

/**
 * Gate scanner: verifies whether a ticket code is valid for matchday entry
 */
export async function verifyTicketCode(ticketCode: string, adminId?: string) {
  const cleanCode = ticketCode.trim().toUpperCase();

  const [ticket] = await db
    .select({
      id: tickets.id,
      orderId: tickets.orderId,
      ticketCode: tickets.ticketCode,
      matchName: tickets.matchName,
      venue: tickets.venue,
      eventDate: tickets.eventDate,
      sentAt: tickets.sentAt,
      createdAt: tickets.createdAt,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      seatTier: orders.itemCategory,
      orderStatus: orders.status,
    })
    .from(tickets)
    .leftJoin(orders, eq(tickets.orderId, orders.id))
    .where(eq(tickets.ticketCode, cleanCode));

  if (!ticket) {
    return {
      isValid: false,
      message: "Ticket not found. This code does not match any issued tickets.",
      code: cleanCode,
    };
  }

  const isOrderPaid = ticket.orderStatus === "paid" || ticket.orderStatus === "completed";

  await recordAdminAudit(adminId ?? null, "VERIFY_TICKET", {
    ticketCode: cleanCode,
    orderId: ticket.orderId,
    isValid: isOrderPaid,
  });

  return {
    isValid: isOrderPaid,
    status: isOrderPaid ? "VALID" : "UNPAID_OR_CANCELLED",
    ticket,
    message: isOrderPaid
      ? "Ticket verified successfully! Admittance granted."
      : `Order status is '${ticket.orderStatus}'. Please check payment before granting entry.`,
  };
}

/**
 * Lists users and members with profile details and order statistics
 */
export async function listAdminUsers(filter: {
  role?: "admin" | "member";
  search?: string;
  limit?: number;
  offset?: number;
}) {
  let query = db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      isEmailVerified: users.isEmailVerified,
      createdAt: users.createdAt,
      displayName: profiles.displayName,
      favoritePlayer: profiles.favoritePlayer,
      city: profiles.city,
      address: profiles.address,
      avatarUrl: profiles.avatarUrl,
    })
    .from(users)
    .leftJoin(profiles, eq(users.id, profiles.userId));

  const conditions = [];

  if (filter.role) {
    conditions.push(eq(users.role, filter.role));
  }
  if (filter.search && filter.search.trim()) {
    const term = `%${filter.search.trim()}%`;
    conditions.push(
      or(
        ilike(users.email, term),
        ilike(users.firstName, term),
        ilike(users.lastName, term),
        ilike(users.phone, term),
        ilike(profiles.displayName, term),
        ilike(profiles.city, term)
      )
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const results = await query
    .orderBy(desc(users.createdAt))
    .limit(filter.limit ?? 50)
    .offset(filter.offset ?? 0);

  return results;
}

/**
 * Gets single user details with profile and orders history
 */
export async function getAdminUser(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  const userOrders = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));

  return {
    ...user,
    profile,
    orders: userOrders,
  };
}

/**
 * Updates user role (admin/member) or active status
 */
export async function updateAdminUser(
  userId: string,
  data: { role?: "admin" | "member"; isActive?: boolean },
  adminId?: string
) {
  const updatePayload: Record<string, unknown> = { updatedAt: new Date() };

  if (data.role !== undefined) updatePayload.role = data.role;
  if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

  const [updatedUser] = await db
    .update(users)
    .set(updatePayload)
    .where(eq(users.id, userId))
    .returning();

  await recordAdminAudit(adminId ?? null, "UPDATE_USER", {
    targetUserId: userId,
    changes: data,
  });

  return updatedUser;
}

/**
 * Retrieves admin audit logs
 */
export async function getAdminAuditLogs(limit: number = 50) {
  return db
    .select({
      id: adminAuditLogs.id,
      adminId: adminAuditLogs.adminId,
      action: adminAuditLogs.action,
      details: adminAuditLogs.details,
      createdAt: adminAuditLogs.createdAt,
      adminEmail: users.email,
      adminName: sql`concat(${users.firstName}, ' ', ${users.lastName})`,
    })
    .from(adminAuditLogs)
    .leftJoin(users, eq(adminAuditLogs.adminId, users.id))
    .orderBy(desc(adminAuditLogs.createdAt))
    .limit(limit);
}
