import { Suspense } from "react";
import VerifyView from "./verify-view";

// the code comes from the url, so the view streams in at request time
export default function VerifyPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-3xl px-4 py-10 text-muted sm:py-16">Loading...</main>}>
      <VerifyView />
    </Suspense>
  );
}
