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
    { name: "Lead Finder", href: "/lead-finder", icon: Search },
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
                "relative flex h-screen flex-col border-r bg-background transition-all duration-300",
                isCollapsed ? "w-[80px]" : "w-64",
                className
            )}
        >
            <div className="flex h-14 items-center border-b px-4 py-4 justify-between">
                {!isCollapsed && (
                    <div className="flex items-center gap-2 font-semibold">
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Fadeaway</span>
                    </div>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-8 w-8", isCollapsed && "mx-auto")}
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </Button>
            </div>

            <div className="flex-1 overflow-auto py-2">
                <nav className="grid gap-1 px-2">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground",
                                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                                    isCollapsed && "justify-center px-0"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {!isCollapsed && <span>{item.name}</span>}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="mt-auto border-t p-4">
                <form action={logout}>
                    <Button
                        type="submit"
                        variant="ghost"
                        className={cn(
                            "w-full justify-start text-muted-foreground hover:text-foreground",
                            isCollapsed && "justify-center px-0"
                        )}
                    >
                        <LogOut className="h-4 w-4 mr-2" />
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
            <SheetTrigger className="md:hidden inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10">
                <PanelLeftOpen className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col p-0">
                <div className="flex h-14 items-center border-b px-4 py-4">
                    <div className="flex items-center gap-2 font-semibold">
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Fadeaway</span>
                    </div>
                </div>
                <div className="flex-1 overflow-auto py-2">
                    <nav className="grid gap-1 px-2">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground",
                                        isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                                    )}
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </SheetContent>
        </Sheet>
    );
}
