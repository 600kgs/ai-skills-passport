import type { Metadata } from "next";
import localFont from "next/font/local";
import { Noto_Sans, Noto_Sans_Georgian } from "next/font/google";
import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { I18nProvider } from "@/i18n/client";
import { getDict } from "@/i18n/server";
import "./globals.css";

// btu's own heading face: bebas neue with georgian, the file btu.edu.ge serves (OFL, see fonts/OFL.txt)
const bebas = localFont({ src: "./fonts/bebas-neue-georgian.woff", variable: "--font-bebas", display: "swap" });
const noto = Noto_Sans({ variable: "--font-noto", subsets: ["latin"], weight: ["400", "600", "700", "900"] });
const georgian = Noto_Sans_Georgian({ variable: "--font-georgian", subsets: ["georgian"], weight: ["400", "600", "700", "900"] });

export const metadata: Metadata = {
  title: "BTU AI Skills Digital Passport",
  description: "Verify a BTU AI Skills Digital Passport.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ka" className={`${bebas.variable} ${noto.variable} ${georgian.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Suspense fallback={<div className="h-[7.5rem] bg-graphite" />}>
          <Frame>{children}</Frame>
        </Suspense>
      </body>
    </html>
  );
}

// the language lives in a cookie, so everything that shows text renders once the request is known
async function Frame({ children }: { children: React.ReactNode }) {
  const dict = await getDict();
  return (
    <I18nProvider dict={dict}>
      <SiteHeader />
      <div id="content" className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </I18nProvider>
  );
}
