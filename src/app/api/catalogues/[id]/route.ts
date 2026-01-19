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

    const catalogue = await db.catalogue.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        items: {
          orderBy: { productName: "asc" },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    if (!catalogue) {
      return NextResponse.json(
        { success: false, error: "Catalogue not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: catalogue,
    });
  } catch (error) {
    console.error("Get catalogue error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch catalogue" },
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

    // Verify ownership
    const existing = await db.catalogue.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Catalogue not found" },
        { status: 404 }
      );
    }

    const catalogue = await db.catalogue.update({
      where: { id },
      data: {
        name: body.name,
        language: body.language,
      },
    });

    return NextResponse.json({
      success: true,
      data: catalogue,
    });
  } catch (error) {
    console.error("Update catalogue error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update catalogue" },
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
    const existing = await db.catalogue.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Catalogue not found" },
        { status: 404 }
      );
    }

    await db.catalogue.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Delete catalogue error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete catalogue" },
      { status: 500 }
    );
  }
}
