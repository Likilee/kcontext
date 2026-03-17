import { redirect } from "next/navigation";
import { KOREAN_HOME_PATH } from "@/lib/app-routes";

export default function HomePage() {
  redirect(KOREAN_HOME_PATH);
}
