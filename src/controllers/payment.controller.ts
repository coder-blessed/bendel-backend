import type { Request, Response } from "express";
import { z } from "zod";
import {
  initializeSquadPayment,
  verifySquadPayment,
  validateSquadWebhook,
} from "../services/squad.service.js";
import { errorResponse, successResponse } from "../utils/response.js";

const initializePaymentSchema = z.object({
  orderId: z.string().uuid(),
});

export async function initializeSquadPaymentController(
  req: Request,
  res: Response,
) {
  try {
    const payload = initializePaymentSchema.parse(req.body);

    const result = await initializeSquadPayment(payload.orderId);

    return res.status(200).json(
      successResponse(
        result,
        "Squad payment initialized successfully.",
      ),
    );
  } catch (error) {
    console.error("Squad payment initialization error:", error);

    return res.status(400).json(
      errorResponse(
        "Unable to initialize Squad payment.",
        error,
      ),
    );
  }
}

export async function squadWebhookController(
  req: Request,
  res: Response,
) {
  try {
    const signature = req.header("x-squad-encrypted-body");

    if (!signature) {
      return res.status(401).json({
        success: false,
        message: "Missing Squad webhook signature.",
      });
    }

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body ?? {}), "utf8");

    const payload = rawBody.length > 0
      ? JSON.parse(rawBody.toString("utf8"))
      : {};

    const valid = validateSquadWebhook(rawBody.toString("utf8"), signature);

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Invalid Squad webhook signature.",
      });
    }

    const result = await verifySquadPayment(payload);

    return res.status(200).json({
      success: true,
      message: "Webhook received successfully.",
      data: result,
    });
  } catch (error) {
    console.error("Squad webhook error:", error);

    return res.status(400).json({
      success: false,
      message: "Unable to process Squad webhook.",
    });
  }
}

export async function verifySquadPaymentController(
  req: Request,
  res: Response,
) {
  try {
    const reference = Array.isArray(req.params.reference)
      ? req.params.reference[0]
      : req.params.reference;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required.",
      });
    }

    const result = await verifySquadPayment(reference);

    return res.status(200).json(
      successResponse(
        result,
        "Squad payment verification completed.",
      ),
    );
  } catch (error) {
    console.error("Squad payment verification error:", error);

    return res.status(400).json(
      errorResponse(
        "Unable to verify Squad payment.",
        error,
      ),
    );
  }
}