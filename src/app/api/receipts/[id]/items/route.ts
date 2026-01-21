import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateItemSchema = z.object({
  itemId: z.string().min(1),
  productName: z.string().min(1).optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().nullable().optional(),
  unitPrice: z.number().min(0).optional(),
  totalPrice: z.number().min(0).optional(),
});

const createItemSchema = z.object({
  catalogueItemId: z.string().min(1, "Catalogue item is required"),
  productName: z.string().min(1, "Product name is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unit: z.string().nullable().optional(),
  unitPrice: z.number().min(0, "Price must be non-negative"),
  totalPrice: z.number().min(0, "Total must be non-negative"),
});

// Add a new item to receipt
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: receiptId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify ownership and get linked catalogues
    const receipt = await db.receipt.findFirst({
      where: { id: receiptId, userId: session.user.id },
      include: { 
        items: { orderBy: { lineNumber: "desc" }, take: 1 },
        catalogues: { select: { catalogueId: true } },
      },
    });

    if (!receipt) {
      return NextResponse.json(
        { success: false, error: "Receipt not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validated = createItemSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.issues[0]?.message },
        { status: 400 }
      );
    }

    // Verify the catalogue item belongs to a linked catalogue
    const linkedCatalogueIds = receipt.catalogues.map(c => c.catalogueId);
    const catalogueItem = await db.catalogueItem.findFirst({
      where: {
        id: validated.data.catalogueItemId,
        catalogueId: { in: linkedCatalogueIds },
      },
    });

    if (!catalogueItem) {
      return NextResponse.json(
        { success: false, error: "Product must be from a linked catalogue" },
        { status: 400 }
      );
    }

    // Get next line number
    const nextLineNumber = (receipt.items[0]?.lineNumber || 0) + 1;

    const item = await db.receiptItem.create({
      data: {
        receiptId,
        catalogueItemId: validated.data.catalogueItemId,
        productName: validated.data.productName,
        quantity: validated.data.quantity,
        unit: validated.data.unit || null,
        unitPrice: validated.data.unitPrice,
        totalPrice: validated.data.totalPrice,
        lineNumber: nextLineNumber,
        rawText: `${validated.data.quantity} ${validated.data.unit || ''} ${validated.data.productName} ${validated.data.unitPrice} ${validated.data.totalPrice}`.trim(),
      },
    });

    // Update receipt total
    const newTotal = await db.receiptItem.aggregate({
      where: { receiptId },
      _sum: { totalPrice: true },
    });

    await db.receipt.update({
      where: { id: receiptId },
      data: { totalAmount: newTotal._sum.totalPrice || 0 },
    });

    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error("Create receipt item error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create item" },
      { status: 500 }
    );
  }
}

// Update an existing item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: receiptId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify ownership
    const receipt = await db.receipt.findFirst({
      where: { id: receiptId, userId: session.user.id },
    });

    if (!receipt) {
      return NextResponse.json(
        { success: false, error: "Receipt not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validated = updateItemSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.issues[0]?.message },
        { status: 400 }
      );
    }

    // Verify item belongs to this receipt
    const existingItem = await db.receiptItem.findFirst({
      where: { id: validated.data.itemId, receiptId },
    });

    if (!existingItem) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      );
    }

    const item = await db.receiptItem.update({
      where: { id: validated.data.itemId },
      data: {
        productName: validated.data.productName,
        quantity: validated.data.quantity,
        unit: validated.data.unit,
        unitPrice: validated.data.unitPrice,
        totalPrice: validated.data.totalPrice,
      },
    });

    // Update receipt total
    const newTotal = await db.receiptItem.aggregate({
      where: { receiptId },
      _sum: { totalPrice: true },
    });

    await db.receipt.update({
      where: { id: receiptId },
      data: { totalAmount: newTotal._sum.totalPrice || 0 },
    });

    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error("Update receipt item error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update item" },
      { status: 500 }
    );
  }
}

// Delete an item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: receiptId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const itemId = url.searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: "Item ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const receipt = await db.receipt.findFirst({
      where: { id: receiptId, userId: session.user.id },
    });

    if (!receipt) {
      return NextResponse.json(
        { success: false, error: "Receipt not found" },
        { status: 404 }
      );
    }

    // Verify item belongs to this receipt
    const item = await db.receiptItem.findFirst({
      where: { id: itemId, receiptId },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      );
    }

    await db.receiptItem.delete({
      where: { id: itemId },
    });

    // Update receipt total
    const newTotal = await db.receiptItem.aggregate({
      where: { receiptId },
      _sum: { totalPrice: true },
    });

    await db.receipt.update({
      where: { id: receiptId },
      data: { totalAmount: newTotal._sum.totalPrice || 0 },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Delete receipt item error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete item" },
      { status: 500 }
    );
  }
}
