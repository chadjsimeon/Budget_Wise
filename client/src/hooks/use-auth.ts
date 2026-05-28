import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useStore } from "@/lib/store";

interface User {
  id: string;
  email: string;
}

interface Credentials {
  email: string;
  password: string;
}

// Persisted identity used only to keep a previously-authenticated user signed in
// while offline. The server still enforces auth on every request; this only
// affects client-side routing so the app can open from cached/local data.
const LAST_USER_KEY = "bw-last-user";

function readLastUser(): User | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeLastUser(user: User | null) {
  try {
    if (user) localStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(LAST_USER_KEY);
  } catch {
    /* ignore */
  }
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn<User | null>({ on401: "returnNull" }),
    staleTime: Infinity,
    retry: false,
  });

  // Record the identity on a definitive response: persist on a real user, clear
  // on a confirmed 401 (user === null). A network error leaves user undefined,
  // in which case we keep the last-known identity for offline pass-through.
  useEffect(() => {
    if (user) writeLastUser(user);
    else if (user === null) writeLastUser(null);
  }, [user]);

  // Offline fallback: the auth check failed with a network/server error (not a
  // 401, which resolves to null without an error) but we have a cached identity.
  const cachedUser = user === undefined && error ? readLastUser() : null;
  const effectiveUser = user ?? cachedUser;

  const loginMutation = useMutation({
    mutationFn: async (credentials: Credentials) => {
      const res = await apiRequest("POST", "/api/auth/login", credentials);
      return res.json() as Promise<User>;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/user"], user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: Credentials) => {
      const res = await apiRequest("POST", "/api/auth/register", credentials);
      return res.json() as Promise<User>;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/user"], user);
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email });
      return res.json() as Promise<{ message: string }>;
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", { token, password });
      return res.json() as Promise<{ message: string }>;
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["/api/budget-data"] });
      queryClient.setQueryData(["/api/auth/user"], null);
      writeLastUser(null);
      useStore.getState().clearState();
    },
  });

  return {
    user: effectiveUser,
    isLoading,
    isAuthenticated: !!effectiveUser,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    forgotPassword: forgotPasswordMutation.mutateAsync,
    resetPassword: resetPasswordMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isSendingReset: forgotPasswordMutation.isPending,
    isResettingPassword: resetPasswordMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}
