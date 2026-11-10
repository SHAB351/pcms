import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { APP_LONG_NAME, APP_NAME } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Tout est rendu à la demande.
 *
 * L'application lit la session et la configuration à chaque requête : une page
 * pré-générée figerait l'état « Supabase non configuré » dans le HTML du build
 * et resterait fausse après le renseignement des variables d'environnement.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} · Gestion de la communication politique`,
    template: `%s · ${APP_NAME}`,
  },
  description: `${APP_LONG_NAME} — plateforme interne de gestion du service de communication.`,
  // Plateforme interne : aucune indexation par les moteurs de recherche.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
