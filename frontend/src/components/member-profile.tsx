import { formatDate } from "./expense";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  CalendarIcon,
  MailIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { apiClient } from "@/api/client";
import { useAuth } from "@/hooks/auth";

export const MemberProfile = ({ id }: { id: string }) => {
  const { createAuthHeader } = useAuth();

  const { data: member, isLoading } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}",
    {
      params: {
        path: {
          member_id: id,
        },
      },
      headers: createAuthHeader(),
    },
    {
      enabled: !!id,
    },
  );

  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="py-2">
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    );
  }

  if (!member) {
    return (
      <Card className="w-full bg-red-50">
        <CardContent className="py-4">
          <p className="text-red-500 text-center">Member not found</p>
        </CardContent>
      </Card>
    );
  }

  const membershipDate = new Date(member.inserted_at);
  const currentDate = new Date();
  const membershipMonths =
    (currentDate.getFullYear() - membershipDate.getFullYear()) * 12 +
    (currentDate.getMonth() - membershipDate.getMonth());

  let memberStatus = "New Member";
  if (membershipMonths > 24) {
    memberStatus = "Veteran Member";
  } else if (membershipMonths > 12) {
    memberStatus = "Regular Member";
  } else if (membershipMonths > 6) {
    memberStatus = "Active Member";
  }

  return (
    <Card className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
        <CardHeader className="pb-1 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">
                {member.first_name} {member.last_name}
              </h3>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                {isOpen ? (
                  <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-gray-700">
            <MailIcon className="h-4 w-4" />
            <span className="text-sm">{member.email}</span>
          </div>
        </CardContent>

        <CollapsibleContent>
          <CardContent className="pt-2 border-t border-gray-100">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{memberStatus}</Badge>
              </div>

              <div className="flex items-center gap-2 text-gray-700">
                <CalendarIcon className="h-4 w-4" />
                <span className="text-sm">
                  Member since {formatDate(new Date(member.inserted_at))}
                </span>
              </div>

              {member.bio && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-gray-600 text-sm italic">{member.bio}</p>
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="bg-gray-50 py-2">
            <div className="flex justify-between w-full text-xs text-gray-500">
              <div>ID: {id.substring(0, 8)}...</div>
              <div>
                Last updated:{" "}
                {member.updated_at
                  ? formatDate(new Date(member.updated_at))
                  : "N/A"}
              </div>
            </div>
          </CardFooter>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default MemberProfile;
