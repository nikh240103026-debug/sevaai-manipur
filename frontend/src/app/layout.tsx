import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";

export const metadata: Metadata = {
  title: {
    default: "SevaAI Manipur",
    template: "%s | SevaAI Manipur",
  },
  description:
    "AI-Powered Welfare & Public Service Gap Intelligence Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}