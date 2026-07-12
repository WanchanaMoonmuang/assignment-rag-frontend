const ACCESS_TOKEN_KEY = "knowledge-assistant.access-token";

export const tokenStorage = {
  get(): string | null {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  },
  set(token: string): void {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  },
  clear(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  },
};
