/**
 * Authenticated fetch utilities for evaluation harness.
 * Ensures all edge function calls carry a valid user JWT.
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Get the current user's access token from the active session.
 * Returns null if no session exists.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Authenticated fetch wrapper — attaches JWT to every request.
 * Throws if no valid session exists.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("[AUTH_ERROR] Missing JWT — user not authenticated. Please sign in first.");
  }

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string> || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });
}

/**
 * Get authenticated user identity for evaluation metadata.
 */
export async function getEvalIdentity(): Promise<{
  user_id: string;
  email: string;
  is_authenticated: true;
} | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  return {
    user_id: session.user.id,
    email: session.user.email ?? "unknown",
    is_authenticated: true,
  };
}
