import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthProvider } from "@/components/auth-provider";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dashboard | SevaAI Manipur",
  description:
    "Welfare and public service gap intelligence using the active dataset, with synthetic demo data as a fallback.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Suspense
          fallback={
            <div className="dashboard-state" role="status">
              <span className="loading-indicator" /> Loading workspace…
            </div>
          }
        >
          <AuthProvider>{children}</AuthProvider>
        </Suspense>
      </body>
    </html>
  );
}
