import { Router } from "express";
import { loginController } from "../controllers/auth.controller.js";
import { createOrderController, getOrderController, listOrdersController, myOrdersController, updateOrderStatusController } from "../controllers/order.controller.js";
import { getProfileController, saveProfileController } from "../controllers/profile.controller.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
const router = Router();
router.get("/health", (_req, res) => {
    res.status(200).json({ success: true, message: "Bendel backend is running." });
});
router.post("/auth/login", loginController);
router.get("/profile", requireAuth, getProfileController);
router.put("/profile", requireAuth, saveProfileController);
router.post("/orders", requireAuth, createOrderController);
router.get("/orders", requireAuth, requireAdmin, listOrdersController);
router.get("/orders/me", requireAuth, myOrdersController);
router.get("/orders/:id", requireAuth, getOrderController);
router.patch("/orders/:id/status", requireAuth, requireAdmin, updateOrderStatusController);
export default router;
