export interface RuntimeConfig {
  apiBaseUrl: string;
  authServiceSignInUrl: string;
  authServiceApplicationId: string;
  appBaseUrl: string;
}

declare global {
  interface Window {
    __VECTIS_CONFIG__?: Partial<RuntimeConfig>;
  }
}

export function getRuntimeConfig(): RuntimeConfig {
  const configured = window.__VECTIS_CONFIG__ ?? {};

  return {
    apiBaseUrl: configured.apiBaseUrl ?? `${window.location.origin}/api/v1`,
    authServiceSignInUrl: configured.authServiceSignInUrl ?? "https://auth.life-sqrd.com/signIn",
    authServiceApplicationId:
      configured.authServiceApplicationId ?? "0ccc6f76-09c4-4a8c-3bbf-ee097174ffe8",
    appBaseUrl: configured.appBaseUrl ?? window.location.origin
  };
}
