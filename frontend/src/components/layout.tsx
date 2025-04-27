"use client";

import * as React from "react";
import { useAuth } from "../hooks/auth";
import { HandCoinsIcon, LogOut, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CreatePoolModal } from "@/components/create-pool-modal";
import { apiClient } from "@/api/client";
import Link from "next/link";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

function App({ children }: { children: React.ReactNode }) {
  console.log("Rendering InnerApp");
  const { isAuthenticated, id, logout } = useAuth();
  const [isCreatePoolOpen, setIsCreatePoolOpen] = React.useState(false);
  const { data: member } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}",
    {
      params: { path: { member_id: id || "" } },
    },
    {
      enabled: !!id,
    }
  );

  const email = member?.email;

  return (
    <div className="h-screen w-screen flex flex-row">
      <CreatePoolModal
        isOpen={isCreatePoolOpen}
        setIsOpen={setIsCreatePoolOpen}
      />
      <div
        className="w-64 bg-gray-100 border-r p-4 flex flex-col justify-start items-start h-screen"
        style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
      >
        <h2 className="text-lg font-semibold mb-4 flex flex-row gap-x-2 items-center">
          <HandCoinsIcon className="size-6 text-green-800" />
          Medici
        </h2>
        <div className="text-sm text-gray-700 flex flex-col w-full">
          <Link href="/">
            <Button variant="ghost" className="w-full justify-start py-1">
              Dashboard
            </Button>
          </Link>
          <Link href="/friends">
            <Button variant="ghost" className="w-full justify-start py-1">
              Friends
            </Button>
          </Link>
          {isAuthenticated && (
            <>
              <Separator className="my-2" />
              <Button
                variant="ghost"
                onClick={async () => {
                  setIsCreatePoolOpen(true);
                }}
                className="w-full justify-start py-1"
              >
                <PlusCircle className="size-4" /> Create a pool
              </Button>
            </>
          )}
          {isAuthenticated && (
            <Button
              variant="ghost"
              onClick={() => {
                logout();
              }}
              className="w-full justify-start py-1"
            >
              <LogOut className="size-4" /> Log Out
            </Button>
          )}
          <p className="pl-4 pt-4">{email}</p>
        </div>
      </div>

      <main className="flex-1 relative">{children}</main>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <App>{children}</App>
    </QueryClientProvider>
  );
}
