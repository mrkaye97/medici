import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PoolSummary } from "../components/pool-summay";
import { Spinner } from "../components/ui/spinner";
import { useAuth } from "../hooks/auth";
import { $api } from "src/api";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { isAuthenticated, id, token } = useAuth();

  const { data, isLoading, isFetching } = $api.useQuery(
    "get",
    "/api/members/{member_id}/pools",
    {
      params: {
        path: {
          member_id: id || "",
        },
      },
    },
    {
      enabled: !!id,
    }
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
            <PoolSummary key={p.id} poolId={p.id} />
          ))}
        </div>
      </div>
    </div>
  );
}
