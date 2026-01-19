import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCatalogueSchema } from "@/lib/validators/catalogue";
import { processFile } from "@/services/file";
import { extractCatalogue } from "@/services/ai";

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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;
    const language = formData.get("language") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const validated = createCatalogueSchema.safeParse({
      name: name || file.name,
      language: language || "tr",
    });

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    // Create catalogue record with processing status
    const catalogue = await db.catalogue.create({
      data: {
        userId: session.user.id,
        name: validated.data.name,
        originalFileName: file.name,
        language: validated.data.language,
        status: "PROCESSING",
      },
    });

    // Process file asynchronously
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const processedFile = await processFile(buffer, file.name);

      if (!processedFile.success) {
        await db.catalogue.update({
          where: { id: catalogue.id },
          data: { status: "FAILED" },
        });
        return NextResponse.json(
          { success: false, error: processedFile.error || "Failed to process file" },
          { status: 400 }
        );
      }

      // Extract items using AI
      const extraction = await extractCatalogue(processedFile);

      // Save extracted items
      if (extraction.items.length > 0) {
        await db.catalogueItem.createMany({
          data: extraction.items.map(item => ({
            catalogueId: catalogue.id,
            productName: item.productName,
            sku: item.sku,
            unit: item.unit,
            price: item.price,
            category: item.category,
          })),
        });
      }

      // Update catalogue status
      await db.catalogue.update({
        where: { id: catalogue.id },
        data: {
          status: "COMPLETED",
          language: extraction.detectedLanguage,
        },
      });

      // Fetch updated catalogue with items
      const updatedCatalogue = await db.catalogue.findUnique({
        where: { id: catalogue.id },
        include: {
          items: true,
          _count: { select: { items: true } },
        },
      });

      return NextResponse.json({
        success: true,
        data: updatedCatalogue,
      });
    } catch (processingError) {
      console.error("Processing error:", processingError);
      await db.catalogue.update({
        where: { id: catalogue.id },
        data: { status: "FAILED" },
      });
      return NextResponse.json(
        { 
          success: false, 
          error: processingError instanceof Error ? processingError.message : "Processing failed" 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Create catalogue error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create catalogue" },
      { status: 500 }
    );
  }
}
