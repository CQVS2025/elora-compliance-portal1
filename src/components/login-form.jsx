import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, Lock, AlertCircle } from "lucide-react";

/**
 * Login form: email/password. Branding and auth logic stay in the page.
 */
export function LoginForm({
  className,
  companyName = "Fleet Compliance Portal",
  loginTagline = "Sign in to access your dashboard",
  primaryColor,
  email,
  setEmail,
  password,
  setPassword,
  rememberMe,
  setRememberMe,
  showForgotPassword,
  setShowForgotPassword,
  error,
  isLoading,
  onSubmitLogin,
  onSubmitForgotPassword,
  supportEmail,
  termsUrl,
  privacyUrl,
  ...props
}) {
  return (
    <div className={cn("flex flex-col gap-8", className)} {...props}>
      <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-xl shadow-black/5 dark:shadow-none dark:border-border/40">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {loginTagline}
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        <form onSubmit={onSubmitLogin} className="space-y-0">
          <FieldGroup className="gap-5">
            <Field className="gap-2">
              <FieldLabel htmlFor="email" className="text-foreground/90">
                Email
              </FieldLabel>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl border-border/80 bg-background/50 pl-10 text-base transition-colors focus-visible:ring-2 focus-visible:ring-primary/20"
                  required
                />
              </div>
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="password" className="text-foreground/90">
                Password
              </FieldLabel>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl border-border/80 bg-background/50 pl-10 text-base transition-colors focus-visible:ring-2 focus-visible:ring-primary/20"
                  required
                />
              </div>
            </Field>
            <Field className="pt-1">
              <Button
                type="submit"
                className="h-11 w-full rounded-xl font-medium text-primary-foreground shadow-sm transition-all hover:shadow-md disabled:opacity-70"
                style={primaryColor ? { backgroundColor: primaryColor } : undefined}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </Field>
          </FieldGroup>
        </form>

        <p className="mt-8 border-t border-border/50 pt-6 text-center text-xs text-muted-foreground">
          {supportEmail ? (
            <>
              Need help? Contact{" "}
              <a href={`mailto:${supportEmail}`} className="underline underline-offset-2 hover:text-foreground">
                {supportEmail}
              </a>
            </>
          ) : (
            "Powered by ELORA Solutions"
          )}
          {(termsUrl || privacyUrl) && (
            <span className="mt-2 block">
              By continuing, you agree to our{" "}
              {termsUrl && (
                <a href={termsUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                  Terms of Service
                </a>
              )}
              {termsUrl && privacyUrl && " and "}
              {privacyUrl && (
                <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                  Privacy Policy
                </a>
              )}
              .
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
