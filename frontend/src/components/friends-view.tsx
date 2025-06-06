import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/api/client";
import { useEffect, useState } from "react";
import { AddFriendModal } from "@/components/add-friend-modal";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, X, UserPlus, Clock, LogOut, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "./ui/separator";
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
    }
  );

  const { mutateAsync: updateMember, isPending } = apiClient.useMutation(
    "patch",
    "/api/members/{member_id}"
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
    (r) => r.direction === "inbound"
  );
  const outboundRequests = friendRequests.filter(
    (r) => r.direction === "outbound"
  );
  const pendingCount = inboundRequests.length;
  const waitingOutboundCount = outboundRequests.length;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-6">
        <div className="flex justify-between items-center">
          <CardTitle className="text-2xl font-semibold">
            Social
          </CardTitle>
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
        <CardDescription>
          Manage your friends and requests
        </CardDescription>
      </CardHeader>

      <Tabs
        defaultValue="friends"
        className="w-full"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <div className="px-6">
          <TabsList className="grid w-full grid-cols-3 bg-muted rounded-lg">
            <TabsTrigger
              value="friends"
              className="rounded-md font-medium data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              Friends ({friends.length})
            </TabsTrigger>
            <TabsTrigger
              value="requests"
              className="relative rounded-md font-medium data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              Requests
              {pendingCount > 0 && (
                <Badge
                  variant="default"
                  className="ml-2 px-1.5 py-0.5 text-xs absolute -top-1 -right-1 bg-primary text-primary-foreground border-0"
                >
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="me"
              className="rounded-md font-medium data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              Profile
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="friends" className="mt-0 pt-2">
          <CardContent className="space-y-1 pb-2">
            {friends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="bg-muted rounded-full p-3 mb-3">
                  <UserPlus className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-3">
                  No friends added yet
                </p>
                <Button variant="outline" onClick={() => setIsModalOpen(true)}>
                  Add your first friend
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {friends.map((friend) => (
                  <motion.div
                    key={friend.id}
                    className="flex items-center justify-between py-3 px-1"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-3">
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

        <TabsContent value="requests" className="mt-0 pt-2">
          <CardContent className="space-y-4 pb-2">
            {friendRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-muted rounded-full p-4 mb-4">
                  <Clock className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-muted-foreground">
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
                    <div className="divide-y divide-gray-100 rounded-md border">
                      {inboundRequests.map((request) => (
                        <motion.div
                          key={request.member.id}
                          className="flex items-center justify-between py-3 px-3"
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
                                  request.member.id
                                );
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              className="h-8 w-8 rounded-full bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-700 border border-green-200"
                              onClick={async () => {
                                await mutations.acceptFriendRequest(
                                  request.member.id
                                );
                              }}
                              disabled={mutations.isAccepting}
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
                    <div className="divide-y divide-gray-100 rounded-md border">
                      {outboundRequests.map((request) => (
                        <motion.div
                          key={request.member.id}
                          className="flex items-center justify-between py-3 px-3"
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
                              onClick={async () => {
                                mutations.deleteFriendRequest(
                                  request.member.id
                                );
                              }}
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

        <TabsContent value="me" className="mt-0 pt-2">
          <CardContent className="pb-2 flex flex-col space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg border border-border">
              <div className="flex flex-row items-center justify-center mb-2">
                <div className="bg-primary rounded-full p-3 mr-3">
                  <span className="text-primary-foreground font-bold text-lg">
                    {name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-lg text-foreground">
                    {name}
                  </p>
                  <p className="text-muted-foreground text-sm">{email}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">
                Venmo Handle
              </Label>
              <div className="flex flex-row gap-x-2 items-center">
                <Input
                  placeholder="@my-venmo-handle"
                  value={venmoHandle || ""}
                  onChange={(event) => {
                    setVenmoHandle(event.target.value);
                  }}
                  className="flex-1 rounded-lg"
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
                  className="rounded-lg"
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
              className="justify-center py-3 border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-lg font-medium"
            >
              <LogOut className="size-4 mr-2" />
              Log Out
            </Button>
          </CardContent>
        </TabsContent>
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

      <AddFriendModal isOpen={isModalOpen} setIsOpen={setIsModalOpen} />
    </Card>
  );
};
