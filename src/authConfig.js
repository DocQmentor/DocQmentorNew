// authConfig.js
 
export const msalConfig = {
  auth: {
    clientId: "450165b3-b418-4134-b525-cf04512bee71", // ✅ your client ID
    authority:
      "https://login.microsoftonline.com/2b2653b1-1e48-445c-81a8-032920b2a550", // ✅ your tenant
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};
 
export const loginRequest = {
  scopes: ["User.Read", "GroupMember.Read.All"], // ✅ MUST include this
};
 
export const docQmentorGroupId = "6617eaae-8e80-4228-a917-4345b9023c73"; // ✅ paste your real group object ID from Azure
