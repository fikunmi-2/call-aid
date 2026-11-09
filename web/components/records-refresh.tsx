"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function RecordsRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 15000);
    const refresh = () => router.refresh();
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);
  return (
    <p className="small muted">
      Published records refresh every 15 seconds. Dates are generalized to the
      day in Saskatchewan. Public records expire after seven days and can be
      copied by anyone.
    </p>
  );
}
