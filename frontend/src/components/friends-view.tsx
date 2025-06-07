import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/api/client";
import { useEffect, useState } from "react";
import { AddFriendModal } from "@/components/add-friend-modal";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, X, UserPlus, Clock, LogOut, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useFriends } from "@/hooks/use-friends";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useQueryClient } from "@tanstack/react-query";

export const FriendsView = () => {
  const queryClient = useQueryClient();
  const { memberId, createAuthHeader, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("friends");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const {
    friends,
    isFriendsLoading,
    mutations,
    friendRequests,
    isFriendRequestsLoading,
  } = useFriends();

  const { data: member } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}",
    {
      params: { path: { member_id: memberId || "" } },
      headers: createAuthHeader(),
    },
    {
      enabled: !!memberId,
    },
  );

  const { mutateAsync: updateMember, isPending } = apiClient.useMutation(
    "patch",
    "/api/members/{member_id}",
  );

  const email = member?.email;
  const name = `${member?.first_name} ${member?.last_name}`;
  const [venmoHandle, setVenmoHandle] = useState(member?.venmo_handle || null);

  useEffect(() => {
    if (member) {
      setVenmoHandle(member.venmo_handle || "");
    }
  }, [member]);

  const isLoading = isFriendsLoading || isFriendRequestsLoading;

  const inboundRequests = friendRequests.filter(
    (r) => r.direction === "inbound",
  );
  const outboundRequests = friendRequests.filter(
    (r) => r.direction === "outbound",
  );
  const pendingCount = inboundRequests.length;
  const waitingOutboundCount = outboundRequests.length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden">
          <div className="flex gap-2 p-4 border-b">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>

          <CardContent className="flex-1 overflow-auto p-4">
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg border"
                >
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>

          <CardFooter className="border-t">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">Social</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Friend</span>
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          Manage your friends and requests
        </p>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <Tabs
          defaultValue="friends"
          className="w-full flex-1 flex flex-col"
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
                    className="ml-2 px-1.5 py-0.5 text-xs absolute -top-1 -right-1"
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
                    <div className="bg-muted rounded-full p-4 mb-4">
                      <UserPlus className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-4">
                      No friends added yet
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setIsModalOpen(true)}
                    >
                      Add your first friend
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {friends.map((friend) => (
                      <motion.div
                        key={friend.id}
                        className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-medium">
                              {friend.first_name[0]}
                              {friend.last_name[0]}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {friend.first_name} {friend.last_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
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
                    <div className="bg-muted rounded-full p-4 mb-4">
                      <Clock className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-medium">
                      No pending friend requests
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      All caught up!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {inboundRequests.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
                          <span>Received Requests</span>
                          <Badge variant="outline" className="ml-2">
                            {inboundRequests.length}
                          </Badge>
                        </h3>
                        <div className="space-y-2">
                          {inboundRequests.map((request) => (
                            <motion.div
                              key={request.member.id}
                              className="flex items-center justify-between py-3 px-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
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
                                  <span className="text-xs text-muted-foreground">
                                    {request.member.email}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                  disabled={mutations.isDeleting}
                                  onClick={async () => {
                                    await mutations.deleteFriendRequest(
                                      request.member.id,
                                    );
                                  }}
                                  aria-label={`Decline friend request from ${request.member.first_name} ${request.member.last_name}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  className="h-8 w-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                                  onClick={async () => {
                                    await mutations.acceptFriendRequest(
                                      request.member.id,
                                    );
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
                        <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
                          <span>Sent Requests</span>
                          <Badge variant="outline" className="ml-2">
                            {outboundRequests.length}
                          </Badge>
                        </h3>
                        <div className="space-y-2">
                          {outboundRequests.map((request) => (
                            <motion.div
                              key={request.member.id}
                              className="flex items-center justify-between py-3 px-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
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
                                  <span className="text-xs text-muted-foreground">
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
                                    mutations.deleteFriendRequest(
                                      request.member.id,
                                    );
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
                <div className="bg-muted/30 p-6 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary rounded-full p-3">
                      <span className="text-primary-foreground font-bold text-lg">
                        {name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-lg">{name}</p>
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
                        onChange={(event) => {
                          setVenmoHandle(event.target.value);
                        }}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={async () => {
                          if (memberId) {
                            await updateMember({
                              params: {
                                path: { member_id: memberId },
                              },
                              body: {
                                venmo_handle: venmoHandle || null,
                              },
                              headers: createAuthHeader(),
                            });

                            await queryClient.invalidateQueries({
                              queryKey: ["get", "/api/members/{member_id}"],
                            });
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
                      logout();
                    }}
                    className="w-full justify-center border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                  >
                    <LogOut className="size-4 mr-2" />
                    Log Out
                  </Button>
                </div>
              </CardContent>
            </TabsContent>
          </div>
        </Tabs>

        <CardFooter className="pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
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

      <AddFriendModal isOpen={isModalOpen} setIsOpen={setIsModalOpen} />
    </>
  );
};
