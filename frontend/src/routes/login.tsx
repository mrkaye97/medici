import { LoginForm } from "../components/login-form";

import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "../hooks/auth";
import { z } from "zod";

const fallback = "/" as const;

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: z.object({
    redirect: z.string().optional().catch(""),
  }),
});

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();

  if (isAuthenticated) {
    return <Navigate to={fallback} />;
  }

  return (
    <div className="flex flex-col justify-center items-center h-full">
      <LoginForm
        onSubmit={async (e) => {
          const email = e.currentTarget.email.value as string;
          const password = e.currentTarget.password.value as string;

          await login(email, password);
        }}
        formType="login"
      />
    </div>
  );
}
