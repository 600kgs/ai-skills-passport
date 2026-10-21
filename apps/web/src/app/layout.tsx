import type { Metadata } from "next";
import { Archivo, Noto_Sans_Georgian } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], weight: ["400", "700", "900"] });
const georgian = Noto_Sans_Georgian({ variable: "--font-georgian", subsets: ["georgian"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "BTU AI Skills Digital Passport",
  description: "Verify a BTU AI Skills Digital Passport.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${georgian.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
