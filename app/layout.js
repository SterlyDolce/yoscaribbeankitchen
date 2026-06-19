import "./globals.css";
import BagModal from "./BagModal";
import PwaAppChrome from "./PwaAppChrome";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  manifest: "/manifest.webmanifest",
  title: {
    default: "Yo's Caribbean Kitchen | Haitian & Caribbean Comfort Food",
    template: "%s | Yo's Caribbean Kitchen"
  },
  description: "Order Haitian and Caribbean comfort food from Yo's Caribbean Kitchen. Real food, real good.",
  openGraph: {
    title: "Yo's Caribbean Kitchen",
    description: "Haitian and Caribbean comfort food for pickup and local order requests.",
    images: ["/pwa-icon.png"],
    siteName: "Yo's Caribbean Kitchen",
    type: "website"
  },
  icons: {
    apple: "/pwa-icon.png",
    icon: "/favicon.ico"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Yo's"
  }
};

export const viewport = {
  themeColor: "#d71920",
  viewportFit: "cover"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <PwaAppChrome />
        {children}
        <BagModal />
      </body>
    </html>
  );
}
