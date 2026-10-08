const PASSKEY_ID_KEY = "sevaai:local-demo-passkey:v1";
const SESSION_KEY = "sevaai:local-demo-session:v1";
const listeners = new Set<() => void>();

function notifyLocalDemoStateChanged(): void {
  for (const listener of listeners) listener();
}

export function subscribeLocalDemoState(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function isSupported(): boolean {
  return typeof window !== "undefined" &&
    window.isSecureContext &&
    "PublicKeyCredential" in window &&
    typeof navigator.credentials?.create === "function" &&
    typeof navigator.credentials?.get === "function";
}

export function isLocalDemoSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SESSION_KEY) === "true";
  } catch (error) {
    console.error("Unable to read local demo session.", error);
    return false;
  }
}

export function hasLocalDemoPasskey(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PASSKEY_ID_KEY) !== null;
  } catch (error) {
    console.error("Unable to read local demo passkey.", error);
    return false;
  }
}

export async function signInToLocalDemo(): Promise<void> {
  if (!isSupported()) {
    throw new Error(
      "A secure browser context with WebAuthn support is required. Use localhost or HTTPS.",
    );
  }

  const savedCredentialId = window.localStorage.getItem(PASSKEY_ID_KEY);
  if (!savedCredentialId) {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "SevaAI Local Demo" },
        user: {
          id: userId,
          name: "local-demo",
          displayName: "SevaAI local demo",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
        },
        timeout: 60_000,
        attestation: "none",
      },
    });

    if (!(credential instanceof PublicKeyCredential)) {
      throw new Error("The authenticator did not create a passkey.");
    }
    window.localStorage.setItem(PASSKEY_ID_KEY, toBase64Url(new Uint8Array(credential.rawId)));
  } else {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [
          { type: "public-key", id: fromBase64Url(savedCredentialId) },
        ],
        userVerification: "required",
        timeout: 60_000,
      },
    });

    if (!(credential instanceof PublicKeyCredential) ||
      toBase64Url(new Uint8Array(credential.rawId)) !== savedCredentialId ||
      !(credential.response instanceof AuthenticatorAssertionResponse)) {
      throw new Error("The passkey did not authenticate this local demo.");
    }

    const authenticatorData = new Uint8Array(credential.response.authenticatorData);
    const flags = authenticatorData[32];
    if (flags === undefined || (flags & 0x05) !== 0x05) {
      throw new Error("The passkey must confirm user presence and verification.");
    }
  }

  window.localStorage.setItem(SESSION_KEY, "true");
  notifyLocalDemoStateChanged();
}

export function signOutOfLocalDemo(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  notifyLocalDemoStateChanged();
}
