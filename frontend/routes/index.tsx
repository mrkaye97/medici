import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PoolSummary } from "../components/pool-summay";
import { Spinner } from "../components/ui/spinner";
import { useAuth } from "../hooks/auth";
import { useTRPC } from "../../trpc/react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const trpc = useTRPC();
  const { isAuthenticated, id, token } = useAuth();

  const { data, isLoading, isFetching } = useQuery(
    trpc.listPoolsForMember.queryOptions(
      { memberId: id || "" },
      {
        enabled: !!id,
      },
    ),
  );
  const pools = data || [];

  if (!isAuthenticated || !id || !token) {
    return (
      <Navigate
        to="/login"
        params={{
          redirect: "/",
        }}
      />
    );
  }

  if (isLoading || isFetching) {
    return (
      <div className="flex flex-col items-center">
        <Spinner className="mt-8" />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center">
      <div className="w-1/2 my-8">
        <div className="flex flex-col gap-y-4">
          {pools.map((p) => (
            <PoolSummary key={p.id} pool={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
