import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Order Details — Sholok" },
      { name: "description", content: "Sholok non-grocery order details: status, payment, shipments and documents." },
      { property: "og:title", content: "Order Details — Sholok" },
      { property: "og:description", content: "Sholok non-grocery order details: status, payment, shipments and documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

// The original HTML project is preserved as-is in public/order-details.html.
function Index() {
  return <iframe src="/order-details.html" title="Order Details" className="block h-screen w-full border-0" />;
}
