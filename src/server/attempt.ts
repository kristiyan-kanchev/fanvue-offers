import { describeError, type DescribedError } from "./http";

/** A page's data, or what went wrong in words the page can show: production hides thrown messages. */
export async function attempt<T>(load: () => Promise<T>): Promise<{ data: T } | { error: DescribedError }> {
  try {
    return { data: await load() };
  } catch (cause) {
    return { error: describeError(cause) };
  }
}
