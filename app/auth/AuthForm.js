"use client";

import { Mail, Phone, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState("signin");
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const isSignup = mode === "signup";

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting(true);
    setStatus(null);

    const formData = new FormData(form);
    const payload = {
      email: formData.get("email"),
      password: formData.get("password")
    };

    if (isSignup) {
      payload.fullName = formData.get("fullName");
      payload.phone = formData.get("phone");
    }

    try {
      const response = await fetch(isSignup ? "/api/auth/signup" : "/api/auth/signin", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "The account request failed.");
      }

      setStatus({
        kind: "success",
        message: isSignup
          ? `Account created for ${result.user.email}.`
          : `Signed in as ${result.user.email}.`
      });
      form.reset();
      router.push("/account");
      router.refresh();
    } catch (error) {
      setStatus({ kind: "error", message: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card">
      <div className="auth-tabs" aria-label="Account mode">
        <button
          className={!isSignup ? "active" : ""}
          onClick={() => {
            setMode("signin");
            setStatus(null);
          }}
          type="button"
        >
          Sign in
        </button>
        <button
          className={isSignup ? "active" : ""}
          onClick={() => {
            setMode("signup");
            setStatus(null);
          }}
          type="button"
        >
          Create account
        </button>
      </div>

      <div>
        <p className="eyebrow">{isSignup ? "New Account" : "Welcome Back"}</p>
        <p>{isSignup ? "Create your Yo's account." : "Sign in to continue your order."}</p>
      </div>

      <form
        onSubmit={handleSubmit}
      >
        {isSignup && (
          <label>
            Full name
            <span>
              <UserRound size={18} />
              <input autoComplete="name" name="fullName" placeholder="Your name" required type="text" />
            </span>
          </label>
        )}
        <label>
          Email
          <span>
            <Mail size={18} />
            <input autoComplete="email" name="email" placeholder="you@example.com" required type="email" />
          </span>
        </label>
        {isSignup && (
          <label>
            Phone
            <span>
              <Phone size={18} />
              <input autoComplete="tel" name="phone" placeholder="Best contact number" required type="tel" />
            </span>
          </label>
        )}
        <label>
          Password
          <span>
            <input
              autoComplete={isSignup ? "new-password" : "current-password"}
              name="password"
              placeholder="Password"
              required
              type="password"
            />
          </span>
        </label>
        <button disabled={submitting} type="submit">
          {submitting ? "Working..." : isSignup ? "Create account" : "Sign in"}
        </button>
        {status && (
          <p className={`form-status ${status.kind}`} role="status">
            {status.message}
          </p>
        )}
      </form>
    </section>
  );
}
