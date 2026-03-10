import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fadeaway Leads CRM",
  description: "Outbound Sales Engine and CRM",
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-muted/20 overflow-x-hidden w-full max-w-[100vw]">
      <Sidebar className="hidden md:block" />
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main className="flex-1 p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
