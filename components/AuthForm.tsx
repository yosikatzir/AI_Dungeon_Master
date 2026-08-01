"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Link from "next/link";

interface AuthFormProps {
  mode: "login" | "register";
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isRegister = mode === "register";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="font-serif text-2xl text-amber-100">
        {isRegister ? "Create an account" : "Welcome back"}
      </h1>
      <p className="mt-1 text-sm text-amber-200/60">
        {isRegister
          ? "Set up a family account for Family Table."
          : "Log in to continue your adventures."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-amber-200/80">
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={24}
            autoComplete="username"
            className="rounded-md border border-amber-700/40 bg-black/30 px-3 py-2 text-amber-50 outline-none focus:border-amber-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-amber-200/80">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={isRegister ? "new-password" : "current-password"}
            className="rounded-md border border-amber-700/40 bg-black/30 px-3 py-2 text-amber-50 outline-none focus:border-amber-500"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-md bg-amber-700 px-4 py-2 font-medium text-amber-50 hover:bg-amber-600 disabled:opacity-50"
        >
          {pending
            ? "Please wait…"
            : isRegister
              ? "Create account"
              : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-amber-200/60">
        {isRegister ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-amber-300 underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/register" className="text-amber-300 underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
