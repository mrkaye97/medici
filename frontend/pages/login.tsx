"use client";

import { LoginForm } from "../src/components/login-form";

import { useAuth } from "../src/hooks/auth";
import { Suspense } from "react";

export default function LoginPage() {
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
