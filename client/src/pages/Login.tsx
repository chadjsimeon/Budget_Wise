import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, register, forgotPassword, isLoggingIn, isRegistering, isSendingReset } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const parseError = (err: any): string => {
    const message = err?.message || "Something went wrong";
    try {
      const jsonMatch = message.match(/\d+:\s*(.+)/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return parsed.message || jsonMatch[1];
      }
    } catch {
      const match = message.match(/\d+:\s*(.+)/);
      if (match) return match[1];
    }
    return message;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    try {
      if (mode === "forgot") {
        await forgotPassword(email);
        setSuccessMessage("If an account exists with that email, a reset link has been sent.");
        return;
      }

      if (mode === "register" && password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      if (mode === "register") {
        await register({ email, password });
      } else {
        await login({ email, password });
      }
      setLocation("/");
    } catch (err: any) {
      setError(parseError(err));
    }
  };

  const switchMode = (newMode: "login" | "register" | "forgot") => {
    setMode(newMode);
    setError(null);
    setSuccessMessage(null);
    setPassword("");
    setConfirmPassword("");
  };

  const isSubmitting = isLoggingIn || isRegistering || isSendingReset;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center shadow-lg p-2">
              <img
                src="/tt-coat-of-arms.png"
                alt="Trinidad and Tobago Coat of Arms"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <CardTitle className="text-2xl">Budget Wise</CardTitle>
          <CardDescription>
            {mode === "login" && "Sign in to manage your budget"}
            {mode === "register" && "Create an account to get started"}
            {mode === "forgot" && "Enter your email to reset your password"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                autoFocus
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                />
              </div>
            )}
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  autoComplete="new-password"
                />
              </div>
            )}
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md dark:bg-green-950 dark:text-green-400">
                {successMessage}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {mode === "login" && (isLoggingIn ? "Signing in..." : "Sign In")}
              {mode === "register" && (isRegistering ? "Creating account..." : "Create Account")}
              {mode === "forgot" && (isSendingReset ? "Sending..." : "Send Reset Link")}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground space-y-1">
            {mode === "login" && (
              <>
                <div>
                  Don't have an account?{" "}
                  <button type="button" onClick={() => switchMode("register")} className="text-primary underline-offset-4 hover:underline">
                    Create one
                  </button>
                </div>
                <div>
                  <button type="button" onClick={() => switchMode("forgot")} className="text-primary underline-offset-4 hover:underline">
                    Forgot password?
                  </button>
                </div>
              </>
            )}
            {mode === "register" && (
              <div>
                Already have an account?{" "}
                <button type="button" onClick={() => switchMode("login")} className="text-primary underline-offset-4 hover:underline">
                  Sign in
                </button>
              </div>
            )}
            {mode === "forgot" && (
              <div>
                Remember your password?{" "}
                <button type="button" onClick={() => switchMode("login")} className="text-primary underline-offset-4 hover:underline">
                  Sign in
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
