import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  icons: {
    icon: "/logo_rsudds.png", // Mengarah ke public/logo_rsudds.png
  },
  title: "Anjungan Antrian Poliklinik — RSUD Datu Sanggul",
  description: "Sistem display antrian real-time RSUD Datu Sanggul",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.variable} ${outfit.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#0A0F1E] text-white font-sans">
        {children}
      </body>
    </html>
  );
}
