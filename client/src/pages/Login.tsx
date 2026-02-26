import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, register, isLoggingIn, isRegistering } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegisterMode && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      if (isRegisterMode) {
        await register({ username, password });
      } else {
        await login({ username, password });
      }
      setLocation("/");
    } catch (err: any) {
      const message = err?.message || "Something went wrong";
      // Extract error message from API response JSON
      try {
        const jsonMatch = message.match(/\d+:\s*(.+)/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          setError(parsed.message || jsonMatch[1]);
        } else {
          setError(message);
        }
      } catch {
        const match = message.match(/\d+:\s*(.+)/);
        setError(match ? match[1] : message);
      }
    }
  };

  const switchMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setError(null);
    setConfirmPassword("");
  };

  const isSubmitting = isLoggingIn || isRegistering;

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
            {isRegisterMode ? "Create an account to get started" : "Sign in to manage your budget"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete={isRegisterMode ? "new-password" : "current-password"}
              />
            </div>
            {isRegisterMode && (
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
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? (isRegisterMode ? "Creating account..." : "Signing in...")
                : (isRegisterMode ? "Create Account" : "Sign In")
              }
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {isRegisterMode ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Create one
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
