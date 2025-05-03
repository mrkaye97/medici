import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

function isIntegerish(x: unknown): boolean {
  const n = Number(x);
  return !Number.isNaN(n) && Number.isInteger(n);
}

export function useAuth() {
  const [initialRenderAt] = useState(() => new Date());
  const navigate = useNavigate();

  const getAuthMetadata = () => {
    try {
      const token = localStorage.getItem("token") as string;
      const expiresAt = localStorage.getItem("expiresAt") as string;
      const id = localStorage.getItem("id") as string;

      return {
        id,
        token,
        expiresAt,
      };
    } catch {
      return undefined;
    }
  };

  const isTokenUnexpired = (expiresAt: string | null | undefined) => {
    if (!expiresAt) {
      return false;
    }

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

    return expiresAtDate > initialRenderAt;
  };

  const isAlreadyAuthenticated = () => {
    try {
      const metadata = getAuthMetadata();

      if (!metadata) {
        return {
          isAuthenticated: false,
          metadata: {
            id: null,
            token: null,
            expiresAt: null,
          },
        };
      }

      const { token, expiresAt, id } = metadata;

      return {
        isAuthenticated: (token && isTokenUnexpired(expiresAt)) === true,
        metadata: {
          id,
          token,
          expiresAt,
        },
      };
    } catch {
      return {
        isAuthenticated: false,
        metadata: {
          id: null,
          token: null,
          expiresAt: null,
        },
      };
    }
  };

  const { isAuthenticated, metadata } = isAlreadyAuthenticated();

  const authenticateQuery = apiClient.useQuery(
    "get",
    "/api/authenticate/{member_id}",
    {
      params: {
        query: {
          token: metadata?.token || "",
        },
        path: {
          member_id: metadata?.id || "",
        },
      },
    },
    {
      enabled: !!metadata && !!metadata.token && !!metadata.id,
    }
  );

  const loginMutation = apiClient.useMutation("post", "/api/login");
  const signupMutation = apiClient.useMutation("post", "/api/signup");

  const queryClient = useQueryClient();

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
  };

  const authenticate = async () => {
    try {
      if (isAuthenticated) {
        return true;
      }

      if (!metadata || (!metadata.token && !metadata.expiresAt)) {
        return false;
      }

      const { data } = authenticateQuery;

      return data?.is_authenticated || false;
    } catch (error) {
      return false;
    }
  };

  const login = async (email: string, password: string) => {
    const result = await loginMutation.mutateAsync(
      {
        body: {
          email,
          password,
        },
      },
      {
        onSettled: async () => {
          await queryClient.invalidateQueries();
        },
      }
    );

    if (result.is_authenticated) {
      console.log("Authenticated", result, "Setting metadata");
      setAuthMetadata({
        token: result.token || "",
        expiresAt: (Date.now() + 7 * 24 * 60 * 60 * 1000).toString(),
        id: result.id || "",
      });

      navigate({
        to: "/",
      });
    }
  };

  const logout = async () => {
    localStorage.removeItem("token");
    localStorage.removeItem("expiresAt");
    localStorage.removeItem("id");

    await queryClient.invalidateQueries();

    navigate({
      to: "/login",
    });
  };

  const signup = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => {
    const result = await signupMutation.mutateAsync(
      {
        body: {
          email,
          password,
          first_name: firstName,
          last_name: lastName,
        },
      },
      {
        onSettled: async () => {
          console.log("Settled");
          await queryClient.invalidateQueries();
        },
      }
    );

    if (result) {
      setAuthMetadata({
        token: result.token || "",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        id: result.id || "",
      });

      navigate({
        to: "/",
      });

      return true;
    }

    return false;
  };

  return {
    isAuthenticated:
      isAuthenticated || authenticateQuery.data?.is_authenticated,
    authenticate,
    login,
    logout,
    signup,
    token: metadata?.token || authenticateQuery.data?.token || null,
    id: metadata?.id || authenticateQuery.data?.id || null,
    expiresAt: metadata?.expiresAt || null,
  };
}
