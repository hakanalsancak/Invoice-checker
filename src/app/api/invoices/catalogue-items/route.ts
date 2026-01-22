import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const ids = searchParams.get("ids");
    
    if (!ids) {
      return NextResponse.json(
        { success: false, error: "Catalogue IDs required" },
        { status: 400 }
      );
    }

    const catalogueIds = ids.split(",").filter(Boolean);

    // Verify user owns all catalogues
    const catalogues = await db.catalogue.findMany({
      where: {
        id: { in: catalogueIds },
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        currency: true,
      },
    });

    if (catalogues.length !== catalogueIds.length) {
      return NextResponse.json(
        { success: false, error: "One or more catalogues not found" },
        { status: 404 }
      );
    }

    // Fetch all items from these catalogues
    const items = await db.catalogueItem.findMany({
      where: {
        catalogueId: { in: catalogueIds },
        isActive: true,
      },
      orderBy: { productName: "asc" },
      include: {
        catalogue: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
      },
    });

    // Transform to flat structure
    const transformedItems = items.map(item => ({
      id: item.id,
      productName: item.productName,
      price: Number(item.price),
      category: item.category,
      catalogueId: item.catalogueId,
      catalogueName: item.catalogue.name,
      catalogueCurrency: item.catalogue.currency,
    }));

    return NextResponse.json({
      success: true,
      data: transformedItems,
    });
  } catch (error) {
    console.error("Get catalogue items error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch catalogue items" },
      { status: 500 }
    );
  }
}
