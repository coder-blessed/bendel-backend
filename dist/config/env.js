import dotenv from "dotenv";
dotenv.config();
const isProduction = process.env.NODE_ENV === "production";
const jwtSecret = process.env.JWT_SECRET?.trim();
if (isProduction && !jwtSecret) {
    throw new Error("JWT_SECRET must be set in production.");
}
export const env = {
    port: Number(process.env.PORT ?? 4000),
    nodeEnv: process.env.NODE_ENV ?? "development",
    frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
    jwtSecret: jwtSecret ?? "development-only-bendel-secret",
    databaseUrl: process.env.DATABASE_URL ?? "",
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
        apiKey: process.env.CLOUDINARY_API_KEY ?? "",
        apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
        folder: process.env.CLOUDINARY_FOLDER ?? "bendel-insurance",
    },
    squad: {
        baseUrl: process.env.SQUAD_API_BASE_URL ?? "",
        apiKey: process.env.SQUAD_API_KEY ?? "",
        secretKey: process.env.SQUAD_SECRET_KEY ?? "",
        webhookSecret: process.env.SQUAD_WEBHOOK_SECRET ?? "",
        environment: process.env.SQUAD_ENVIRONMENT ?? "sandbox",
    },
    resend: {
        apiKey: process.env.RESEND_API_KEY ?? "",
        fromEmail: process.env.RESEND_FROM_EMAIL ?? "admin@bendelinsurancefootball.com",
        fromName: process.env.RESEND_FROM_NAME ?? "Bendel Insurance FC",
    },
};
