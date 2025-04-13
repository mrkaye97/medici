import { LoginForm } from "~/components/login-form";

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

export default function LoginPage() {
  return (
    <div className="flex flex-col justify-center items-center h-full mt-24">
      <LoginForm />
    </div>
  );
}
