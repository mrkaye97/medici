import { LoginForm } from "~/components/login-form";

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuth } from "~/hooks/auth";
import { z } from "zod";
import { useTRPC } from "~/trpc/react";

const fallback = "/" as const;

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: z.object({
    redirect: z.string().optional().catch(""),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: search.redirect || fallback });
    }
  },
});

export default function LoginPage() {
  const { login } = useAuth();
  const trpc = useTRPC();

  const key = trpc.authenticate.queryKey({
    id: "uuid",
    token: "token",
    expiresAt: "expiresAt",
  });
  console.log("Query key", key);

  return (
    <div className="flex flex-col justify-center items-center h-full mt-24">
      <LoginForm
        onSubmit={async (e) => {
          const email = e.currentTarget.email.value as string;
          const password = e.currentTarget.password.value as string;

          await login(email, password);
        }}
      />
    </div>
  );
}
