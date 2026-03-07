"use client";

import { MobileSidebar } from "./sidebar";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

export function Header() {
    return (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-4">
            <MobileSidebar />

            <div className="flex flex-1 items-center justify-between">
                <div className="font-semibold text-lg hidden md:block">
                    {/* Can dynamically show page title here later based on route */}
                </div>

                <div className="flex items-center gap-4 ml-auto">
                    <Button variant="outline" size="icon" className="relative h-8 w-8 rounded-full">
                        <Bell className="h-4 w-4" />
                        <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-600"></span>
                        <span className="sr-only">Toggle notifications</span>
                    </Button>

                    <div className="flex items-center gap-2 h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex-shrink-0 justify-center">
                        <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">FC</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
