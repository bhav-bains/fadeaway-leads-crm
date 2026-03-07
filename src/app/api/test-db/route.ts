import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
    try {
        const supabase = await createClient();

        // Test the connection by running a simple query
        // We'll try to select from the 'workspaces' table we created
        const { data, error } = await supabase.from('workspaces').select('*').limit(1);

        if (error) {
            console.error("Supabase Connection Error:", error);
            return NextResponse.json(
                { success: false, message: "Connection failed", error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Successfully connected to Supabase Database!",
            data
        });
    } catch (error) {
        console.error("Unexpected Error:", error);
        return NextResponse.json(
            { success: false, message: "Server error", error: String(error) },
            { status: 500 }
        );
    }
}
