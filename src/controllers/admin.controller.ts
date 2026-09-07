import type { Request, Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  getAdminAuditLogs,
  getAdminOrder,
  getAdminOverviewStats,
  getAdminUser,
  listAdminOrders,
  listAdminTickets,
  listAdminUsers,
  loginAdmin,
  resendOrderEmail,
  updateAdminOrderStatus,
  updateAdminUser,
  verifyTicketCode,
} from "../services/admin.service.js";
import { uploadToCloudinary } from "../services/cloudinary.service.js";
import { errorResponse, successResponse } from "../utils/response.js";

const adminLoginSchema = z.object({
  email: z.string().email("Please provide a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(["pending", "paid", "processing", "completed", "cancelled"]),
});

const verifyTicketSchema = z.object({
  ticketCode: z.string().min(3, "Ticket code is required."),
});

const updateUserSchema = z.object({
  role: z.enum(["admin", "member"]).optional(),
  isActive: z.boolean().optional(),
});

const uploadMediaSchema = z.object({
  file: z.string().min(1, "Image file data or URL is required."),
  folder: z.string().optional(),
});

/**
 * Admin Login
 */
export async function adminLoginController(req: Request, res: Response) {
  try {
    const payload = adminLoginSchema.parse(req.body);
    const result = await loginAdmin(payload.email, payload.password);
    return res.status(200).json(successResponse(result, "Admin signed in successfully."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sign in as admin.";
    return res.status(401).json(errorResponse(message, error));
  }
}

/**
 * Overview KPIs & Dashboard Statistics
 */
export async function getAdminStatsController(req: AuthenticatedRequest, res: Response) {
  try {
    const stats = await getAdminOverviewStats();
    return res.status(200).json(successResponse(stats, "Dashboard stats loaded."));
  } catch (error) {
    return res.status(500).json(errorResponse("Unable to load overview statistics.", error));
  }
}

/**
 * List orders with search, filter, and pagination
 */
export async function listAdminOrdersController(req: AuthenticatedRequest, res: Response) {
  try {
    const status = req.query.status as "pending" | "paid" | "processing" | "completed" | "cancelled" | undefined;
    const type = req.query.type as "ticket" | "merch" | undefined;
    const search = req.query.search as string | undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;

    const orders = await listAdminOrders({ status, type, search, limit, offset });
    return res.status(200).json(successResponse(orders, "Orders loaded."));
  } catch (error) {
    return res.status(500).json(errorResponse("Unable to load orders.", error));
  }
}

/**
 * Get single order with linked tickets and customer profile
 */
export async function getAdminOrderController(req: AuthenticatedRequest, res: Response) {
  try {
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const order = await getAdminOrder(orderId);
    if (!order) {
      return res.status(404).json(errorResponse("Order not found."));
    }
    return res.status(200).json(successResponse(order, "Order details loaded."));
  } catch (error) {
    return res.status(500).json(errorResponse("Unable to fetch order details.", error));
  }
}

/**
 * Update order status
 */
export async function updateAdminOrderStatusController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = updateOrderStatusSchema.parse(req.body);
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const adminId = req.user?.userId;

    const updated = await updateAdminOrderStatus(orderId, payload.status, adminId);
    return res.status(200).json(successResponse(updated, `Order status updated to '${payload.status}'.`));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update order status.";
    return res.status(400).json(errorResponse(message, error));
  }
}

/**
 * Resend match ticket or receipt email
 */
export async function resendOrderEmailController(req: AuthenticatedRequest, res: Response) {
  try {
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const adminId = req.user?.userId;

    const result = await resendOrderEmail(orderId, adminId);
    return res.status(200).json(successResponse(result, "Notification email resent successfully."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resend email.";
    return res.status(400).json(errorResponse(message, error));
  }
}

/**
 * List all issued match tickets
 */
export async function listAdminTicketsController(req: AuthenticatedRequest, res: Response) {
  try {
    const search = req.query.search as string | undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;

    const ticketsList = await listAdminTickets({ search, limit, offset });
    return res.status(200).json(successResponse(ticketsList, "Tickets loaded."));
  } catch (error) {
    return res.status(500).json(errorResponse("Unable to load tickets.", error));
  }
}

/**
 * Verify ticket code at matchday gate
 */
export async function verifyTicketCodeController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = verifyTicketSchema.parse(req.body);
    const adminId = req.user?.userId;

    const result = await verifyTicketCode(payload.ticketCode, adminId);
    return res.status(200).json(successResponse(result, result.message));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify ticket.";
    return res.status(400).json(errorResponse(message, error));
  }
}

/**
 * List all registered fans & users
 */
export async function listAdminUsersController(req: AuthenticatedRequest, res: Response) {
  try {
    const role = req.query.role as "admin" | "member" | undefined;
    const search = req.query.search as string | undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;

    const usersList = await listAdminUsers({ role, search, limit, offset });
    return res.status(200).json(successResponse(usersList, "Users loaded."));
  } catch (error) {
    return res.status(500).json(errorResponse("Unable to load users.", error));
  }
}

/**
 * Get user details with profile and purchase history
 */
export async function getAdminUserController(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = await getAdminUser(userId);
    if (!user) {
      return res.status(404).json(errorResponse("User not found."));
    }
    return res.status(200).json(successResponse(user, "User details loaded."));
  } catch (error) {
    return res.status(500).json(errorResponse("Unable to fetch user details.", error));
  }
}

/**
 * Update user role or active status
 */
export async function updateAdminUserController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = updateUserSchema.parse(req.body);
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const adminId = req.user?.userId;

    const updated = await updateAdminUser(userId, payload, adminId);
    return res.status(200).json(successResponse(updated, "User updated successfully."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update user.";
    return res.status(400).json(errorResponse(message, error));
  }
}

/**
 * Upload media directly to Cloudinary
 */
export async function uploadAdminMediaController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = uploadMediaSchema.parse(req.body);
    const result = await uploadToCloudinary(payload.file, payload.folder);
    return res.status(200).json(successResponse(result, "Media uploaded to Cloudinary successfully."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload media.";
    return res.status(400).json(errorResponse(message, error));
  }
}

/**
 * Get admin audit activity logs
 */
export async function getAdminAuditLogsController(req: AuthenticatedRequest, res: Response) {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const logs = await getAdminAuditLogs(limit);
    return res.status(200).json(successResponse(logs, "Audit logs loaded."));
  } catch (error) {
    return res.status(500).json(errorResponse("Unable to load audit logs.", error));
  }
}
