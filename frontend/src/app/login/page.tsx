"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/client";
import { getCurrentUser, login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await login({
        username,
        password,
      });

      await getCurrentUser();

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <Link className="brand login-brand" href="/login">
          <span className="brand-mark" aria-hidden="true">
            ✳
          </span>

          <span className="brand-copy">
            <strong>
              seva<span>ai</span>
            </strong>
            <small>MANIPUR · INTELLIGENCE</small>
          </span>
        </Link>

        <div className="login-eyebrow">STATE ADMINISTRATION</div>

        <h1>Welcome back</h1>

        <p className="login-description">
          Sign in to your SevaAI workspace.
        </p>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="login-username">Username</label>

          <input
            autoComplete="username"
            id="login-username"
            onChange={(event) => setUsername(event.target.value)}
            required
            type="text"
            value={username}
          />

          <label htmlFor="login-password">Password</label>

          <input
            autoComplete="current-password"
            id="login-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />

          <button
            className="button button-primary login-submit"
            disabled={loading}
            type="submit"
          >
            {loading ? "Signing in..." : "Sign in"}

            {!loading && (
              <span aria-hidden="true">
                →
              </span>
            )}
          </button>
        </form>

        <p className="login-footnote">
          Synthetic demonstration environment · Manipur
        </p>
      </section>
    </main>
  );
}