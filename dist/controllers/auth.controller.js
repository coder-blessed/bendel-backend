import { z } from "zod";
import { getUserById, loginUser, registerUser, requestPasswordReset, resendVerificationEmail, resetPassword, verifyEmail, } from "../services/auth.service.js";
import { errorResponse, successResponse } from "../utils/response.js";
const signupSchema = z.object({
    email: z.string().email("Please provide a valid email address."),
    password: z.string().min(6, "Password must be at least 6 characters long."),
});
const loginSchema = z.object({
    email: z.string().email("Please provide a valid email address."),
    password: z.string().min(1, "Password is required."),
});
const verifyEmailSchema = z.object({
    token: z.string().min(1, "Verification token is required."),
});
const resendVerificationSchema = z.object({
    email: z.string().email("Please provide a valid email address.").optional(),
});
const forgotPasswordSchema = z.object({
    email: z.string().email("Please provide a valid email address."),
});
const resetPasswordSchema = z.object({
    token: z.string().min(1, "Reset token is required."),
    password: z.string().min(6, "Password must be at least 6 characters long."),
});
/**
 * Sign up endpoint - Requires only email and password
 */
export async function signupController(req, res) {
    try {
        const payload = signupSchema.parse(req.body);
        const result = await registerUser(payload);
        return res.status(201).json(successResponse(result, "Account created successfully."));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unable to register account.";
        return res.status(400).json(errorResponse(message, error));
    }
}
/**
 * Sign in endpoint - email and password
 */
export async function loginController(req, res) {
    try {
        const payload = loginSchema.parse(req.body);
        const result = await loginUser(payload.email, payload.password);
        return res.status(200).json(successResponse(result, "Sign in successful."));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unable to sign in.";
        return res.status(400).json(errorResponse(message, error));
    }
}
/**
 * Get current authenticated user
 */
export async function meController(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json(errorResponse("Authentication required."));
        }
        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json(errorResponse("User not found."));
        }
        return res.status(200).json(successResponse(user, "User profile loaded."));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load user profile.";
        return res.status(500).json(errorResponse(message, error));
    }
}
/**
 * Verify email address with token
 */
export async function verifyEmailController(req, res) {
    try {
        const payload = verifyEmailSchema.parse(req.body);
        const result = await verifyEmail(payload.token);
        return res.status(200).json(successResponse(result, "Email verified successfully."));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Email verification failed.";
        return res.status(400).json(errorResponse(message, error));
    }
}
/**
 * Resend verification email
 */
export async function resendVerificationController(req, res) {
    try {
        const email = req.body.email || req.user?.email;
        if (!email) {
            return res.status(400).json(errorResponse("Email address is required."));
        }
        const result = await resendVerificationEmail(email);
        return res.status(200).json(successResponse(result, "Verification email sent."));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unable to resend verification email.";
        return res.status(400).json(errorResponse(message, error));
    }
}
/**
 * Request password reset link
 */
export async function forgotPasswordController(req, res) {
    try {
        const payload = forgotPasswordSchema.parse(req.body);
        const result = await requestPasswordReset(payload.email);
        return res.status(200).json(successResponse(result, "Password reset link sent."));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unable to process password reset.";
        return res.status(400).json(errorResponse(message, error));
    }
}
/**
 * Reset password with token
 */
export async function resetPasswordController(req, res) {
    try {
        const payload = resetPasswordSchema.parse(req.body);
        const result = await resetPassword(payload.token, payload.password);
        return res.status(200).json(successResponse(result, "Password reset successful."));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unable to reset password.";
        return res.status(400).json(errorResponse(message, error));
    }
}
