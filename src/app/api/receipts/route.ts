import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createReceiptSchema = z.object({
  supplierName: z.string().min(1, "Supplier name is required"),
  receiptDate: z.string().optional(),
  currency: z.string().default("USD"),
  catalogueIds: z.array(z.string()).min(1, "At least one catalogue is required"),
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

    const receipts = await db.receipt.findMany({
      where: { userId: session.user.id },
      include: {
        _count: {
          select: { items: true },
        },
        catalogues: {
          include: {
            catalogue: {
              select: { id: true, name: true, currency: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: receipts,
    });
  } catch (error) {
    console.error("Get receipts error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch receipts" },
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
    
    const validated = createReceiptSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    // Verify user owns all selected catalogues
    const catalogues = await db.catalogue.findMany({
      where: {
        id: { in: validated.data.catalogueIds },
        userId: session.user.id,
      },
    });

    if (catalogues.length !== validated.data.catalogueIds.length) {
      return NextResponse.json(
        { success: false, error: "One or more catalogues not found" },
        { status: 400 }
      );
    }

    // Create receipt with catalogue links
    const receipt = await db.receipt.create({
      data: {
        userId: session.user.id,
        supplierName: validated.data.supplierName,
        originalFileName: "Manual Entry",
        receiptDate: validated.data.receiptDate ? new Date(validated.data.receiptDate) : null,
        language: "en",
        currency: validated.data.currency,
        status: "COMPLETED",
        catalogues: {
          create: validated.data.catalogueIds.map(catalogueId => ({
            catalogueId,
          })),
        },
      },
      include: {
        _count: { select: { items: true } },
        catalogues: {
          include: {
            catalogue: {
              select: { id: true, name: true, currency: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: receipt,
    });
  } catch (error) {
    console.error("Create receipt error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create receipt" },
      { status: 500 }
    );
  }
}
