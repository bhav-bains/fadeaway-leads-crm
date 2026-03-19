"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Search, Settings, LogOut, PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { logout } from "@/app/auth/actions";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Leads", href: "/lead-finder", icon: Search },
    { name: "Pipeline", href: "/pipeline", icon: Users },
    { name: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
}

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div
            className={cn(
                "relative flex h-screen flex-col border-r border-zinc-800/50 bg-zinc-950 transition-all duration-300 overflow-hidden font-sans",
                isCollapsed ? "w-[80px]" : "w-64",
                className
            )}
        >
            {/* Texture overlays - subtle */}
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff05_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>

            <div className="relative z-10 flex h-20 items-center border-b border-zinc-800/30 px-8 justify-between">
                {!isCollapsed && (
                    <Link href="/" className="flex items-center gap-2 group">
                        <span className="text-xl font-heading font-black tracking-tighter text-white group-hover:text-brand transition-colors uppercase">
                            Fadeaway<span className="text-brand ml-0.5">.</span>
                        </span>
                    </Link>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-900", isCollapsed && "mx-auto")}
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </Button>
            </div>

            <div className="relative z-10 flex-1 overflow-auto py-8">
                <nav className="grid gap-2 px-4">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-4 rounded-xl px-4 py-3.5 text-sm font-medium transition-all group",
                                    isActive 
                                        ? "bg-zinc-900 text-brand shadow-md border border-zinc-800/50" 
                                        : "text-zinc-500 hover:text-white hover:bg-zinc-900/50",
                                    isCollapsed && "justify-center px-0"
                                )}
                            >
                                <item.icon className={cn("h-4 w-4 transition-colors", isActive ? "text-brand" : "group-hover:text-white")} />
                                {!isCollapsed && <span>{item.name}</span>}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="relative z-10 mt-auto border-t border-zinc-800/30 p-4">
                <form action={logout}>
                    <Button
                        type="submit"
                        variant="ghost"
                        className={cn(
                            "w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-900",
                            isCollapsed && "justify-center px-0"
                        )}
                    >
                        <LogOut className="h-4 w-4 mr-3" />
                        {!isCollapsed && <span>Log out</span>}
                    </Button>
                </form>
            </div>
        </div>
    );
}

export function MobileSidebar() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="md:hidden inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-zinc-900 text-zinc-400 h-10 w-10">
                <PanelLeftOpen className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col p-0 bg-zinc-950 border-r border-zinc-800/50">
                <div className="flex h-20 items-center border-b border-zinc-800/30 px-8">
                    <Link href="/" className="flex items-center gap-2">
                        <span className="text-xl font-heading font-black tracking-tighter text-white uppercase">
                            Fadeaway<span className="text-brand ml-0.5">.</span>
                        </span>
                    </Link>
                </div>
                <div className="flex-1 overflow-auto py-8">
                    <nav className="grid gap-2 px-4">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        "flex items-center gap-4 rounded-xl px-4 py-3.5 text-sm font-medium transition-all group",
                                        isActive 
                                            ? "bg-zinc-900 text-brand border border-zinc-800/50" 
                                            : "text-zinc-500 hover:text-white hover:bg-zinc-900/50"
                                    )}
                                >
                                    <item.icon className={cn("h-4 w-4", isActive ? "text-brand" : "group-hover:text-white")} />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
                <div className="mt-auto border-t border-zinc-800/30 p-4">
                    <form action={logout}>
                        <Button
                            type="submit"
                            variant="ghost"
                            className="w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-900"
                        >
                            <LogOut className="h-4 w-4 mr-3" />
                            Log out
                        </Button>
                    </form>
                </div>
            </SheetContent>
        </Sheet>
    );
}
