/**
 * Shared constants for the demo-grade admin gate.
 *
 * Imported by both `proxy.ts` (cookie check) and `lib/admin-actions.ts`
 * (login/logout server actions) so the password and cookie name live in
 * exactly one place.
 *
 * DEMO ONLY: the password defaults to a hardcoded literal and the cookie
 * value is the password itself. Not suitable for real auth — replace with a
 * random opaque token compared against a server-side allowlist (or a signed
 * value) before shipping anything user-facing. Overridable via
 * ADMIN_PASSWORD for deployments that want to change it without code edits.
 */
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "letmeinadminagent";
export const ADMIN_COOKIE_NAME = "admin_auth";
