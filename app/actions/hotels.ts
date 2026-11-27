"use server";
import { redirect } from "next/navigation";
import { switchHotel } from "@/lib/auth";

/** Cluster users: work in another hotel of the group (or go back home). */
export async function switchHotelAction(propertyId: string) {
  await switchHotel(propertyId);
  redirect("/");
}
