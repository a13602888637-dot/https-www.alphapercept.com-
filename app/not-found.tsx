import { Button } from "@/components/ui/button";
import { Search, Home, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <div className="text-6xl font-bold text-muted-foreground">404</div>
          <h1 className="text-2xl font-bold">页面未找到</h1>
          <p className="text-muted-foreground">
            抱歉，您访问的页面不存在或已被移动。
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild className="flex items-center gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              返回首页
            </Link>
          </Button>
          <Button variant="outline" asChild className="flex items-center gap-2">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              返回仪表板
            </Link>
          </Button>
        </div>

        <div className="pt-6 border-t">
          <p className="text-sm text-muted-foreground mb-3">
            您可以尝试以下操作：
          </p>
          <ul className="text-sm text-left space-y-2">
            <li className="flex items-start gap-2">
              <Search className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <span>检查URL是否正确</span>
            </li>
            <li className="flex items-start gap-2">
              <Search className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <span>使用导航菜单访问其他页面</span>
            </li>
            <li className="flex items-start gap-2">
              <Search className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <span>联系技术支持如果问题持续存在</span>
            </li>
          </ul>
        </div>

        <div className="text-xs text-muted-foreground pt-4">
          <p>Alpha-Quant-Copilot • AI量化交易分析系统</p>
        </div>
      </div>
    </div>
  );
}