"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ChatRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const p = searchParams.get("p");
    if (p) {
      router.replace(`/?p=${encodeURIComponent(p)}`);
    } else {
      router.replace("/");
    }
  }, [router, searchParams]);

  return (
    <div className="font-mono text-xs text-muted-foreground p-4">
      Redirecting to chat...
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="font-mono text-xs text-muted-foreground p-4">Loading redirect...</div>}>
      <ChatRedirectContent />
    </Suspense>
  );
}
