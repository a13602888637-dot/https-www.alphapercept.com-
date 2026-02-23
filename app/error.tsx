"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <AlertTriangle className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">应用程序错误</h1>
          <p className="text-muted-foreground">
            抱歉，应用程序遇到了意外错误。我们的团队已收到通知。
          </p>
          {error.digest && (
            <p className="text-sm text-muted-foreground mt-2">
              错误ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => reset()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            重试
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.href = "/"}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            返回首页
          </Button>
        </div>

        <div className="pt-6 border-t">
          <details className="text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              查看错误详情
            </summary>
            <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-60">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}