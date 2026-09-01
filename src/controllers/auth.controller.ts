import type { Request, Response } from "express";
import { z } from "zod";
import { loginAdmin } from "../services/admin.service.js";
import { successResponse, errorResponse } from "../utils/response.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function loginController(req: Request, res: Response) {
  try {
    const payload = loginSchema.parse(req.body);
    const result = await loginAdmin(payload.email, payload.password);
    return res.status(200).json(successResponse(result, "Admin login successful."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sign in.";
    return res.status(400).json(errorResponse(message, error));
  }
}
