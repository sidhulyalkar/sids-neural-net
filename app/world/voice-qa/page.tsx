import {notFound} from "next/navigation";
import ShastaVoiceQaHarness from "@/components/world/ShastaVoiceQaHarness";

export const dynamic="force-dynamic";
export default function ShastaVoiceQaPage(){
 if(process.env.NODE_ENV!=="development")notFound();
 return <ShastaVoiceQaHarness/>;
}
