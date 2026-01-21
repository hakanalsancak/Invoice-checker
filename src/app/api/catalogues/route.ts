import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createCatalogueSchema = z.object({
  name: z.string().min(1, "Catalogue name is required"),
  currency: z.string().default("GBP"),
});

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const catalogues = await db.catalogue.findMany({
      where: { userId: session.user.id },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: catalogues,
    });
  } catch (error) {
    console.error("Get catalogues error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch catalogues" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    const validated = createCatalogueSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    // Create catalogue record
    const catalogue = await db.catalogue.create({
      data: {
        userId: session.user.id,
        name: validated.data.name,
        originalFileName: "Manual Entry",
        language: "en",
        currency: validated.data.currency,
        status: "COMPLETED", // Already complete since it's manual entry
      },
      include: {
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: catalogue,
    });
  } catch (error) {
    console.error("Create catalogue error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create catalogue" },
      { status: 500 }
    );
  }
}
