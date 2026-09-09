import crypto from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { authTokens, profiles, users } from "../db/schema.js";
import { comparePassword, hashPassword, signToken } from "../utils/auth.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email.service.js";

/**
 * Register a new user with just email and password.
 * Automatically generates a verification token and sends verification email via Resend.
 */
export async function registerUser(data: { email: string; password: string }) {
  const normalizedEmail = data.email.trim().toLowerCase();

  const existing = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  if (existing) {
    throw new Error("An account with this email address already exists.");
  }

  const passwordHash = await hashPassword(data.password);

  const [newUser] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      passwordHash,
      role: "member",
      isEmailVerified: false,
    })
    .returning();

  // Create initial profile for member
  await db.insert(profiles).values({
    userId: newUser.id,
    displayName: normalizedEmail.split("@")[0],
  });

  // Generate 24-hour verification token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(authTokens).values({
    userId: newUser.id,
    token,
    type: "email_verification",
    expiresAt,
  });

  // Send verification email via Resend
  const emailResult = await sendVerificationEmail({
    to: newUser.email,
    token,
  });

  if (!emailResult.success) {
    throw new Error(emailResult.error ?? "Unable to send verification email.");
  }

  const authToken = signToken({
    userId: newUser.id,
    email: newUser.email,
    role: newUser.role,
  });

  return {
    token: authToken,
    user: {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      isEmailVerified: newUser.isEmailVerified,
    },
    message: "Registration successful. Verification email has been sent.",
  };
}

/**
 * Sign in existing user (member or admin)
 */
export async function loginUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  if (!user.isActive) {
    throw new Error("Your account has been deactivated. Please contact support.");
  }

  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid email or password.");
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
    },
  };
}

/**
 * Verify email address using token
 */
export async function verifyEmail(token: string) {
  const tokenRecord = await db.query.authTokens.findFirst({
    where: and(
      eq(authTokens.token, token),
      eq(authTokens.type, "email_verification"),
      isNull(authTokens.usedAt),
      gt(authTokens.expiresAt, new Date()),
    ),
  });

  if (!tokenRecord) {
    throw new Error("Verification link is invalid or has expired. Please request a new one.");
  }

  // Mark token as used
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(eq(authTokens.id, tokenRecord.id));

  // Mark user email as verified
  const [updatedUser] = await db
    .update(users)
    .set({
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, tokenRecord.userId))
    .returning();

  return {
    success: true,
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      isEmailVerified: true,
    },
    message: "Email address verified successfully.",
  };
}

/**
 * Resend email verification link
 */
export async function resendVerificationEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  if (!user) {
    // Return friendly generic response to prevent email enumeration
    return { success: true, message: "If an account exists, a verification link has been sent." };
  }

  if (user.isEmailVerified) {
    return { success: true, message: "Your email address is already verified." };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(authTokens).values({
    userId: user.id,
    token,
    type: "email_verification",
    expiresAt,
  });

  const emailResult = await sendVerificationEmail({
    to: user.email,
    token,
    firstName: user.firstName,
  });

  if (!emailResult.success) {
    throw new Error(emailResult.error ?? "Unable to send verification email.");
  }

  return { success: true, message: "Verification link sent to your email." };
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  if (!user) {
    return { success: true, message: "If an account exists, a password reset link has been sent." };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(authTokens).values({
    userId: user.id,
    token,
    type: "password_reset",
    expiresAt,
  });

  const emailResult = await sendPasswordResetEmail({
    to: user.email,
    token,
    firstName: user.firstName,
  });

  if (!emailResult.success) {
    throw new Error(emailResult.error ?? "Unable to send password reset email.");
  }

  return { success: true, message: "Password reset link sent to your email." };
}

/**
 * Reset password using token
 */
export async function resetPassword(token: string, newPassword: string) {
  const tokenRecord = await db.query.authTokens.findFirst({
    where: and(
      eq(authTokens.token, token),
      eq(authTokens.type, "password_reset"),
      isNull(authTokens.usedAt),
      gt(authTokens.expiresAt, new Date()),
    ),
  });

  if (!tokenRecord) {
    throw new Error("Password reset link is invalid or has expired.");
  }

  const passwordHash = await hashPassword(newPassword);

  // Update user password
  await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, tokenRecord.userId));

  // Mark token as used
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(eq(authTokens.id, tokenRecord.id));

  return { success: true, message: "Password has been successfully reset. You can now sign in." };
}

/**
 * Get user by ID with profile
 */
export async function getUserById(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
  };
}
