import type { Metadata } from "next";
import { WorldHome } from "@/components/world/WorldHome";
import { getWorldContent } from "@/lib/world/content";

export const metadata: Metadata = {
  title: "Sid’s iLand | Sid Hulyalkar",
  description:
    "Explore Sid’s iLand or visit Sid Hulyalkar’s portfolio.",
};
export default function HomePage() {
  return <WorldHome content={getWorldContent()} />;
}
