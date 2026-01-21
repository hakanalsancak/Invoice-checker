import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

    const receipt = await db.receipt.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        items: {
          orderBy: { lineNumber: "asc" },
          include: {
            catalogueItem: {
              select: {
                id: true,
                productName: true,
                price: true,
              },
            },
          },
        },
        catalogues: {
          include: {
            catalogue: {
              select: {
                id: true,
                name: true,
                currency: true,
              },
            },
          },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    if (!receipt) {
      return NextResponse.json(
        { success: false, error: "Receipt not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: receipt,
    });
  } catch (error) {
    console.error("Get receipt error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch receipt" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const { currency } = body;

    // Validate currency
    const validCurrencies = ["USD", "GBP", "EUR", "TRY"];
    if (currency && !validCurrencies.includes(currency)) {
      return NextResponse.json(
        { success: false, error: "Invalid currency" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.receipt.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Receipt not found" },
        { status: 404 }
      );
    }

    const updated = await db.receipt.update({
      where: { id },
      data: { currency },
      include: {
        items: {
          orderBy: { lineNumber: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Update receipt error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update receipt" },
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

    // Verify ownership
    const existing = await db.receipt.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Receipt not found" },
        { status: 404 }
      );
    }

    await db.receipt.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Delete receipt error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete receipt" },
      { status: 500 }
    );
  }
}
