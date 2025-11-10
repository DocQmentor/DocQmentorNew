import { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest, docQmentorGroupId } from "../authConfig";

const useGroupAccess = () => {
  const { instance, accounts } = useMsal();
  const [hasAccess, setHasAccess] = useState(null);

  useEffect(() => {
    const checkAccess = async () => {
      if (!accounts || accounts.length === 0) return;

      try {
        const response = await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });

        // Check both group memberships and group owners
        const [membersResult, ownersResult] = await Promise.all([
          fetch(
            `https://graph.microsoft.com/v1.0/groups/${docQmentorGroupId}/members?$select=id`,
            {
              headers: {
                Authorization: `Bearer ${response.accessToken}`,
              },
            }
          ),
          fetch(
            `https://graph.microsoft.com/v1.0/groups/${docQmentorGroupId}/owners?$select=id`,
            {
              headers: {
                Authorization: `Bearer ${response.accessToken}`,
              },
            }
          )
        ]);

        const membersData = await membersResult.json();
        const ownersData = await ownersResult.json();

        const memberIds = membersData.value.map((user) => user.id);
        const ownerIds = ownersData.value.map((user) => user.id);

        // Get current user's ID
        const userResponse = await fetch(
          `https://graph.microsoft.com/v1.0/me?$select=id`,
          {
            headers: {
              Authorization: `Bearer ${response.accessToken}`,
            },
          }
        );
        const userData = await userResponse.json();
        const currentUserId = userData.id;

        // Grant access if user is either a member OR an owner of the group
        const userHasAccess = memberIds.includes(currentUserId) || ownerIds.includes(currentUserId);
        setHasAccess(userHasAccess);

      } catch (err) {
        console.warn("🔐 Access check failed:", err);

        if (
          err.errorCode === "interaction_required" ||
          err.errorMessage?.includes("AADSTS65001")
        ) {
          instance.loginRedirect({
            ...loginRequest,
            scopes: ["User.Read", "GroupMember.Read.All", "Group.Read.All"],
            prompt: "consent",
          });
        } else {
          setHasAccess(false);
        }
      }
    };

    checkAccess();
  }, [accounts, instance]);

  return hasAccess;
};

export default useGroupAccess;