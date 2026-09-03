"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { authClient } from "@/auth/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      setError(result.error.message ?? "The email or password is incorrect.");
      setBusy(false);
      return;
    }
    window.location.assign("/app");
  };

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand"><Image src="/brand/app-icon.svg" width={54} height={54} alt="" priority /><div><strong>ClientLoop</strong><span>by Rainhopes</span></div></div>
        <div className="auth-heading"><p className="eyebrow">Private approval portal</p><h1>Welcome back</h1><p>Sign in with the account assigned to you.</p></div>
        <form className="auth-form" onSubmit={submit}>
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label>
          <label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required minLength={12} /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>
          {error ? <p className="form-alert error-alert" role="alert">{error}</p> : null}
          <button className="primary-button" type="submit" disabled={busy}><LogIn size={19} />{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="auth-footnote">Accounts are created by the ClientLoop Super Admin. Public registration is disabled.</p>
      </section>
      <aside className="auth-visual"><div><span>Review. Approve. Publish.</span><h2>Every company sees only its own work.</h2><p>Tenant isolation is enforced by authenticated, company-scoped server queries—not only hidden in the interface.</p></div></aside>
    </main>
  );
}
