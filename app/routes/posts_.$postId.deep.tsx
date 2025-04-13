import { useQuery } from "@tanstack/react-query";
import { createFileRoute, ErrorComponent, Link } from "@tanstack/react-router";
import { useTRPC } from "~/trpc/react";

export const Route = createFileRoute("/posts_/$postId/deep")({
  loader: async ({ params: { postId }, context }) => {
    const data = await context.queryClient.ensureQueryData(
      context.trpc.listPoolsForMember.queryOptions(postId)
    );

    return { pools: data };
  },
  errorComponent: ({ error }) => <ErrorComponent error={error} />,
  component: PostDeepComponent,
});

function PostDeepComponent() {
  const { postId } = Route.useParams();
  const trpc = useTRPC();

  const membersQuery = useQuery(trpc.listPoolsForMember.queryOptions(postId));

  console.log("membersQuery", membersQuery);

  return (
    <div className="space-y-2 p-2">
      <Link
        to="/posts"
        className="block py-1 text-blue-800 hover:text-blue-600"
      >
        ← All Posts
      </Link>
      <h4 className="text-xl font-bold underline">
        {JSON.stringify(membersQuery.data)}
      </h4>
    </div>
  );
}
