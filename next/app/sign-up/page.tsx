"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getAuthErrorMessage,
  isAuthRateLimitError,
  validateSignUpForm,
} from "@/lib/auth-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";

const AUTH_RATE_LIMIT_COOLDOWN_MS = 3 * 60 * 1000;

function formatCooldown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(0);

  const cooldownRemainingMs = Math.max(0, cooldownUntil - now);
  const cooldownActive = cooldownRemainingMs > 0;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/dashboard");
        return;
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!cooldownActive) return;

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [cooldownActive]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || cooldownActive) return;

    const validationError = validateSignUpForm({
      name,
      email,
      password,
      confirmPassword,
    });

    if (validationError) {
      setError(validationError);
      setMessage("");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const { data, error: signUpError } = await createClient().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim() },
        },
      });

      if (signUpError) {
        if (isAuthRateLimitError(signUpError.message)) {
          setNow(Date.now());
          setCooldownUntil(Date.now() + AUTH_RATE_LIMIT_COOLDOWN_MS);
        }
        setError(getAuthErrorMessage(signUpError.message));
        return;
      }
      if (!data.session) {
        setMessage("Account created. Check your email to confirm it, then sign in.");
        setPassword("");
        setConfirmPassword("");
        return;
      }

      router.replace("/onboarding");
      router.refresh();
    } catch (error) {
      setError(getAuthErrorMessage(error instanceof Error ? error.message : "Sign-in failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md flex flex-col gap-5 p-6">
          <Skeleton className="mx-auto size-12 rounded-xl" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6 shadow-sm">
        <form onSubmit={handleSubmit}>
          <FieldGroup>
          <div className="flex flex-col gap-2 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Wallet className="size-6" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Create account</h1>
            <p className="text-sm text-muted-foreground">
              Start fresh with email and password.
            </p>
          </div>

          {error ? (
            <div role="alert" aria-live="polite" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
              {message}
            </div>
          ) : null}

          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={6}
                className="pr-10"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={6}
                className="pr-10"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShowConfirmPassword((current) => !current)}
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </Field>

          <Button className="w-full" type="submit" disabled={submitting || cooldownActive}>
            {submitting
              ? "Creating account..."
              : cooldownActive
                ? `Try again in ${formatCooldown(cooldownRemainingMs)}`
                : "Create account"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link className="font-medium text-primary hover:underline" href="/sign-in">
              Sign in
            </Link>
          </p>
          </FieldGroup>
        </form>
      </Card>
    </div>
  );
}
