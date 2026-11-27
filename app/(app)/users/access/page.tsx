import { redirect } from "next/navigation";
// Feature access now lives on each user's page (Permissions).
export default function Old() { redirect("/users"); }
