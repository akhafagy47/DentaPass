import './globals.css';
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata = {
  title: "DentaPass — The loyalty card that lives in your patients' wallets",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}<SpeedInsights /></body>
    </html>
  );
}
