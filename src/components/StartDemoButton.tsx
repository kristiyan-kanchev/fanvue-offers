"use client";

import { startDemo } from "@/app/actions";
import { SubmitButton } from "./ui";

export function StartDemoButton() {
  return (
    <form action={startDemo.bind(null, "maya")}>
      <SubmitButton variant="secondary" size="40">
        Try the demo
      </SubmitButton>
    </form>
  );
}
