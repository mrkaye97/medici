import { LoginForm } from "@/components/login-form";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { z } from "zod";
import { useAuth } from "@/hooks/auth";
import { useState } from "react";

const fallback = "/" as const;

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: z.object({
    redirect: z.string().optional().catch(""),
  }),
});

function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const [isError, setIsError] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={fallback} />;
  }

  return (
    <div className="flex flex-col justify-center items-center h-full pt-12">
      <LoginForm
        onSubmit={async (e) => {
          setIsError(false);
          const email = e.currentTarget.email.value as string;
          const password = e.currentTarget.password.value as string;

          const result = await login(email, password);

          if (!result) {
            setIsError(true);
          }
        }}
        formType="login"
        hasError={isError}
      />
    </div>
  );
}
