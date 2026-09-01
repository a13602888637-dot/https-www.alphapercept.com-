import { redirect } from "next/navigation";

export default function SignUpPage() {
  redirect("/sign-in?reason=registration-closed");
}
