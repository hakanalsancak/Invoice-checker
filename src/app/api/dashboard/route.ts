import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DashboardStats, ActivityItem } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get counts
    const [catalogueCount, invoiceCount, reportCount] = await Promise.all([
      db.catalogue.count({ where: { userId } }),
      db.invoice.count({ where: { userId } }),
      db.comparisonReport.count({ where: { invoice: { userId } } }),
    ]);

    // Get total overcharges detected (savings)
    const reports = await db.comparisonReport.findMany({
      where: { invoice: { userId } },
      select: { totalOvercharge: true },
    });

    const totalSavingsDetected = reports.reduce(
      (sum, report) => sum + Number(report.totalOvercharge),
      0
    );

    // Get recent activity
    const [recentCatalogues, recentInvoices, recentReports] = await Promise.all([
      db.catalogue.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          name: true,
          createdAt: true,
          status: true,
          _count: { select: { items: true } },
        },
      }),
      db.invoice.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          supplierName: true,
          originalFileName: true,
          createdAt: true,
          status: true,
        },
      }),
      db.comparisonReport.findMany({
        where: { invoice: { userId } },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          createdAt: true,
          totalOvercharge: true,
          invoice: {
            select: { supplierName: true },
          },
        },
      }),
    ]);

    // Combine and sort recent activity
    const activities: ActivityItem[] = [
      ...recentCatalogues.map(c => ({
        id: c.id,
        type: "catalogue" as const,
        title: c.name,
        description: `${c._count.items} items • ${c.status}`,
        createdAt: c.createdAt,
      })),
      ...recentInvoices.map(r => ({
        id: r.id,
        type: "invoice" as const,
        title: r.supplierName || r.originalFileName,
        description: r.status,
        createdAt: r.createdAt,
      })),
      ...recentReports.map(r => ({
        id: r.id,
        type: "report" as const,
        title: r.invoice.supplierName || "Comparison Report",
        description: `₺${Number(r.totalOvercharge).toFixed(2)} overcharge detected`,
        createdAt: r.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5);

    const stats: DashboardStats = {
      totalCatalogues: catalogueCount,
      totalInvoices: invoiceCount,
      totalReports: reportCount,
      totalSavingsDetected,
      recentActivity: activities,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch dashboard data: ${errorMessage}` },
      { status: 500 }
    );
  }
}
