"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  FileText,
  Receipt,
  BarChart3,
  TrendingUp,
  ArrowRight,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardSkeleton } from "@/components/shared/LoadingStates";
import { DashboardStats } from "@/types";
import { formatDistanceToNow } from "date-fns";

async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await fetch("/api/dashboard");
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardStats,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load dashboard</p>
      </div>
    );
  }

  const statCards = [
    {
      title: "Catalogues",
      value: stats.totalCatalogues,
      description: "Price catalogues created",
      icon: FileText,
      href: "/catalogues",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Receipts",
      value: stats.totalReceipts,
      description: "Receipts created",
      icon: Receipt,
      href: "/receipts",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Reports",
      value: stats.totalReports,
      description: "Comparison reports",
      icon: BarChart3,
      href: "/reports",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Savings Detected",
      value: `₺${stats.totalSavingsDetected.toFixed(2)}`,
      description: "Total overcharges found",
      icon: TrendingUp,
      href: "/reports",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "catalogue":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "receipt":
        return <Receipt className="h-4 w-4 text-emerald-500" />;
      case "report":
        return <BarChart3 className="h-4 w-4 text-purple-500" />;
      default:
        return null;
    }
  };

  const getActivityHref = (type: string, id: string) => {
    switch (type) {
      case "catalogue":
        return `/catalogues/${id}`;
      case "receipt":
        return `/receipts/${id}`;
      case "report":
        return `/reports/${id}`;
      default:
        return "#";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your price verification activities
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/receipts/create">
              <Plus className="mr-2 h-4 w-4" />
              New Receipt
            </Link>
          </Button>
          <Button asChild>
            <Link href="/catalogues/create">
              <Plus className="mr-2 h-4 w-4" />
              New Catalogue
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick actions & Recent activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks to get you started</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href="/catalogues/create"
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <FileText className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium">Create Price Catalogue</p>
                  <p className="text-sm text-muted-foreground">
                    Add your supplier&apos;s price list
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </Link>

            <Link
              href="/receipts/create"
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Receipt className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="font-medium">Create Receipt</p>
                  <p className="text-sm text-muted-foreground">
                    Add items to verify prices
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </Link>

            <Link
              href="/reports"
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="font-medium">View Reports</p>
                  <p className="text-sm text-muted-foreground">
                    See all comparison reports
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest actions</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No recent activity</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create a catalogue or receipt to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.recentActivity.map((activity) => (
                  <Link
                    key={`${activity.type}-${activity.id}`}
                    href={getActivityHref(activity.type, activity.id)}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-muted">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{activity.title}</p>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {activity.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {activity.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(activity.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
