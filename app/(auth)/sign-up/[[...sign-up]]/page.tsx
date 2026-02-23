import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          创建 Alpha-Quant-Copilot 账户
        </h1>
        <p className="text-sm text-muted-foreground">
          开始您的AI量化投资之旅
        </p>
      </div>
      <SignUp
        appearance={{
          elements: {
            formButtonPrimary:
              "bg-primary hover:bg-primary/90",
            footerActionLink:
              "text-primary hover:text-primary/80",
          },
        }}
      />
      <p className="px-8 text-center text-sm text-muted-foreground">
        点击继续即表示您同意我们的{" "}
        <a
          href="/terms"
          className="underline underline-offset-4 hover:text-primary"
        >
          服务条款
        </a>{" "}
        和{" "}
        <a
          href="/privacy"
          className="underline underline-offset-4 hover:text-primary"
        >
          隐私政策
        </a>
        。
      </p>
    </div>
  );
}