export default function manifest() {
  return {
    name: "Yo's Caribbean Kitchen",
    short_name: "Yo's",
    description: "Order Haitian and Caribbean comfort food from Yo's Caribbean Kitchen.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#161514",
    theme_color: "#d71920",
    shortcuts: [
      {
        name: "Start order",
        short_name: "Order",
        description: "Build an order request.",
        url: "/order",
        icons: [{ src: "/pwa-icon.png", sizes: "512x512" }]
      },
      {
        name: "View menu",
        short_name: "Menu",
        description: "Browse Yo's current menu.",
        url: "/menu",
        icons: [{ src: "/pwa-icon.png", sizes: "512x512" }]
      }
    ],
    icons: [
      {
        src: "/pwa-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon"
      }
    ]
  };
}
