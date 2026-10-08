"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@sevaai.demo");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push("/dashboard");
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <Link className="brand login-brand" href="/login">
          <span className="brand-mark" aria-hidden="true">✳</span>
          <span className="brand-copy">
            <strong>seva<span>ai</span></strong>
            <small>MANIPUR · INTELLIGENCE</small>
          </span>
        </Link>
        <div className="login-eyebrow">STATE ADMINISTRATION</div>
        <h1>Welcome back</h1>
        <p className="login-description">Sign in to your SevaAI workspace.</p>
        <div className="login-demo-note">
          Demo access is enabled. Use any email and password to explore.
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email address</label>
          <input
            autoComplete="username"
            id="login-email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <label htmlFor="login-password">Password</label>
          <input
            autoComplete="current-password"
            id="login-password"
            minLength={4}
            required
            type="password"
            defaultValue="sevaai-demo"
          />
          <button className="button button-primary login-submit" type="submit">
            Sign in <span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="login-footnote">Synthetic demonstration environment · Manipur</p>
      </section>
    </main>
  );
}
