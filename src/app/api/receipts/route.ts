import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createReceiptSchema } from "@/lib/validators/receipt";
import { processFile } from "@/services/file";
import { extractReceipt } from "@/services/ai";

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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const supplierName = formData.get("supplierName") as string | null;
    const receiptDate = formData.get("receiptDate") as string | null;
    const language = formData.get("language") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const validated = createReceiptSchema.safeParse({
      supplierName,
      receiptDate,
      language: language || "tr",
    });

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    // Create receipt record with processing status
    const receipt = await db.receipt.create({
      data: {
        userId: session.user.id,
        supplierName: validated.data.supplierName || null,
        originalFileName: file.name,
        receiptDate: validated.data.receiptDate ? new Date(validated.data.receiptDate) : null,
        language: validated.data.language,
        status: "PROCESSING",
      },
    });

    // Process file
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const processedFile = await processFile(buffer, file.name);

      if (!processedFile.success) {
        await db.receipt.update({
          where: { id: receipt.id },
          data: { status: "FAILED" },
        });
        return NextResponse.json(
          { success: false, error: processedFile.error || "Failed to process file" },
          { status: 400 }
        );
      }

      // Extract items using AI
      const extraction = await extractReceipt(processedFile);

      // Save extracted items
      if (extraction.items.length > 0) {
        await db.receiptItem.createMany({
          data: extraction.items.map(item => ({
            receiptId: receipt.id,
            productName: item.productName,
            rawText: item.rawText,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            lineNumber: item.lineNumber,
          })),
        });
      }

      // Update receipt status
      await db.receipt.update({
        where: { id: receipt.id },
        data: {
          status: "COMPLETED",
          supplierName: extraction.supplier || validated.data.supplierName || null,
          receiptDate: extraction.date ? new Date(extraction.date) : (validated.data.receiptDate ? new Date(validated.data.receiptDate) : null),
          totalAmount: extraction.totalAmount,
          language: extraction.detectedLanguage,
          currency: extraction.detectedCurrency || "USD",
        },
      });

      // Fetch updated receipt with items
      const updatedReceipt = await db.receipt.findUnique({
        where: { id: receipt.id },
        include: {
          items: {
            orderBy: { lineNumber: "asc" },
          },
          _count: { select: { items: true } },
        },
      });

      return NextResponse.json({
        success: true,
        data: updatedReceipt,
      });
    } catch (processingError) {
      console.error("Processing error:", processingError);
      await db.receipt.update({
        where: { id: receipt.id },
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
    console.error("Create receipt error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create receipt" },
      { status: 500 }
    );
  }
}
