import { pgTable, text, timestamp, uuid, boolean, jsonb, decimal, pgEnum } from "drizzle-orm/pg-core";
export const userRoleEnum = pgEnum("user_role", ["admin", "member"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "paid", "processing", "completed", "cancelled"]);
export const orderTypeEnum = pgEnum("order_type", ["ticket", "merch"]);
export const deliveryMethodEnum = pgEnum("delivery_method", ["pickup", "delivery"]);
export const tokenTypeEnum = pgEnum("token_type", ["email_verification", "password_reset"]);
export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    phone: text("phone"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").default("member").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    isEmailVerified: boolean("is_email_verified").default(false).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const authTokens = pgTable("auth_tokens", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    type: tokenTypeEnum("type").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const profiles = pgTable("profiles", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    favoritePlayer: text("favorite_player"),
    avatarUrl: text("avatar_url"),
    city: text("city"),
    address: text("address"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const orders = pgTable("orders", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    type: orderTypeEnum("type").notNull(),
    itemId: text("item_id").notNull(),
    itemName: text("item_name").notNull(),
    itemCategory: text("item_category").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    phone: text("phone").notNull(),
    deliveryMethod: deliveryMethodEnum("delivery_method").default("pickup").notNull(),
    address: text("address"),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    deliveryFee: decimal("delivery_fee", { precision: 12, scale: 2 }).default("0.00").notNull(),
    paymentReference: text("payment_reference"),
    squadTransactionId: text("squad_transaction_id"),
    status: orderStatusEnum("status").default("pending").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const tickets = pgTable("tickets", {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
    ticketCode: text("ticket_code").notNull().unique(),
    matchName: text("match_name"),
    venue: text("venue"),
    eventDate: timestamp("event_date", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const adminAuditLogs = pgTable("admin_audit_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
