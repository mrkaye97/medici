import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { apiClient } from "@/api/client";

export interface AuthContext {
  isAuthenticated: boolean;
  authenticate: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  signup: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => Promise<boolean>;
  token: string | null;
  id: string | null;
  expiresAt: string | null;
}

export function useAuth() {
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
        isAuthenticated:
          (token && expiresAt && new Date(expiresAt) > new Date()) === true,
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
    "/api/authenticate",
    {
      params: {
        query: {
          id: metadata?.id || "",
          token: metadata?.token || "",
        },
      },
    },
    {
      enabled: !!metadata,
    },
  );

  const loginMutation = apiClient.useMutation("post", "/api/login");
  const signupMutation = apiClient.useMutation("post", "/api/signup");

  const navigate = useNavigate();
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
      console.error("Error retrieving local storage data:", error);
      return false;
    }
  };

  const login = async (email: string, password: string) => {
    const result = await loginMutation.mutateAsync({
      body: {
        email,
        password,
      },
    });

    if (result.is_authenticated) {
      setAuthMetadata({
        token: result.token || "",
        expiresAt: (Date.now() + 7 * 24 * 60 * 60 * 1000).toString(),
        id: result.id || "",
      });

      return true;
    } else {
      return false;
    }
  };

  const logout = async () => {
    localStorage.removeItem("token");
    localStorage.removeItem("expiresAt");
    localStorage.removeItem("id");

    await queryClient.invalidateQueries({
      queryKey: ["get", "/api/authenticate"],
    });

    navigate({
      to: "/login",
    });
  };

  const signup = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => {
    const result = await signupMutation.mutateAsync({
      body: {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (result) {
      setAuthMetadata({
        token: result.token || "",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        id: result.id || "",
      });

      return true;
    }

    return false;
  };

  return {
    isAuthenticated,
    authenticate,
    login,
    logout,
    signup,
    token: metadata?.token || null,
    id: metadata?.id || null,
    expiresAt: metadata?.expiresAt || null,
  };
}
