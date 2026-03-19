"use client";

import { MobileSidebar } from "./sidebar";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

export function Header() {
    return (
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 bg-zinc-950/20 border-b border-zinc-800/30 px-6 backdrop-blur-md sm:h-20 sm:bg-transparent sm:border-0 py-4">
            <MobileSidebar />

            <div className="flex flex-1 items-center justify-between">
                <div className="hidden md:block">
                    {/* Page title space */}
                </div>

                <div className="flex items-center gap-6 ml-auto">
                    <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all">
                        <Bell className="h-5 w-5" />
                        <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-brand shadow-[0_0_10px_rgba(255,79,0,0.5)]"></span>
                        <span className="sr-only">Toggle notifications</span>
                    </Button>

                    <div className="flex items-center gap-3 pl-4 border-l border-zinc-800/50">
                        <div className="flex flex-col items-end hidden sm:flex">
                            <span className="text-xs font-black text-white uppercase tracking-tighter italic">BHAV BAINS</span>
                            <span className="text-[10px] font-bold text-brand uppercase tracking-widest leading-none opacity-80">PRO CORE</span>
                        </div>
                        <div className="flex items-center gap-2 h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800/50 flex-shrink-0 justify-center group hover:border-brand/50 transition-all shadow-sm">
                            <span className="text-sm font-black text-brand group-hover:scale-110 transition-transform tracking-tighter">BB</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
