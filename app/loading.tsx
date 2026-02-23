export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-muted border-t-primary animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full bg-primary/20"></div>
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">加载中...</h2>
          <p className="text-sm text-muted-foreground">
            正在准备您的量化交易分析环境
          </p>
        </div>
        <div className="pt-4">
          <div className="h-1 w-48 bg-muted rounded-full overflow-hidden mx-auto">
            <div className="h-full w-1/3 bg-primary animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
}