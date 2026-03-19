import React from "react";
import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Fadeaway Leads CRM",
  description: "Outbound Sales Engine and CRM",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 overflow-x-hidden w-full max-w-[100vw] font-sans">
      <Sidebar className="hidden md:block border-zinc-800/50" />
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-10">
            <div className="max-w-[1600px] mx-auto w-full">
                {children}
            </div>
        </main>
      </div>
    </div>
  );
}
