import { apiRequest } from "@/lib/client";
import type {
  CurrentUser,
  LoginCredentials,
  LoginResponse,
} from "@/types/auth";

const TOKEN_KEY = "sevaai_access_token";

export async function login(
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  const response = await apiRequest<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  localStorage.setItem(TOKEN_KEY, response.access_token);

  return response;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(TOKEN_KEY);
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>("/api/v1/auth/me", {
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
    },
  });
}