import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { components } from "schema";

export function useAuth() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [memberId, setMemberId] = useState(localStorage.getItem("memberId"));

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: authData, refetch: refetchAuth } = apiClient.useQuery(
    "get",
    "/api/authenticate/{member_id}",
    {
      params: {
        query: {
          token: token || "",
        },
        path: {
          member_id: memberId || "",
        },
      },
    },
    {
      enabled: !!token && !!memberId,
      onSuccess: (data: components["schemas"]["AuthResult"]) => {
        if (data.is_authenticated && data.token && data.id) {
          setAuthMetadata({
            token: data.token,
            memberId: data.id,
          });
        }
      },
    }
  );

  const loginMutation = apiClient.useMutation("post", "/api/login");
  const signupMutation = apiClient.useMutation("post", "/api/signup");

  const setAuthMetadata = ({
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
  };

  const login = async (email: string, password: string) => {
    try {
      const result = await loginMutation.mutateAsync({
        body: { email, password },
      });

      if (result.is_authenticated && result.token && result.id) {
        setAuthMetadata({
          token: result.token,
          memberId: result.id,
        });
        await queryClient.invalidateQueries();

        navigate({ to: "/" });

        return true;
      }

      return false;
    } catch (error) {
      setToken(null);
      setMemberId(null);
      return false;
    }
  };

  const logout = async () => {
    setToken(null);
    setMemberId(null);

    localStorage.removeItem("token");
    localStorage.removeItem("expiresAt");
    localStorage.removeItem("id");

    await queryClient.invalidateQueries();

    navigate({ to: "/login" });
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
        setAuthMetadata({
          token: result.token,
          memberId: result.id,
        });
        await queryClient.invalidateQueries();

        navigate({ to: "/" });

        return true;
      }

      return false;
    } catch (error) {
      setToken(null);
      setMemberId(null);

      return false;
    }
  };

  const createAuthHeader = () => {
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  return {
    isAuthenticated: token !== null,
    login,
    logout,
    signup,
    refetchAuth,
    createAuthHeader,
    token,
    memberId,
  };
}
