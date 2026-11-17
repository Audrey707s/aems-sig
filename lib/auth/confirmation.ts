/** Supabase token hashes can carry the PKCE flow prefix. Never alter that value:
 * verifyOtp must receive the complete provider token, including `pkce_`.
 */
export function isSignupConfirmation(token: unknown, type: unknown): token is string {
  return typeof token === "string" && /^(?:pkce_)?[a-f0-9]{32,128}$/i.test(token)
    && (type === "signup" || type === "email");
}
