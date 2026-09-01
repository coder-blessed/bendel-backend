import type { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { getUserProfile, upsertUserProfile } from "../services/profile.service.js";
import { errorResponse, successResponse } from "../utils/response.js";

const profileSchema = z.object({
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  displayName: z.string().optional().nullable(),
  favoritePlayer: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export async function getProfileController(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json(errorResponse("Authentication required."));
    }

    const profile = await getUserProfile(userId);
    return res.status(200).json(successResponse(profile, "Profile loaded."));
  } catch (error) {
    return res.status(500).json(errorResponse("Unable to fetch profile.", error));
  }
}

export async function saveProfileController(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json(errorResponse("Authentication required."));
    }

    const payload = profileSchema.parse(req.body);
    const profile = await upsertUserProfile(userId, payload);

    return res.status(200).json(successResponse(profile, "Profile saved successfully."));
  } catch (error) {
    return res.status(400).json(errorResponse("Unable to save profile.", error));
  }
}
