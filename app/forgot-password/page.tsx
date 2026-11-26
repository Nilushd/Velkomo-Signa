import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "./forgot-form";
export const metadata = { title: "Forgot password" };
export default function ForgotPage() {
  return <AuthShell title="Forgot password" subtitle="We'll e-mail a reset link if your account has an e-mail address."><ForgotForm /></AuthShell>;
}
