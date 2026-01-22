import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  BarChart3,
  Shield,
  Globe,
  CheckCircle,
  TrendingUp,
  Clock,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px] animate-pulse [animation-delay:1s]" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-emerald-600/15 rounded-full blur-[120px] animate-pulse [animation-delay:2s]" />
      </div>

      {/* Grid Pattern */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-5 lg:px-16 animate-fade-in">
        <div className="flex items-center gap-3">
          <img src="/logo-light.svg" alt="Invoice Check" className="h-11 w-auto object-contain" />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild className="text-white/80 hover:text-white hover:bg-white/10">
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild className="bg-white text-black hover:bg-white/90 font-medium">
            <Link href="/register">Get Started Free</Link>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-8 pb-24 lg:pt-12 lg:pb-32">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.07] border border-white/[0.1] text-sm text-white/70 mb-8 animate-fade-in-up">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span>Trusted by businesses worldwide</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] animate-fade-in-up [animation-delay:100ms]">
            Stop Overpaying
            <span className="block mt-2 pb-2 bg-gradient-to-r from-blue-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
              On Every Invoice
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-8 text-lg sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed animate-fade-in-up [animation-delay:200ms]">
            Compare supplier invoices against your agreed price catalogues instantly. 
            Detect overcharges, protect your margins, and recover costs with detailed reports.
          </p>

          {/* CTA Buttons */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up [animation-delay:300ms]">
            <Button size="lg" asChild className="w-full sm:w-auto bg-white text-black hover:bg-white/90 font-semibold text-base px-8 h-13 group">
              <Link href="/register">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="w-full sm:w-auto border-white/30 bg-white/10 text-white hover:bg-white/20 font-medium text-base px-8 h-13"
            >
              <Link href="/login">Sign In to Dashboard</Link>
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-white/50 animate-fade-in-up [animation-delay:400ms]">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span>Setup in 5 minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span>Multi-currency support</span>
            </div>
          </div>
        </div>

        {/* Floating Stats */}
        <div className="mt-24 grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up [animation-delay:500ms]">
          {[
            { value: "99.9%", label: "Accuracy Rate", icon: CheckCircle },
            { value: "< 1min", label: "Per Invoice Check", icon: Clock },
            { value: "20+", label: "Currencies Supported", icon: DollarSign },
            { value: "24/7", label: "Access Anytime", icon: TrendingUp },
          ].map((stat, i) => (
            <div 
              key={stat.label}
              className="group relative p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all duration-500"
              style={{ animationDelay: `${600 + i * 100}ms` }}
            >
              <stat.icon className="h-5 w-5 text-white/40 mb-3 group-hover:text-blue-400 transition-colors" />
              <div className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</div>
              <div className="text-sm text-white/50 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative z-10 py-32 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
              Three Steps to
              <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent"> Savings</span>
            </h2>
            <p className="mt-6 text-lg text-white/50 max-w-xl mx-auto">
              Simple, fast, and effective. Start protecting your bottom line today.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {[
              {
                step: "01",
                icon: FileText,
                title: "Create Price Catalogues",
                description: "Add your agreed supplier price lists. Organize products with their contracted prices across multiple catalogues.",
                color: "blue",
              },
              {
                step: "02",
                icon: BarChart3,
                title: "Enter Invoice Items",
                description: "Create invoices and select products from your catalogues. Enter the prices you were charged.",
                color: "violet",
              },
              {
                step: "03",
                icon: TrendingUp,
                title: "Get Instant Reports",
                description: "See price discrepancies instantly. Export detailed reports to dispute overcharges with suppliers.",
                color: "emerald",
              },
            ].map((item, i) => (
              <div
                key={item.step}
                className="group relative p-8 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05] hover:border-white/[0.15] transition-all duration-500 hover:-translate-y-2"
              >
                {/* Step Number */}
                <div className="absolute -top-4 -left-4 w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-white/60">
                  {item.step}
                </div>

                {/* Icon */}
                <div className={`p-4 rounded-2xl bg-${item.color}-500/10 border border-${item.color}-500/20 w-fit mb-6 group-hover:scale-110 transition-transform duration-500`}>
                  <item.icon className={`h-7 w-7 text-${item.color}-400`} />
                </div>

                <h3 className="text-xl font-semibold text-white mb-4">
                  {item.title}
                </h3>
                <p className="text-white/50 leading-relaxed">
                  {item.description}
                </p>

                {/* Hover Glow */}
                <div className={`absolute inset-0 rounded-3xl bg-${item.color}-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-xl`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
                Built for Modern
                <span className="block bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                  Business Operations
                </span>
              </h2>
              <p className="mt-6 text-lg text-white/50 leading-relaxed">
                Whether you manage hundreds or thousands of products, our platform 
                scales with your business needs.
              </p>

              <div className="mt-12 space-y-8">
                {[
                  {
                    icon: Globe,
                    title: "Multi-Currency Support",
                    description: "Handle invoices in any currency with automatic conversion rates for accurate comparisons.",
                    color: "blue",
                  },
                  {
                    icon: Shield,
                    title: "Enterprise-Grade Security",
                    description: "Your data is encrypted and isolated. Only you have access to your business information.",
                    color: "violet",
                  },
                  {
                    icon: BarChart3,
                    title: "Detailed Analytics",
                    description: "Track overcharges over time. Identify problematic suppliers and recurring discrepancies.",
                    color: "emerald",
                  },
                ].map((feature, i) => (
                  <div key={feature.title} className="group flex gap-5">
                    <div className={`p-3 rounded-xl bg-${feature.color}-500/10 border border-${feature.color}-500/20 h-fit group-hover:scale-110 transition-transform duration-300`}>
                      <feature.icon className={`h-6 w-6 text-${feature.color}-400`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-lg">{feature.title}</h4>
                      <p className="text-white/50 mt-2 leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Element */}
            <div className="relative">
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-emerald-500/10 border border-white/[0.08] p-8 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-7xl sm:text-8xl font-bold bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
                    100%
                  </div>
                  <p className="text-xl text-white/60 mt-4">
                    Price Verification
                  </p>
                  <p className="text-white/40 mt-2">
                    Every line item, every invoice
                  </p>
                </div>
              </div>

              {/* Floating Cards */}
              <div className="absolute -top-6 -right-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm animate-float">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                  <span className="text-sm font-medium text-white">Overcharge Detected</span>
                </div>
              </div>

              <div className="absolute -bottom-6 -left-6 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm animate-float [animation-delay:1s]">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                  <span className="text-sm font-medium text-white">$2,450 Saved</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-32">
        <div className="max-w-4xl mx-auto px-6">
          <div className="relative p-12 sm:p-16 rounded-[2.5rem] bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.1] text-center overflow-hidden">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-emerald-500/10 pointer-events-none" />
            
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
                Ready to Stop
                <span className="block mt-2 pb-2 bg-gradient-to-r from-blue-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
                  Losing Money?
                </span>
              </h2>
              <p className="mt-6 text-lg text-white/50 max-w-xl mx-auto">
                Join businesses that verify every invoice. Start your free trial today 
                and see how much you could be saving.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" asChild className="w-full sm:w-auto bg-white text-black hover:bg-white/90 font-semibold text-base px-10 h-14 group">
                  <Link href="/register">
                    Create Free Account
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
              <p className="mt-6 text-sm text-white/40">
                Free forever for small teams • No credit card required
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo-light.svg" alt="Invoice Check" className="h-9 w-auto object-contain opacity-80" />
          </div>
          <p className="text-sm text-white/40">
            © {new Date().getFullYear()} Invoice Check. All rights reserved.
          </p>
        </div>
      </footer>

    </div>
  );
}
