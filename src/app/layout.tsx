import type { Metadata } from "next";
import { Outfit, DM_Sans } from "next/font/google";
import "@/app/globals.css";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const outfit = Outfit({ 
    subsets: ["latin"],
    variable: "--font-outfit",
});

const dmSans = DM_Sans({ 
    subsets: ["latin"],
    variable: "--font-dm-sans",
});

export const metadata: Metadata = {
    title: "Fadeaway Leads CRM",
    description: "Custom Outbound Sales Engine and CRM",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${dmSans.variable} ${outfit.variable} font-sans antialiased`} suppressHydrationWarning>
                <TooltipProvider>
                    {children}
                    <Toaster />
                </TooltipProvider>
            </body>
        </html>
    );
}
