import { arcadeGames } from "@/src/data/arcadeGames";
import graphData from "@/data/generated/neural-graph.json";
import { visualArchive } from "@/src/data/visualArchive";
import { MEMORY_POINTS, SNORKEL_VIDEO_POINTS, type RegionId, type WorldContent } from "./model";

// Select existing records; never maintain a second set of project descriptions.
const FEATURED: { slug: string; region: RegionId }[] = [
  { slug: "neuros-v1", region: "mountain" },
  { slug: "datajoint-multimodal-infrastructure", region: "mountain" },
  { slug: "lu-lab-deeplabcut-facemap", region: "mountain" },
  { slug: "neural-mm-tf-mechint", region: "neural" },
  { slug: "allen-mindscope-work", region: "neural" },
  { slug: "neatlabs-core-research", region: "neural" },
];
export function getWorldContent(): WorldContent {
  return {
    publications: graphData.nodes.filter(n=>n.type === "publication").map(n=>({id:n.id,title:n.title,year:n.publication?.year ?? null,href:"/publications"})),
    games: arcadeGames.filter(game => game.status === "playable").map(game => ({ title: game.title, subtitle: game.subtitle, href: `/arcade/${game.slug}` })),
    projects: FEATURED.flatMap(({ slug, region }) => {
      const p = graphData.nodes.find(
        (n) => n.slug === slug && n.type === "project",
      );
      return p
        ? [
            {
              title: p.title,
              summary: p.summary ?? "",
              href: `/projects/${p.slug}`,
              region,
            },
          ]
        : [];
    }),
    photos: MEMORY_POINTS.flatMap((m) => {
      const p = visualArchive.find((photo) => photo.id === m.photoId);
      return p
        ? [
            {
              id: m.id,
              src: p.src,
              alt: p.alt,
              width: p.width,
              height: p.height,
            },
          ]
        : [];
    }),
    videos: SNORKEL_VIDEO_POINTS.map(({ id, title, detail, src, posterSrc }) => ({
      id,
      title,
      detail,
      src,
      ...(posterSrc ? { posterSrc } : {}),
    })),
  };
}
