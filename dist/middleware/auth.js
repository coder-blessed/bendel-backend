import { verifyToken } from "../utils/auth.js";
export function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Authentication required." });
    }
    try {
        const token = authHeader.replace("Bearer ", "");
        const payload = verifyToken(token);
        req.user = payload;
        return next();
    }
    catch {
        return res.status(401).json({ success: false, message: "Invalid or expired token." });
    }
}
export function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ success: false, message: "Admin access required." });
    }
    return next();
}
