import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { isFileSupported, getSupportedExtensions } from "@/services/file";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    // Check file type
    if (!isFileSupported(file.name)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Unsupported file type. Supported formats: ${getSupportedExtensions().join(", ")}` 
        },
        { status: 400 }
      );
    }

    // Generate unique filename
    const extension = file.name.split(".").pop() || "";
    const uniqueFilename = `${session.user.id}/${uuidv4()}.${extension}`;

    // Upload to Vercel Blob
    const blob = await put(uniqueFilename, file, {
      access: "public",
    });

    return NextResponse.json({
      success: true,
      data: {
        url: blob.url,
        filename: file.name,
        size: file.size,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
