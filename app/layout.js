import "./globals.css";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "Yo's Caribbean Kitchen | Haitian & Caribbean Comfort Food",
    template: "%s | Yo's Caribbean Kitchen"
  },
  description: "Order Haitian and Caribbean comfort food from Yo's Caribbean Kitchen. Real food, real good.",
  openGraph: {
    title: "Yo's Caribbean Kitchen",
    description: "Haitian and Caribbean comfort food for pickup and local order requests.",
    images: ["/yos-logo.png"],
    siteName: "Yo's Caribbean Kitchen",
    type: "website"
  },
  icons: {
    icon: "/favicon.ico"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
