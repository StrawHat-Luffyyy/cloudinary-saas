import { NextResponse, NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

//Config
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure_distribution: "mydomain.com",
  upload_prefix: "https://api-eu.cloudinary.com",
});

interface CloudinaryUploadResult {
  public_id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
  bytes: number;
  duration?: number;
}

export async function POST(request: NextRequest) {
  try {
    // to check user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME === undefined ||
      process.env.CLOUDINARY_API_KEY === undefined ||
      process.env.CLOUDINARY_API_SECRET === undefined
    ) {
      return NextResponse.json(
        { error: "Cloudinary not configured" },
        { status: 500 }
      );
    }
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get('title') as string 
    const description = formData.get('description') as string
    const originalSize = formData.get('originalSize') as string
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 400 });
    }
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise<CloudinaryUploadResult>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { 
            resource_type:'video',
            folder: "video-uploads",
            transformation : [
              { quality: "auto" },
              { fetch_format: "mp4" }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result as CloudinaryUploadResult);
          }
        );
        uploadStream.end(buffer);
      }
    );
    const video = await prisma.video.create({
      data : {
        title,
        description,
        publicId : result.public_id,
        originalSize : originalSize,
        compressedSize : String(result.bytes),
        duration : result.duration || 0
      }
    })

    return NextResponse.json(video)
  } catch (error) {
    console.error("Upload video failed", error);
    return NextResponse.json({ error: "Upload video failed" }, { status: 500 });
  } finally {
    await prisma.$disconnect()
  }
}
