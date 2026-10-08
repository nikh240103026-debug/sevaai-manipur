"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";

import { ApiError, apiRequest, hasApiConfiguration } from "@/lib/client";
import {
  hasLocalDemoPasskey,
  signInToLocalDemo,
  subscribeLocalDemoState,
} from "@/lib/local-passkey";

type AuthUser = {
  user_id: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localDemoMode, setLocalDemoMode] = useState(!hasApiConfiguration);
  const passkeyReady = useSyncExternalStore(
    subscribeLocalDemoState,
    hasLocalDemoPasskey,
    () => false,
  );

  async function handleLocalDemoSignIn() {
    setError("");
    setIsSubmitting(true);
    try {
      await signInToLocalDemo();
      router.replace("/dashboard");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.name === "NotAllowedError"
            ? "Passkey verification was canceled or not approved."
            : requestError.message
          : "Unable to sign in with this passkey.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await apiRequest<AuthUser>("/api/v1/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, password }),
      });
      router.replace("/dashboard");
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.status === 401
          ? "The user ID or password is incorrect."
          : requestError instanceof TypeError
            ? "Cannot reach the sign-in service. Start the FastAPI backend and verify its database connection."
          : requestError instanceof Error
            ? requestError.message
            : "Unable to sign in. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-heading">
        <Link className="brand login-brand" href="/login">
          <span className="brand-mark" aria-hidden="true">✳</span>
          <span className="brand-copy">
            <strong>seva<span>ai</span></strong>
            <small>MANIPUR · INTELLIGENCE</small>
          </span>
        </Link>
        <div className="login-eyebrow">STATE ADMINISTRATION</div>
        <h1 id="login-heading">Welcome back</h1>
        <p className="login-description">Sign in to your SevaAI workspace.</p>
        {localDemoMode ? (
          <>
            <div className="login-demo-note">
              Local demo mode uses a device passkey and bundled synthetic data. It does not require the API or database, and is not secure authentication for real data.
            </div>
            <button
              className="button button-primary login-submit"
              disabled={isSubmitting}
              onClick={handleLocalDemoSignIn}
              type="button"
            >
              {isSubmitting
                ? "Waiting for passkey…"
                : passkeyReady
                  ? "Continue with passkey"
                  : "Create local demo passkey"}
              <span aria-hidden="true">→</span>
            </button>
            {hasApiConfiguration && (
              <button
                className="button button-secondary login-submit"
                onClick={() => { setError(""); setLocalDemoMode(false); }}
                type="button"
              >
                Return to administrator sign in
              </button>
            )}
          </>
        ) : (
          <>
            <div className="login-demo-note">
              Access is managed by your administrator. Public account registration is disabled.
            </div>
            <form className="login-form" onSubmit={handleSubmit}>
              <label htmlFor="login-user-id">User ID</label>
              <input
                autoComplete="username"
                id="login-user-id"
                maxLength={50}
                minLength={3}
                onChange={(event) => setUserId(event.target.value)}
                required
                type="text"
                value={userId}
              />
              <label htmlFor="login-password">Password</label>
              <input
                autoComplete="current-password"
                id="login-password"
                maxLength={128}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
              <button
                className="button button-primary login-submit"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Signing in…" : "Sign in"}
                <span aria-hidden="true">→</span>
              </button>
            </form>
            <button
              className="button button-secondary login-submit"
              onClick={() => { setError(""); setLocalDemoMode(true); }}
              type="button"
            >
              Use local demo passkey
            </button>
          </>
        )}
        {error && (
          <p className="login-feedback" role="alert">
            {error}
          </p>
        )}
        <p className="login-footnote">Synthetic demonstration environment · Manipur</p>
      </section>
    </main>
  );
}
