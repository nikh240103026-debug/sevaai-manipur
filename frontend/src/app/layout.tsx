import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dashboard | SevaAI Manipur",
  description:
    "Synthetic demo dashboard for welfare and public service gap intelligence in Manipur.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col"><AuthProvider>
      {children}
    </AuthProvider></body>
    </html>
  );
}
