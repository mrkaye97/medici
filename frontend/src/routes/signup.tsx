import { LoginForm } from "../components/login-form";

import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "../hooks/auth";
import { z } from "zod";

const fallback = "/" as const;

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  validateSearch: z.object({
    redirect: z.string().optional().catch(""),
  }),
});

export default function SignupPage() {
  const { isAuthenticated, signup } = useAuth();

  console.log("Rendering signup page", fallback);

  if (isAuthenticated) {
    return <Navigate to={fallback} />;
  }

  return (
    <div className="flex flex-col justify-center items-center h-full">
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
