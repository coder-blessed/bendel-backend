import { cloudinary } from "../config/cloudinary.js";
import { env } from "../config/env.js";

export async function uploadToCloudinary(file: string, folder?: string) {
  const result = await cloudinary.uploader.upload(file, {
    folder: folder ?? env.cloudinary.folder,
    resource_type: "auto",
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    format: result.format,
    width: result.width,
    height: result.height,
  };
}

export async function deleteFromCloudinary(publicId: string) {
  await cloudinary.uploader.destroy(publicId);
}
