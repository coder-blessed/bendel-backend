import { Router } from "express";
import {
  forgotPasswordController,
  loginController,
  meController,
  resendVerificationController,
  resetPasswordController,
  signupController,
  verifyEmailController,
} from "../controllers/auth.controller.js";
import {
  createOrderController,
  getOrderController,
  listOrdersController,
  myOrdersController,
  updateOrderStatusController,
} from "../controllers/order.controller.js";
import { getProfileController, saveProfileController } from "../controllers/profile.controller.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ success: true, message: "Bendel backend is running." });
});

// Authentication routes
router.post("/auth/signup", signupController);
router.post("/auth/login", loginController);
router.get("/auth/me", requireAuth, meController);
router.post("/auth/verify-email", verifyEmailController);
router.post("/auth/resend-verification", resendVerificationController);
router.post("/auth/forgot-password", forgotPasswordController);
router.post("/auth/reset-password", resetPasswordController);

// User Profile routes
router.get("/profile", requireAuth, getProfileController);
router.put("/profile", requireAuth, saveProfileController);

// Order & Tickets routes
router.post("/orders", requireAuth, createOrderController);
router.get("/orders", requireAuth, requireAdmin, listOrdersController);
router.get("/orders/me", requireAuth, myOrdersController);
router.get("/orders/:id", requireAuth, getOrderController);
router.patch("/orders/:id/status", requireAuth, requireAdmin, updateOrderStatusController);

export default router;
