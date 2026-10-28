import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";
import { SocketProvider } from "@/context/SocketContext";

export const metadata: Metadata = {
  title: "Sistema Planta - Tiempo Real",
};

// src/app/layout.tsx

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <SocketProvider>
          <div className="brand-bar">
            <div className="brand-bar-inner">
              <Image
                src="/brand/us-technologies.png"
                alt="US Technologies, S.A. de C.V."
                width={2034}
                height={594}
                priority
                className="brand-logo"
              />
            </div>
          </div>
          {children}
        </SocketProvider>
      </body>
    </html>
  );
}
