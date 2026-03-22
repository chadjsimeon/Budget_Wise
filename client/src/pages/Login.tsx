import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { requestOtp, verifyOtp, isRequestingOtp, isVerifyingOtp } = useAuth();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await requestOtp(email);
      setStep("otp");
    } catch (err: any) {
      setError(parseError(err));
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await verifyOtp({ email, code });
      setLocation("/");
    } catch (err: any) {
      setError(parseError(err));
    }
  };

  const handleBack = () => {
    setStep("email");
    setCode("");
    setError(null);
  };

  const isSubmitting = isRequestingOtp || isVerifyingOtp;

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
            {step === "email"
              ? "Enter your email to sign in or create an account"
              : `Enter the code sent to ${email}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
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
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isRequestingOtp ? "Sending code..." : "Continue"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp-code">Verification Code</Label>
                <Input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  required
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting || code.length !== 6}>
                {isVerifyingOtp ? "Verifying..." : "Sign In"}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Use a different email
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
