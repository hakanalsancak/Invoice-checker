import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import {
  ArrowRight,
  Upload,
  Brain,
  BarChart3,
  Shield,
  Globe,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth();

  // If logged in, redirect to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

        {/* Navigation */}
        <nav className="relative z-10 flex items-center justify-between px-6 py-4 lg:px-12">
          <div className="flex items-center gap-3">
            <img src="/Main logo.png" alt="Check Up Invoice" className="h-12 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild className="text-white hover:text-white hover:bg-white/10">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-24 text-center lg:py-32">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-sm text-white/80 mb-8">
            <Zap className="h-4 w-4 text-amber-400" />
            <span>AI-Powered Price Verification</span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Never Overpay on
            <span className="block text-primary mt-2">Supplier Invoices</span>
          </h1>

          <p className="mt-6 text-lg text-white/70 max-w-2xl mx-auto">
            Automatically verify prices on receipts and invoices against your
            agreed catalogues. Supports Turkish and other languages. Detect
            overcharges instantly.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link href="/register">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10"
            >
              <Link href="/login">Sign In</Link>
            </Button>
          </div>

          <p className="mt-6 text-sm text-white/50">
            No credit card required • Free for small businesses
          </p>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-slate-950 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 text-white/70 max-w-2xl mx-auto">
              Three simple steps to verify your supplier invoices
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="relative p-8 rounded-2xl bg-white/5 border border-white/10">
              <div className="p-3 rounded-xl bg-blue-500/20 w-fit mb-6">
                <Upload className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                1. Upload Catalogue
              </h3>
              <p className="text-white/60">
                Upload your agreed price catalogue. Our AI extracts all products
                and prices, even from Turkish documents.
              </p>
            </div>

            <div className="relative p-8 rounded-2xl bg-white/5 border border-white/10">
              <div className="p-3 rounded-xl bg-emerald-500/20 w-fit mb-6">
                <Brain className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                2. Scan Receipts
              </h3>
              <p className="text-white/60">
                Upload invoices or receipts. AI reads every line item and matches
                products intelligently, even with name variations.
              </p>
            </div>

            <div className="relative p-8 rounded-2xl bg-white/5 border border-white/10">
              <div className="p-3 rounded-xl bg-amber-500/20 w-fit mb-6">
                <BarChart3 className="h-6 w-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                3. Get Reports
              </h3>
              <p className="text-white/60">
                Instantly see overcharges and discrepancies. Export reports to
                dispute with suppliers and recover costs.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="bg-slate-900 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid gap-16 lg:grid-cols-2 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white sm:text-4xl">
                Built for Real Businesses
              </h2>
              <p className="mt-4 text-white/70">
                Designed specifically for bulk buyers who deal with thousands of
                products and complex pricing agreements.
              </p>

              <div className="mt-10 space-y-6">
                <div className="flex gap-4">
                  <div className="p-2 rounded-lg bg-primary/20 h-fit">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">
                      Multilingual Support
                    </h4>
                    <p className="text-white/60 text-sm">
                      Full Turkish language support. Product names stay in their
                      original language throughout the process.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="p-2 rounded-lg bg-emerald-500/20 h-fit">
                    <Brain className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Smart Matching</h4>
                    <p className="text-white/60 text-sm">
                      AI handles abbreviations, spelling variations, and different
                      formats. No exact matches required.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="p-2 rounded-lg bg-amber-500/20 h-fit">
                    <Shield className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">
                      Private & Secure
                    </h4>
                    <p className="text-white/60 text-sm">
                      Your data is encrypted and isolated. Only you can access
                      your catalogues and reports.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-video rounded-2xl bg-gradient-to-br from-primary/20 to-emerald-500/20 border border-white/10 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="text-6xl font-bold text-white mb-2">
                    ₺1.2M+
                  </div>
                  <p className="text-white/60">
                    Overcharges detected for our users
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-slate-950 py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Start Saving Today
          </h2>
          <p className="mt-4 text-white/70">
            Join businesses that have recovered thousands in overcharges.
            Setup takes less than 5 minutes.
          </p>
          <div className="mt-8">
            <Button size="lg" asChild>
              <Link href="/register">
                Create Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/Main logo.png" alt="Check Up Invoice" className="h-10 w-auto object-contain" />
          </div>
          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} Check Up Invoice. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
