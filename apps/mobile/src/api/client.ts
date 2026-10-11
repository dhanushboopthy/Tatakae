import { API_URL } from "../config";
import { getToken } from "../auth/session";

/** fetch wrapper: Bearer session token; 401 → clear token + router.replace('/login'). */
export async function apiGet<T>(path: string): Promise<T> {
  // TODO(v1)
  const token = await getToken();
  const res = await fetch(`${API_URL}/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}
