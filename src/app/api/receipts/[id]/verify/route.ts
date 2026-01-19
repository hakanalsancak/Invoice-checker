import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verifyReceiptSchema } from "@/lib/validators/receipt";
import { createComparisonReport } from "@/services/comparison/priceComparator";

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

    const body = await request.json();
    const validated = verifyReceiptSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const { catalogueId } = validated.data;

    // Create comparison report
    const reportId = await createComparisonReport(
      receiptId,
      catalogueId,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      data: { reportId },
    });
  } catch (error) {
    console.error("Verify receipt error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to verify receipt" 
      },
      { status: 500 }
    );
  }
}
