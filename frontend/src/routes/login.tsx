import { LoginForm } from "@/components/login-form";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { z } from "zod";
import { useAuth } from "@/hooks/auth";

const fallback = "/" as const;

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: z.object({
    redirect: z.string().optional().catch(""),
  }),
});

function LoginPage() {
  const { isAuthenticated, login } = useAuth();

  if (isAuthenticated) {
    return null;
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
