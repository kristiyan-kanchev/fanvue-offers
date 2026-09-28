/** Calls one of this app's API routes: a GET, or a POST with a JSON body. Throws with the route's message. */
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    ...(body !== undefined && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message ?? "Something went wrong. Try again.");
  return data as T;
}
