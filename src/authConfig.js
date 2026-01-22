import { LogLevel } from "@azure/msal-browser";

/**
 * MSAL configuration
 * Used to initialize PublicClientApplication
 */
export const msalConfig = {
  auth: {
    clientId: "450165b3-b418-4134-b525-cf04512bee71", // ✅ DocQmentor App Client ID
    authority: "https://login.microsoftonline.com/common", // ✅ Multi-tenant
    redirectUri: window.location.origin, // ✅ Auto-detect environment
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: false,
  },

  cache: {
    cacheLocation: "sessionStorage", // ✅ Recommended for security
    storeAuthStateInCookie: false, // ❌ Only enable for IE/Edge legacy
  },

  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            break;
          case LogLevel.Warning:
            console.warn(message);
            break;
          case LogLevel.Info:
            console.info(message);
            break;
          case LogLevel.Verbose:
            console.debug(message);
            break;
          default:
            break;
        }
      },
      logLevel: LogLevel.Info,
    },
  },
};

/**
 * Login request scopes
 * Used in loginPopup or loginRedirect
 */
export const loginRequest = {
  scopes: [
    "openid",
    "profile",
    "email",
    "User.Read",
    "GroupMember.Read.All", // ✅ Required to read group memberships
  ],
};

/**
 * Graph API token request
 */
export const graphRequest = {
  scopes: ["User.Read"],
};

/**
 * DocQmentor Authorized Group (Super Admin / Allowed Users)
 * Used to validate access after login
 */
export const docQmentorGroupId =
  "6617eaae-8e80-4228-a917-4345b9023c73"; // ✅ Azure AD Group Object ID

