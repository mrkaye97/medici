import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { components } from "schema";

function isIntegerish(x: unknown): boolean {
  const n = Number(x);
  return !Number.isNaN(n) && Number.isInteger(n);
}

export function useAuth() {
  const [authState, setAuthState] = useState<{
    isAuthenticated: boolean;
    token: string | null;
    id: string | null;
    expiresAt: string | null;
    isLoading: boolean;
  }>({
    isAuthenticated: false,
    token: null,
    id: null,
    expiresAt: null,
    isLoading: true, // Add loading state
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Read from localStorage only once at initialization or when explicitly refreshed
  const refreshAuthFromStorage = () => {
    try {
      const token = localStorage.getItem("token");
      const expiresAt = localStorage.getItem("expiresAt");
      const id = localStorage.getItem("id");

      const isTokenValid = isTokenUnexpired(expiresAt);

      setAuthState({
        isAuthenticated: !!(token && isTokenValid),
        token: token || null,
        id: id || null,
        expiresAt: expiresAt || null,
        isLoading: false,
      });

      return {
        token,
        id,
        isAuthenticated: !!(token && isTokenValid),
      };
    } catch {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      return { token: null, id: null, isAuthenticated: false };
    }
  };

  const isTokenUnexpired = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return false;

    let expiresAtDate: Date;
    if (isIntegerish(expiresAt)) {
      expiresAtDate = new Date(parseInt(expiresAt));
    } else {
      try {
        expiresAtDate = new Date(expiresAt);
      } catch {
        return false;
      }
    }

    return expiresAtDate > new Date();
  };

  // Load auth state from storage on initial mount
  useEffect(() => {
    refreshAuthFromStorage();
  }, []);

  // Setup auth verification query with proper dependencies
  const { data: authData, refetch: refetchAuth } = apiClient.useQuery(
    "get",
    "/api/authenticate/{member_id}",
    {
      params: {
        query: {
          token: authState.token || "",
        },
        path: {
          member_id: authState.id || "",
        },
      },
    },
    {
      enabled: !!authState.token && !!authState.id && !authState.isLoading,
      onSuccess: (data: components["schemas"]["AuthResult"]) => {
        if (data?.is_authenticated) {
          setAuthState((prev) => ({
            ...prev,
            isAuthenticated: true,
            token: data.token || prev.token,
            id: data.id || prev.id,
          }));
        } else if (authState.isAuthenticated) {
          // Token is invalid, clean up
          logout();
        }
      },
    }
  );

  const loginMutation = apiClient.useMutation("post", "/api/login");
  const signupMutation = apiClient.useMutation("post", "/api/signup");

  const setAuthMetadata = ({
    token,
    expiresAt,
    id,
  }: {
    token: string;
    expiresAt: string;
    id: string;
  }) => {
    localStorage.setItem("token", token);
    localStorage.setItem("expiresAt", expiresAt);
    localStorage.setItem("id", id);

    // Update state synchronously with storage
    setAuthState({
      isAuthenticated: true,
      token,
      id,
      expiresAt,
      isLoading: false,
    });
  };

  const login = async (email: string, password: string) => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true }));

      const result = await loginMutation.mutateAsync({
        body: { email, password },
      });

      if (result.is_authenticated) {
        const expiresAt = (Date.now() + 7 * 24 * 60 * 60 * 1000).toString();

        // First update state and localStorage
        setAuthMetadata({
          token: result.token || "",
          expiresAt,
          id: result.id || "",
        });

        // Then invalidate queries
        await queryClient.invalidateQueries();

        // Then navigate
        navigate({ to: "/" });

        return true;
      }

      setAuthState((prev) => ({ ...prev, isLoading: false }));
      return false;
    } catch (error) {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const logout = async () => {
    // First update state
    setAuthState({
      isAuthenticated: false,
      token: null,
      id: null,
      expiresAt: null,
      isLoading: false,
    });

    // Then clear storage
    localStorage.removeItem("token");
    localStorage.removeItem("expiresAt");
    localStorage.removeItem("id");

    // Then invalidate queries
    await queryClient.invalidateQueries();

    // Then navigate
    navigate({ to: "/login" });
  };

  const signup = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true }));

      const result = await signupMutation.mutateAsync({
        body: {
          email,
          password,
          first_name: firstName,
          last_name: lastName,
        },
      });

      if (result && result.token) {
        const expiresAt = new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString();

        // First update state and localStorage
        setAuthMetadata({
          token: result.token,
          expiresAt,
          id: result.id || "",
        });

        // Then invalidate queries
        await queryClient.invalidateQueries();

        // Then navigate
        navigate({ to: "/" });

        return true;
      }

      setAuthState((prev) => ({ ...prev, isLoading: false }));
      return false;
    } catch (error) {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  return {
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    authenticate: refreshAuthFromStorage,
    login,
    logout,
    signup,
    refetchAuth,
    token: authState.token,
    id: authState.id,
    expiresAt: authState.expiresAt,
  };
}
