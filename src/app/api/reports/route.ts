import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserReports } from "@/services/reports/reportGenerator";

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const reports = await getUserReports(session.user.id);

    return NextResponse.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    console.error("Get reports error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
