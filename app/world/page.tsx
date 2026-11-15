import type { Metadata } from "next";
import { WorldHome } from "@/components/world/WorldHome";
import { getWorldContent } from "@/lib/world/content";

// Master-based qualification route: preserve the existing fractal landing page.
// Promote iLand to the homepage only after world, accessibility and performance gates.
export const metadata: Metadata = {
  title: "Sid’s iLand | Sid Hulyalkar",
  description: "Explore an interactive world of neuroscience, adventure, games and discovery.",
};

export default function WorldPage() {
  return <WorldHome content={getWorldContent()} />;
}
