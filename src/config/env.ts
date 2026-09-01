import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  jwtSecret: process.env.JWT_SECRET ?? "bendel-backend-secret-key",
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
};
