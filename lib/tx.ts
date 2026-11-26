import { tenant, type Sql } from "./db";
/** Property-wide (system) scope transaction; used by the engine after permissions are checked. */
export function asSystemTx<T>(propertyId: string, fn: (tx: Sql) => Promise<T>) {
  return tenant({ propertyId, userId: null }, fn);
}
