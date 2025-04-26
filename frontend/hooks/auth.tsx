import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { useTRPC } from "../../trpc/react";
import { useNavigate } from "@tanstack/react-router";

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

const AuthContext = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
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

  const trpc = useTRPC();

  const authenticateQuery = useQuery(
    trpc.authenticate.queryOptions(
      {
        id: metadata?.id || "",
        token: metadata?.token || "",
        expiresAt: metadata?.expiresAt || "",
      },
      {
        enabled: !!metadata,
      },
    ),
  );
  const loginMutation = useMutation(trpc.login.mutationOptions());
  const signupMutation = useMutation(trpc.signup.mutationOptions());
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

      return data?.isAuthenticated || false;
    } catch (error) {
      console.error("Error retrieving local storage data:", error);
      return false;
    }
  };

  const login = async (email: string, password: string) => {
    const result = await loginMutation.mutateAsync({
      email,
      password,
    });

    if (result.isAuthenticated) {
      setAuthMetadata({
        token: result.token,
        expiresAt: result.expiresAt,
        id: result.id,
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
      queryKey: trpc.authenticate.queryKey(),
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
      email,
      password,
      firstName,
      lastName,
    });

    if (result) {
      setAuthMetadata({
        token: result.passwordHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        id: result.id,
      });

      return true;
    }

    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        authenticate,
        login,
        logout,
        signup,
        token: metadata?.token || null,
        id: metadata?.id || null,
        expiresAt: metadata?.expiresAt || null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
