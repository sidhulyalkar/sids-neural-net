import type {Metadata} from "next";
import {WorldHome} from "@/components/world/WorldHome";
import {getWorldContent} from "@/lib/world/content";
export const metadata:Metadata={
  title:"Sid’s iLand | Interactive World",
  description:"Explore Sid’s iLand: skiing, research, marine habitats, arcade games and hidden places.",
};
export default function WorldPage(){
  return <WorldHome content={getWorldContent()}/>;
}
