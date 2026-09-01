import type { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/auth.js";
import {
  createOrder,
  getOrderById,
  getOrdersByUser,
  listOrders,
  updateOrderStatus,
} from "../services/order.service.js";
import { errorResponse, successResponse } from "../utils/response.js";

const createOrderSchema = z.object({
  type: z.enum(["ticket", "merch"]),
  itemId: z.string().min(1),
  itemName: z.string().min(1),
  itemCategory: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  phone: z.string().min(7),
  deliveryMethod: z.enum(["pickup", "delivery"]),
  address: z.string().optional().nullable(),
  amount: z.number().min(0),
  deliveryFee: z.number().min(0).optional(),
  paymentReference: z.string().optional().nullable(),
  squadTransactionId: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export async function createOrderController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = createOrderSchema.parse(req.body);
    const userId = req.user?.userId ?? null;

    const order = await createOrder({
      ...payload,
      userId,
      deliveryFee: payload.deliveryFee ?? 0,
    });

    return res.status(201).json(successResponse(order, "Order created successfully."));
  } catch (error) {
    return res.status(400).json(errorResponse("Unable to create order.", error));
  }
}

export async function listOrdersController(req: AuthenticatedRequest, res: Response) {
  try {
    const orders = await listOrders();
    return res.status(200).json(successResponse(orders, "Orders loaded."));
  } catch (error) {
    return res.status(500).json(errorResponse("Unable to load orders.", error));
  }
}

export async function myOrdersController(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json(errorResponse("Authentication required."));
    }

    const orders = await getOrdersByUser(userId);
    return res.status(200).json(successResponse(orders, "Your orders loaded."));
  } catch (error) {
    return res.status(500).json(errorResponse("Unable to load your orders.", error));
  }
}

export async function getOrderController(req: AuthenticatedRequest, res: Response) {
  try {
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const order = await getOrderById(orderId);
    if (!order) {
      return res.status(404).json(errorResponse("Order not found."));
    }

    return res.status(200).json(successResponse(order, "Order found."));
  } catch (error) {
    return res.status(500).json(errorResponse("Unable to fetch order.", error));
  }
}

export async function updateOrderStatusController(req: AuthenticatedRequest, res: Response) {
  try {
    const statusSchema = z.enum(["pending", "paid", "processing", "completed", "cancelled"]);
    const status = statusSchema.parse(req.body.status);
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const order = await updateOrderStatus(orderId, status);

    if (!order) {
      return res.status(404).json(errorResponse("Order not found."));
    }

    return res.status(200).json(successResponse(order, "Order status updated."));
  } catch (error) {
    return res.status(400).json(errorResponse("Unable to update order status.", error));
  }
}
