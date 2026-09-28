import type { FanvueClient, RequestOptions } from "./client";
import type { paths } from "./schema";

// Requests typed from the generated OpenAPI schema by their path, so a wrong
// field, wrapper key or query value is a type error, not a surprise in live mode.

type Json<R> = R extends { content: { "application/json": infer J } } ? J : never;

type PathsWith<M extends "get" | "post" | "put" | "patch", S extends 200 | 201> = {
  [P in keyof paths]: paths[P] extends { [K in M]: { responses: { [C in S]: unknown } } } ? P : never;
}[keyof paths];

type Operation<P extends keyof paths, M extends "get" | "post" | "put" | "patch"> = NonNullable<paths[P][M]>;

type Ok<O, S extends 200 | 201> = O extends { responses: { [C in S]: infer R } } ? Json<R> : never;
type Body<O> = O extends { requestBody?: { content: { "application/json": infer B } } } ? B : never;
type Query<O> = O extends { parameters: { query?: infer Q } } ? NonNullable<Q> : never;
type PathParams<O> = O extends { parameters: { path: infer A } } ? NonNullable<A> : never;

export function getJson<P extends PathsWith<"get", 200>>(
  client: FanvueClient,
  path: P,
  query?: Query<Operation<P, "get">>,
): Promise<Ok<Operation<P, "get">, 200>> {
  return client.get(path, { query: query as RequestOptions["query"] });
}

export function postJson<P extends PathsWith<"post", 201>>(
  client: FanvueClient,
  path: P,
  body: Body<Operation<P, "post">>,
  headers?: Record<string, string>,
): Promise<Ok<Operation<P, "post">, 201>> {
  return client.post(path, { body, headers });
}

export function putJson<P extends PathsWith<"put", 200>>(
  client: FanvueClient,
  path: P,
  params: PathParams<Operation<P, "put">>,
  body: Body<Operation<P, "put">>,
): Promise<Ok<Operation<P, "put">, 200>> {
  return client.put(fillPath(path, params as Record<string, string>), { body });
}

export function patchJson<P extends PathsWith<"patch", 200>>(
  client: FanvueClient,
  path: P,
  body: Body<Operation<P, "patch">>,
): Promise<Ok<Operation<P, "patch">, 200>> {
  return client.patch(path, { body });
}

/** "/chats/automated-messages/{trigger}" with { trigger: "new_subscriber" }. */
function fillPath(path: string, params: Record<string, string>): string {
  return path.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`Missing path parameter ${name} for ${path}`);
    return encodeURIComponent(value);
  });
}
