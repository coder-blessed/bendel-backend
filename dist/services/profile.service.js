import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { profiles, users } from "../db/schema.js";
export async function getUserProfile(userId) {
    const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, userId),
    });
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });
    return {
        id: profile?.id ?? user?.id,
        userId,
        email: user?.email ?? "",
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        phone: user?.phone ?? null,
        displayName: profile?.displayName ?? null,
        favoritePlayer: profile?.favoritePlayer ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        city: profile?.city ?? null,
        address: profile?.address ?? null,
    };
}
export async function upsertUserProfile(userId, data) {
    const existingUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });
    if (existingUser) {
        await db
            .update(users)
            .set({
            firstName: data.firstName ?? existingUser.firstName,
            lastName: data.lastName ?? existingUser.lastName,
            phone: data.phone ?? existingUser.phone,
            updatedAt: new Date(),
        })
            .where(eq(users.id, userId));
    }
    const existingProfile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, userId),
    });
    if (existingProfile) {
        const [profile] = await db
            .update(profiles)
            .set({
            displayName: data.displayName ?? existingProfile.displayName,
            favoritePlayer: data.favoritePlayer ?? existingProfile.favoritePlayer,
            avatarUrl: data.avatarUrl ?? existingProfile.avatarUrl,
            city: data.city ?? existingProfile.city,
            address: data.address ?? existingProfile.address,
            updatedAt: new Date(),
        })
            .where(eq(profiles.userId, userId))
            .returning();
        return profile;
    }
    const [profile] = await db
        .insert(profiles)
        .values({
        userId,
        displayName: data.displayName ?? null,
        favoritePlayer: data.favoritePlayer ?? null,
        avatarUrl: data.avatarUrl ?? null,
        city: data.city ?? null,
        address: data.address ?? null,
    })
        .returning();
    return profile;
}
