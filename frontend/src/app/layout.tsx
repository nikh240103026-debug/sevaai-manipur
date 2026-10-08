import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthGuard } from "@/components/auth-guard";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dashboard | SevaAI Manipur",
  description:
    "Live village service coverage and public service gap intelligence for Manipur.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="flex min-h-full flex-col">
        <Suspense fallback={<main className="auth-loading">Verifying access…</main>}>
          <AuthGuard>{children}</AuthGuard>
        </Suspense>
      </body>
    </html>
  );
}
