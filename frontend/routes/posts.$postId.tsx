import { useQuery } from "@tanstack/react-query";
import { createFileRoute, ErrorComponent } from "@tanstack/react-router";
import { NotFound } from "../components/NotFound";
import { useTRPC } from "../../trpc/react";

export const Route = createFileRoute("/posts/$postId")({
  loader: async ({ params: { postId }, context }) => {
    const data = await context.queryClient.ensureQueryData(
      context.trpc.listPoolsForMember.queryOptions(postId)
    );

    return { pools: data };
  },
  errorComponent: ({ error }) => <ErrorComponent error={error} />,
  notFoundComponent: () => {
    return <NotFound>Post not found</NotFound>;
  },
  component: PostComponent,
});

function PostComponent() {
  const { postId } = Route.useParams();
  const trpc = useTRPC();

  const membersQuery = useQuery(trpc.listPoolsForMember.queryOptions(postId));

  return (
    <div className="space-y-2">
      <h4 className="text-xl font-bold underline">
        {JSON.stringify(membersQuery.data)}
      </h4>
    </div>
  );
}
