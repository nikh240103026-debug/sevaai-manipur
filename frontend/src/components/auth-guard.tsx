"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { LoadingBar } from "@/components/data-state";
import { ApiError, apiRequest, hasApiConfiguration } from "@/lib/client";
import {
  isLocalDemoSession,
  subscribeLocalDemoState,
} from "@/lib/local-passkey";

export function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const localDemo = useSyncExternalStore(
    subscribeLocalDemoState,
    isLocalDemoSession,
    () => false,
  );
  const [retryCount, setRetryCount] = useState(0);
  const [verified, setVerified] = useState<{
    pathname: string;
    attempt: number;
  } | null>(null);
  const [failure, setFailure] = useState<{
    pathname: string;
    attempt: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (pathname === "/login") return;

    if (localDemo) return;
    if (!hasApiConfiguration) {
      router.replace("/login");
      return;
    }

    let active = true;
    apiRequest<{ user_id: string }>("/api/v1/auth/me", {
      credentials: "include",
    })
      .then(() => {
        if (active) setVerified({ pathname, attempt: retryCount });
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          router.replace("/login");
          return;
        }
        setFailure({
          pathname,
          attempt: retryCount,
          message:
            requestError instanceof TypeError
              ? "Cannot reach the sign-in service. Start the FastAPI backend and verify its database connection."
              : requestError instanceof Error
                ? requestError.message
                : "Unable to verify your session.",
        });
      });

    return () => {
      active = false;
    };
  }, [pathname, retryCount, router, localDemo]);

  if (
    pathname === "/login" ||
    localDemo ||
    (verified?.pathname === pathname && verified.attempt === retryCount)
  ) {
    return children;
  }

  if (
    failure?.pathname === pathname &&
    failure.attempt === retryCount
  ) {
    return (
      <main className="auth-unavailable">
        <h1>Sign-in service unavailable</h1>
        <p role="alert">{failure.message}</p>
        <button
          className="button button-secondary"
          onClick={() => setRetryCount((count) => count + 1)}
          type="button"
        >
          Retry
        </button>
        <Link href="/login">Return to sign in</Link>
      </main>
    );
  }

  return (
    <main className="auth-loading" aria-label="Checking your session">
      <LoadingBar />
      <span className="auth-loading-indicator" aria-hidden="true" />
      <span>Verifying access…</span>
    </main>
  );
}
