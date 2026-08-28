import { redirect } from "next/navigation";

export const metadata = { title: "深度研究 | AlphaPercept" };

export default function DashboardPage() {
  redirect("/uzi-reports");
}
