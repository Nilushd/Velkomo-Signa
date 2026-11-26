import { sendEmail, type Email } from "./email";
import { pushToUser } from "./push";
import { rootSql } from "./db";

/** Side effects collected inside a DB transaction and run only after it commits. */
export type Effect =
  | { kind: "email"; mail: Email }
  | { kind: "notify"; propertyId: string; userId: string; title: string; body: string; url: string; push: boolean };

export async function runEffects(effects: Effect[]) {
  for (const e of effects) {
    try {
      if (e.kind === "email") await sendEmail(e.mail);
      else {
        await rootSql()`insert into notifications (property_id, user_id, title, body, url)
          values (${e.propertyId}, ${e.userId}, ${e.title}, ${e.body}, ${e.url})`;
        if (e.push) await pushToUser(e.userId, { title: e.title, body: e.body, url: e.url });
      }
    } catch (err) {
      console.error("[effects] failed", err);
    }
  }
}
