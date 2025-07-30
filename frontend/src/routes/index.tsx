import { apiClient } from "@/api/client"
import { CreatePoolModal } from "@/components/create-pool-modal"
import { FriendsView } from "@/components/friends-view"
import { PoolSummary } from "@/components/pool-summay"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { createFileRoute, Navigate } from "@tanstack/react-router"
import { PlusCircle, Wallet } from "lucide-react"
import { useState } from "react"

export const Route = createFileRoute("/")({
  component: Home,
})

function Home() {
  const { memberId, createAuthHeader, isAuthenticated } = useAuth()
  const [isCreatePoolOpen, setIsCreatePoolOpen] = useState(false)

  const {
    data,
    isLoading: isPoolsLoading,
    isFetching,
  } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}/pools",
    {
      params: {
        path: {
          member_id: memberId || "",
        },
      },
      headers: createAuthHeader(),
    },
    {
      enabled: !!memberId,
    }
  )

  const pools = data || []
  const isLoading = isPoolsLoading

  if (isLoading || isFetching) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  return (
    <div className="bg-background flex flex-col overflow-auto md:h-dvh md:flex-row md:overflow-hidden">
      <CreatePoolModal
        isOpen={isCreatePoolOpen}
        setIsOpen={setIsCreatePoolOpen}
      />
      <div className="flex flex-col overflow-auto px-6 py-6 md:flex-1 md:overflow-hidden">
        <Card className="bg-card border-border flex flex-col overflow-auto rounded-lg border shadow-sm transition-shadow duration-200 hover:shadow-md md:flex-1 md:overflow-hidden">
          <CardHeader className="flex-shrink-0 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground text-2xl font-semibold">
                Pools
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreatePoolOpen(true)}
                className="bg-background border-border text-foreground flex items-center gap-2 rounded-lg font-medium"
              >
                <PlusCircle className="h-4 w-4" />
                <span>New Pool</span>
              </Button>
            </div>
            <CardDescription className="text-muted-foreground">
              Manage your shared expenses with friends
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden px-4 pb-4">
            {pools.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                <div className="bg-primary/10 mb-4 rounded-full p-4">
                  <Wallet className="text-primary h-10 w-10" />
                </div>
                <p className="text-muted-foreground mb-4 text-lg">
                  No pools created yet
                </p>
                <Button
                  variant="outline"
                  onClick={() => setIsCreatePoolOpen(true)}
                  className="bg-background hover:bg-accent border-border text-foreground rounded-lg font-medium"
                >
                  Create your first pool
                </Button>
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <div className="space-y-3">
                  {pools.map(pool => (
                    <div
                      key={pool.id}
                      className="hover:bg-accent/50 overflow-hidden rounded-lg transition-colors duration-200"
                    >
                      <PoolSummary poolId={pool.id} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="border-border flex-shrink-0 border-t pt-4">
            <div className="text-muted-foreground text-sm">
              {pools.length}{" "}
              {pools.length === 1 ? "active pool" : "active pools"}
            </div>
          </CardFooter>
        </Card>
      </div>

      <div className="bg-card border-border flex h-full flex-col overflow-auto border-l px-6 py-6 lg:w-[400px] xl:w-[550px] 2xl:w-[620px]  md:overflow-hidden">
        <FriendsView />
      </div>
    </div>
  )
}
