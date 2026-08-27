import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  const isRainhopes = host.includes("rainhopes");
  const name = isRainhopes ? "Rainhopes Review" : "ClientLoop";

  return new Response(
    JSON.stringify({
      id: "/",
      name,
      short_name: isRainhopes ? "RH Review" : "ClientLoop",
      description: "Review creative work, respond clearly, and keep every version together.",
      start_url: "/app?source=pwa",
      scope: "/",
      display: "standalone",
      display_override: ["window-controls-overlay", "standalone"],
      background_color: "#fffaf5",
      theme_color: "#fffaf5",
      orientation: "any",
      categories: ["business", "productivity"],
      icons: [
        {
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/icon-maskable-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable",
        },
        {
          src: "/icons/icon-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
      shortcuts: [
        {
          name: "Pending reviews",
          short_name: "Pending",
          url: "/company?filter=pending&source=shortcut",
          icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
        },
      ],
    }),
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "private, no-store",
      },
    },
  );
}
