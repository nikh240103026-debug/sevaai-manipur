const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

if (!configuredApiUrl) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not configured. Add it to the frontend environment."
  );
}

const API_URL: string = configuredApiUrl;

function getApiBaseUrl(): string {
  if (typeof window === "undefined") return API_URL;

  const url = new URL(API_URL);
  const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const pageIsLoopback =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (isLoopback && pageIsLoopback) {
    url.hostname = window.location.hostname;
  }

  return url.toString().replace(/\/+$/, "");
}

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text || null;
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const response = await fetch(`${getApiBaseUrl()}${normalizedPath}`, {
    ...options,
    credentials: options?.credentials ?? "include",
    headers: {
      Accept: "application/json",
      ...options?.headers,
    },
  });

  const body = await parseResponseBody(response);

  if (!response.ok) {
    let message = `API request failed with status ${response.status}.`;

    if (
      typeof body === "object" &&
      body !== null &&
      "detail" in body &&
      typeof body.detail === "string"
    ) {
      message = body.detail;
    }

    throw new ApiError(response.status, message, body);
  }

  return body as T;
}