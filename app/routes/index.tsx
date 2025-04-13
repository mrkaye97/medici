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

  const { data, isLoading, isFetching, isError } = useQuery(
    trpc.listPoolsForMember.queryOptions(id)
  );

  if (isLoading || isFetching) {
    return (
      <div className="flex flex-col items-center">
        <Spinner className="mt-8" />
      </div>
    );
  }

  const { pools: poolsRaw, poolMembers: poolMembersRaw } = data || {};
  const pools = poolsRaw || [];
  const poolMembers = poolMembersRaw || [];

  return (
    <div className="flex flex-col items-center">
      <div className="w-1/2 mt-8">
        <div className="flex flex-col gap-y-4">
          {pools.map((p) => (
            <PoolSummary key={p.id} pool={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
