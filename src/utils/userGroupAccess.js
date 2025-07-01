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
 
        const result = await fetch(
          `https://graph.microsoft.com/v1.0/me/memberOf?$select=id`,
          {
            headers: {
              Authorization: `Bearer ${response.accessToken}`,
            },
          }
        );
 
        const data = await result.json();
        const groupIds = data.value.map((group) => group.id);
        setHasAccess(groupIds.includes(docQmentorGroupId));
      } catch (err) {
        console.warn("🔐 Access check failed:", err);
 
        if (
          err.errorCode === "interaction_required" ||
          err.errorMessage?.includes("AADSTS65001")
        ) {
          instance.loginRedirect({
            ...loginRequest,
            scopes: ["User.Read", "GroupMember.Read.All"],
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
 