import type { Metadata } from "next";
import { WorldHome } from "@/components/world/WorldHome";
import { getWorldContent } from "@/lib/world/content";

export const metadata: Metadata = {
  title: "Sid’s World | Sidharth Hulyalkar",
  description:
    "Engineer, neuroscience researcher, and builder. Explore a small world of neural systems, things I build, and life outdoors—or go straight to my work.",
};
export default function HomePage() {
  return <WorldHome content={getWorldContent()} />;
}
