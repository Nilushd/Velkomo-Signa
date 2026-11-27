import { rootSql } from "./db";

/** The hotel's group (cluster) and the other hotels in it — what a user can be given access to. */
export async function groupOf(propertyId: string) {
  const [g] = await rootSql()<{ id: string; name: string }[]>`
    select g.id, g.name from properties p join hotel_groups g on g.id = p.group_id where p.id = ${propertyId}`;
  if (!g) return null;
  const hotels = await rootSql()<{ id: string; code: string; name: string }[]>`
    select id, property_code as code, name from properties where group_id = ${g.id} and id <> ${propertyId} and active order by name`;
  return { ...g, hotels };
}

/** Cluster hotels a user has been given (from their home hotel's point of view). */
export async function userHotels(userId: string) {
  return (await rootSql()<{ property_id: string }[]>`select property_id from user_properties where user_id = ${userId}`).map((r) => r.property_id);
}

export async function propertyCodes(ids: string[]) {
  if (!ids.length) return new Map<string, { code: string; name: string }>();
  const rows = await rootSql()<{ id: string; code: string; name: string }[]>`select id, property_code as code, name from properties where id = any(${ids}::uuid[])`;
  return new Map(rows.map((r) => [r.id, { code: r.code, name: r.name }]));
}
