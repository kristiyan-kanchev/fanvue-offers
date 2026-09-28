"use client";

import Link from "next/link";
import { Button } from "@fanvue/ui";
import { ErrorState } from "@/components/States";
import { Actions } from "@/components/ui";

/**
 * The last resort, for a bug rather than a Fanvue answer: pages turn those into
 * their own message. The detail stays in the server logs.
 */
export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <ErrorState
      title="Something went wrong on our side"
      message="Nothing was sent. Try again, or head back to your overview."
      action={
        <Actions>
          <Button variant="secondary" size="32" onClick={retry}>
            Try again
          </Button>
          <Button variant="tertiary" size="32" asChild>
            <Link href="/audit">Back to overview</Link>
          </Button>
        </Actions>
      }
    />
  );
}
