import { LoginForm } from "@/components/login-form";

import { useAuth } from "@/hooks/use-auth";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { z } from "zod";

const fallback = "/" as const;

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  validateSearch: z.object({
    redirect: z.string().optional().catch(""),
  }),
});

function SignupPage() {
  const { isAuthenticated, signup } = useAuth();

  if (isAuthenticated) {
    return <Navigate to={fallback} />;
  }

  return (
    <div className="flex flex-col justify-center items-center h-full pt-12">
      <LoginForm
        onSubmit={async (e) => {
          const email = e.currentTarget.email.value as string;
          const password = e.currentTarget.password.value as string;
          const firstName = e.currentTarget.firstName.value as string;
          const lastName = e.currentTarget.lastName.value as string;

          await signup(email, password, firstName, lastName);
        }}
        formType="signup"
      />
    </div>
  );
}
