import { apiClient } from "@/api/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/use-auth"
import { useFriends } from "@/hooks/use-friends"
import { useQueryClient } from "@tanstack/react-query"
import { CheckCircle, Clock, LogOut, Save, UserPlus, X } from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useState } from "react"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

export const FriendsView = ({
  setIsAddFriendModalOpen,
}: {
  setIsAddFriendModalOpen: (isOpen: boolean) => void
}) => {
  const queryClient = useQueryClient()
  const { memberId, createAuthHeader, logout } = useAuth()
  const [activeTab, setActiveTab] = useState("friends")
  const {
    friends,
    isFriendsLoading,
    mutations,
    friendRequests,
    isFriendRequestsLoading,
  } = useFriends()

  const { data: member } = apiClient.useQuery(
    "get",
    "/api/members/me",
    {
      headers: createAuthHeader(),
    },
    {
      enabled: !!memberId,
    }
  )

  const { mutateAsync: updateMember, isPending } = apiClient.useMutation(
    "patch",
    "/api/members/me"
  )

  const email = member?.email
  const name = `${member?.first_name} ${member?.last_name}`
  const [venmoHandle, setVenmoHandle] = useState(member?.venmo_handle || null)

  useEffect(() => {
    if (member) {
      setVenmoHandle(member.venmo_handle || "")
    }
  }, [member])

  const isLoading = isFriendsLoading || isFriendRequestsLoading

  const inboundRequests = friendRequests.filter(r => r.direction === "inbound")
  const outboundRequests = friendRequests.filter(
    r => r.direction === "outbound"
  )
  const pendingCount = inboundRequests.length
  const waitingOutboundCount = outboundRequests.length

  if (isLoading) {
    return null
  }

  return (
    <>
      <div className="mb-6">
        <p className="text-muted-foreground text-sm mt-4">
          Manage your friends and requests
        </p>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <Tabs
          defaultValue="friends"
          className="flex w-full flex-1 flex-col"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <div className="p-4 pb-0">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="friends">
                Friends ({friends.length})
              </TabsTrigger>
              <TabsTrigger value="requests" className="relative">
                Requests
                {pendingCount > 0 && (
                  <Badge
                    variant="default"
                    className="absolute -top-1 -right-1 ml-2 px-1.5 py-0.5 text-xs"
                  >
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="me">Profile</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto">
            <TabsContent value="friends" className="mt-0 h-full">
              <CardContent className="space-y-1">
                {friends.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="bg-muted mb-4 rounded-full p-4">
                      <UserPlus className="text-muted-foreground h-8 w-8" />
                    </div>
                    <p className="text-muted-foreground mb-4">
                      No friends added yet
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setIsAddFriendModalOpen(true)}
                    >
                      Add your first friend
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {friends.map(friend => (
                      <motion.div
                        key={friend.id}
                        className="hover:bg-muted/50 flex items-center justify-between rounded-lg px-2 py-3 transition-colors"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full">
                            <span className="text-xs font-medium">
                              {friend.first_name[0]}
                              {friend.last_name[0]}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {friend.first_name} {friend.last_name}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {friend.email}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </TabsContent>

            <TabsContent value="requests" className="mt-0">
              <CardContent className="space-y-4">
                {friendRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="bg-muted mb-4 rounded-full p-4">
                      <Clock className="text-muted-foreground h-10 w-10" />
                    </div>
                    <p className="text-lg font-medium">
                      No pending friend requests
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      All caught up!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {inboundRequests.length > 0 && (
                      <div>
                        <h3 className="text-muted-foreground mb-2 flex items-center text-sm font-medium">
                          <span>Received Requests</span>
                          <Badge variant="outline" className="ml-2">
                            {inboundRequests.length}
                          </Badge>
                        </h3>
                        <div className="space-y-2">
                          {inboundRequests.map(request => (
                            <motion.div
                              key={request.member.id}
                              className="bg-card hover:bg-muted/50 flex items-center justify-between rounded-lg border px-4 py-3 transition-colors"
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {request.member.first_name}{" "}
                                    {request.member.last_name}
                                  </span>
                                  <span className="text-muted-foreground text-xs">
                                    {request.member.email}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 rounded-full"
                                  disabled={mutations.isDeleting}
                                  onClick={async () => {
                                    await mutations.deleteFriendRequest(
                                      request.member.id
                                    )
                                  }}
                                  aria-label={`Decline friend request from ${request.member.first_name} ${request.member.last_name}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 w-8"
                                  onClick={async () => {
                                    await mutations.acceptFriendRequest(
                                      request.member.id
                                    )
                                  }}
                                  disabled={mutations.isAccepting}
                                  aria-label={`Accept friend request from ${request.member.first_name} ${request.member.last_name}`}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {outboundRequests.length > 0 && (
                      <div>
                        <h3 className="text-muted-foreground mb-2 flex items-center text-sm font-medium">
                          <span>Sent Requests</span>
                          <Badge variant="outline" className="ml-2">
                            {outboundRequests.length}
                          </Badge>
                        </h3>
                        <div className="space-y-2">
                          {outboundRequests.map(request => (
                            <motion.div
                              key={request.member.id}
                              className="bg-card hover:bg-muted/50 flex items-center justify-between rounded-lg border px-4 py-3 transition-colors"
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {request.member.first_name}{" "}
                                    {request.member.last_name}
                                  </span>
                                  <span className="text-muted-foreground text-xs">
                                    {request.member.email}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={async () => {
                                    await mutations.deleteFriendRequest(
                                      request.member.id
                                    )
                                  }}
                                  aria-label={`Cancel friend request to ${request.member.first_name} ${request.member.last_name}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </TabsContent>

            <TabsContent value="me" className="mt-0">
              <CardContent className="space-y-6">
                <div className="bg-muted/30 rounded-lg p-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary rounded-full p-3">
                      <span className="text-primary-foreground text-lg font-bold">
                        {name
                          .split(" ")
                          .map(n => n[0])
                          .join("")}
                      </span>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{name}</p>
                      <p className="text-muted-foreground text-sm">{email}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Venmo Handle</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="@my-venmo-handle"
                        value={venmoHandle || ""}
                        onChange={event => {
                          setVenmoHandle(event.target.value)
                        }}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={async () => {
                          if (memberId) {
                            await updateMember({
                              body: {
                                venmo_handle: venmoHandle || null,
                              },
                              headers: createAuthHeader(),
                            })

                            await queryClient.invalidateQueries({
                              queryKey: ["get", "/api"],
                            })
                          }
                        }}
                        disabled={isPending}
                        aria-label="Save Venmo handle"
                      >
                        <Save className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => {
                      logout()
                    }}
                    className="border-destructive/20 text-destructive hover:bg-destructive hover:border-destructive w-full justify-center hover:text-black"
                  >
                    <LogOut className="mr-2 size-4" />
                    Log Out
                  </Button>
                </div>
              </CardContent>
            </TabsContent>
          </div>
        </Tabs>

        <CardFooter className="border-border border-t pt-4">
          <div className="text-muted-foreground text-sm">
            {friends.length} {friends.length === 1 ? "friend" : "friends"}
            {pendingCount > 0 ? (
              <>
                {" • "}
                <span className="text-primary font-medium">
                  {pendingCount} pending
                </span>
              </>
            ) : (
              " • 0 pending"
            )}
            {waitingOutboundCount > 0 ? (
              <>
                {" • "}
                <span className="text-muted-foreground font-medium">
                  {waitingOutboundCount} waiting for reply
                </span>
              </>
            ) : (
              " • 0 waiting"
            )}
          </div>
        </CardFooter>
      </Card>
    </>
  )
}
