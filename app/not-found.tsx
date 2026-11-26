import Link from "next/link";
import { PublicShell, Notice } from "@/components/public-shell";
export default function NotFound() {
  return <PublicShell><Notice title="Page not found" action={<Link href="/" className="btn-primary">Go home</Link>}>It may have moved, or you may not have access to it.</Notice></PublicShell>;
}
