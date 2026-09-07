import { Router } from "express";
import {
  adminLoginController,
  getAdminAuditLogsController,
  getAdminOrderController,
  getAdminStatsController,
  getAdminUserController,
  listAdminOrdersController,
  listAdminTicketsController,
  listAdminUsersController,
  resendOrderEmailController,
  updateAdminOrderStatusController,
  updateAdminUserController,
  uploadAdminMediaController,
  verifyTicketCodeController,
} from "../controllers/admin.controller.js";
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

// ==========================================
// Public Authentication Routes
// ==========================================
router.post("/auth/signup", signupController);
router.post("/auth/login", loginController);
router.get("/auth/me", requireAuth, meController);
router.post("/auth/verify-email", verifyEmailController);
router.post("/auth/resend-verification", resendVerificationController);
router.post("/auth/forgot-password", forgotPasswordController);
router.post("/auth/reset-password", resetPasswordController);

// Dedicated Admin Login Route
router.post("/admin/login", adminLoginController);
router.post("/auth/admin-login", adminLoginController);

// ==========================================
// User Profile Routes
// ==========================================
router.get("/profile", requireAuth, getProfileController);
router.put("/profile", requireAuth, saveProfileController);

// ==========================================
// Customer Order Routes
// ==========================================
router.post("/orders", requireAuth, createOrderController);
router.get("/orders/me", requireAuth, myOrdersController);
router.get("/orders/:id", requireAuth, getOrderController);

// Backward-compatibility order routes
router.get("/orders", requireAuth, requireAdmin, listOrdersController);
router.patch("/orders/:id/status", requireAuth, requireAdmin, updateOrderStatusController);

// ==========================================
// Full Admin Dashboard APIs (Protected)
// ==========================================

// Dashboard Overview / Stats
router.get("/admin/stats", requireAuth, requireAdmin, getAdminStatsController);
router.get("/admin/overview", requireAuth, requireAdmin, getAdminStatsController);

// Orders Management
router.get("/admin/orders", requireAuth, requireAdmin, listAdminOrdersController);
router.get("/admin/orders/:id", requireAuth, requireAdmin, getAdminOrderController);
router.patch("/admin/orders/:id/status", requireAuth, requireAdmin, updateAdminOrderStatusController);
router.post("/admin/orders/:id/resend-email", requireAuth, requireAdmin, resendOrderEmailController);

// Tickets & Matchday Entry Validation
router.get("/admin/tickets", requireAuth, requireAdmin, listAdminTicketsController);
router.post("/admin/tickets/verify", requireAuth, requireAdmin, verifyTicketCodeController);

// Fan Club Members / Users Management
router.get("/admin/users", requireAuth, requireAdmin, listAdminUsersController);
router.get("/admin/users/:id", requireAuth, requireAdmin, getAdminUserController);
router.patch("/admin/users/:id", requireAuth, requireAdmin, updateAdminUserController);

// Media & Asset Uploads
router.post("/admin/upload", requireAuth, requireAdmin, uploadAdminMediaController);

// Admin Audit Logs
router.get("/admin/audit-logs", requireAuth, requireAdmin, getAdminAuditLogsController);

export default router;
