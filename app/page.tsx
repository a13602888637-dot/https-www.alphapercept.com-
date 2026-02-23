import { redirect } from "next/navigation";

export default async function HomePage() {
  // 暂时直接重定向到仪表板，认证由中间件处理
  redirect("/dashboard");
}