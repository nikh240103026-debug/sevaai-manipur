export type UserRole =
  | "STATE_ADMIN"
  | "DISTRICT_OFFICER"
  | "BLOCK_OFFICER";

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface CurrentUser {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  district: string | null;
  block: string | null;
  is_active: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}