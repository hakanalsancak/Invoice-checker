import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCatalogueItemSchema, updateCatalogueItemSchema } from "@/lib/validators/catalogue";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify ownership
    const catalogue = await db.catalogue.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!catalogue) {
      return NextResponse.json(
        { success: false, error: "Catalogue not found" },
        { status: 404 }
      );
    }

    const items = await db.catalogueItem.findMany({
      where: { catalogueId: id },
      orderBy: { productName: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error("Get catalogue items error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch items" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify ownership
    const catalogue = await db.catalogue.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!catalogue) {
      return NextResponse.json(
        { success: false, error: "Catalogue not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validated = createCatalogueItemSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const item = await db.catalogueItem.create({
      data: {
        catalogueId: id,
        productName: validated.data.productName,
        price: validated.data.price,
        category: validated.data.description || null, // Store description in category field
      },
    });

    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error("Create catalogue item error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create item" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { itemId, ...updateData } = body;

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: "Item ID required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const item = await db.catalogueItem.findFirst({
      where: {
        id: itemId,
        catalogue: {
          id,
          userId: session.user.id,
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      );
    }

    const validated = updateCatalogueItemSchema.safeParse(updateData);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const updatedItem = await db.catalogueItem.update({
      where: { id: itemId },
      data: validated.data,
    });

    return NextResponse.json({
      success: true,
      data: updatedItem,
    });
  } catch (error) {
    console.error("Update catalogue item error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: "Item ID required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const item = await db.catalogueItem.findFirst({
      where: {
        id: itemId,
        catalogue: {
          id,
          userId: session.user.id,
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      );
    }

    await db.catalogueItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Delete catalogue item error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete item" },
      { status: 500 }
    );
  }
}
