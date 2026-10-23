import { Suspense } from "react";
import VerifyView from "./verify-view";

// the code comes from the url, so the view streams in at request time
export default function VerifyPage() {
  return (
    <Suspense fallback={<main className="bg-panel"><div className="mx-auto h-72 max-w-6xl px-4 pt-20" /></main>}>
      <VerifyView />
    </Suspense>
  );
}
