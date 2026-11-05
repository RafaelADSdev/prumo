import "./globals.css";
import "./forms.css";
import "./experience.css";
import "./login.css";
import "./settings.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Prumo — seu financeiro em equilíbrio",
  description:
    "Mais clareza para suas finanças. Controle individual, simples e local.",
  icons: { icon: "/brand/prumo-symbol.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
