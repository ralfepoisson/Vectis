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
    authServiceApplicationId: configured.authServiceApplicationId ?? "vectis-web",
    appBaseUrl: configured.appBaseUrl ?? window.location.origin
  };
}
