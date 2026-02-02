import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Lock, AlertCircle } from "lucide-react";

/**
 * shadcn login-03 style form: email/password, forgot password, remember me.
 * Branding (logo, company name, tagline) and auth logic stay in the page; this component is presentational + form submit.
 */
export function LoginForm({
  className,
  // Branding (for optional display inside card)
  companyName = "Fleet Compliance Portal",
  loginTagline = "Sign in to access your dashboard",
  primaryColor,
  // Form state (controlled by parent)
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
  // Handlers
  onSubmitLogin,
  onSubmitForgotPassword,
  supportEmail,
  termsUrl,
  privacyUrl,
  ...props
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            {/* Forgot password: {showForgotPassword ? "Enter your email to receive a password reset link" : loginTagline} */}
            {loginTagline}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Forgot password form - commented out for now
          {showForgotPassword ? (
            <form onSubmit={onSubmitForgotPassword} className="space-y-0">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="reset-email">Email</FieldLabel>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </Field>
                <Field>
                  <Button
                    type="submit"
                    className="w-full"
                    style={primaryColor ? { backgroundColor: primaryColor } : undefined}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                  <FieldDescription className="text-center">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => setShowForgotPassword(false)}
                    >
                      Back to login
                    </button>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          ) : (
          */}
            <form onSubmit={onSubmitLogin} className="space-y-0">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </Field>
                <Field>
                  <div className="flex items-center">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    {/* Forgot password link - commented out for now
                    <button
                      type="button"
                      className="ml-auto text-sm text-primary underline-offset-4 hover:underline"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      Forgot your password?
                    </button>
                    */}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </Field>
                {/* Remember me - commented out for now
                <Field orientation="horizontal">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={setRememberMe}
                  />
                  <Label htmlFor="remember" className="cursor-pointer text-sm font-normal">
                    Remember me
                  </Label>
                </Field>
                */}
                <Field>
                  <Button
                    type="submit"
                    className="w-full"
                    style={primaryColor ? { backgroundColor: primaryColor } : undefined}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Login"
                    )}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          {/* )} */}

          <FieldDescription className="mt-6 border-t pt-6 text-center">
            {supportEmail ? (
              <>
                Need help? Contact{" "}
                <a href={`mailto:${supportEmail}`} className="underline hover:text-foreground">
                  {supportEmail}
                </a>
              </>
            ) : (
              "Powered by ELORA Solutions"
            )}
            {(termsUrl || privacyUrl) && (
              <span className="block mt-2">
                By continuing, you agree to our{" "}
                {termsUrl && (
                  <a href={termsUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                    Terms of Service
                  </a>
                )}
                {termsUrl && privacyUrl && " and "}
                {privacyUrl && (
                  <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                    Privacy Policy
                  </a>
                )}
                .
              </span>
            )}
          </FieldDescription>
        </CardContent>
      </Card>
    </div>
  );
}
