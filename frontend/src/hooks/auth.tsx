import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

export function useAuth() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [memberId, setMemberId] = useState(localStorage.getItem("memberId"));
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    setIsAuthenticated(!!token);
  }, [token]);

  const loginMutation = apiClient.useMutation("post", "/api/login");

  const signupMutation = apiClient.useMutation("post", "/api/signup");

  const setAuthMetadata = async ({
    token,
    memberId,
  }: {
    token: string;
    memberId: string;
  }) => {
    localStorage.setItem("token", token);
    localStorage.setItem("memberId", memberId);

    setToken(token);
    setMemberId(memberId);

    await queryClient.invalidateQueries();
  };

  const clearAuthMetadata = async () => {
    setToken(null);
    setMemberId(null);
    localStorage.removeItem("token");
    localStorage.removeItem("memberId");

    await queryClient.invalidateQueries();
  };

  const login = async (email: string, password: string) => {
    try {
      const result = await loginMutation.mutateAsync({
        body: { email, password },
      });

      if (result.is_authenticated && result.token && result.id) {
        await setAuthMetadata({
          token: result.token,
          memberId: result.id,
        });

        navigate({ to: "/", reloadDocument: true });

        return true;
      }

      return false;
    } catch {
      await clearAuthMetadata();
      return false;
    }
  };

  const logout = async () => {
    await clearAuthMetadata();

    navigate({ to: "/login", reloadDocument: true });
  };

  const signup = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => {
    try {
      const result = await signupMutation.mutateAsync({
        body: {
          email,
          password,
          first_name: firstName,
          last_name: lastName,
        },
      });

      if (result.is_authenticated && result.token && result.id) {
        await setAuthMetadata({
          token: result.token,
          memberId: result.id,
        });

        navigate({ to: "/", reloadDocument: true });

        return true;
      }

      return false;
    } catch {
      await clearAuthMetadata();

      return false;
    }
  };

  const createAuthHeader = () => {
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  return {
    isAuthenticated,
    login,
    logout,
    signup,
    createAuthHeader,
    token,
    memberId,
  };
}
