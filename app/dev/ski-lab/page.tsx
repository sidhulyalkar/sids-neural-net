import {notFound} from "next/navigation";
import SkiLab from "./SkiLab";
export default function Page(){
  if(process.env.NODE_ENV!=="development")notFound();
  return <SkiLab/>;
}
