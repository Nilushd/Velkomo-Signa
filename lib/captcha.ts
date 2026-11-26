/** hCaptcha check for anonymous public submissions. Skipped when HCAPTCHA_SECRET is not configured. */
export async function verifyCaptcha(token: string | null | undefined): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) return true;
  if (!token) return false;
  try {
    const r = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const j = (await r.json()) as { success?: boolean };
    return !!j.success;
  } catch { return false; }
}
