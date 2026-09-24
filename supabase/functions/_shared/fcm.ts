import { AppError } from "./errors.ts";

/**
 * Firebase Cloud Messaging (HTTP v1) — ký access token JWT bằng WebCrypto
 * (không cần dependency ngoài, chạy được trên Deno Edge Runtime).
 */

function b64url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToBuffer(pem: string): Uint8Array {
  const cleaned = pem
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\r?\n/g, "")
    .trim();
  const raw = atob(cleaned);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function createAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get("FCM_CLIENT_EMAIL");
  const privateKey = Deno.env.get("FCM_PRIVATE_KEY");
  if (!clientEmail || !privateKey) {
    throw new AppError("CONFIG_ERROR", "FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY chưa được cấu hình", 500);
  }

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })));
  const signingInput = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBuffer(privateKey).buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));

  return `${signingInput}.${b64url(sig)}`;
}

async function getAccessToken(): Promise<string> {
  const token = await createAccessToken();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: token,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new AppError("FCM_AUTH_ERROR", `Không lấy được access token FCM: ${data.error ?? res.statusText}`, 500);
  }
  return data.access_token as string;
}

export type FcmMessage = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

/** Gửi push FCM v1 tới 1 token. Trả về false nếu token không hợp lệ (để xóa device). */
export async function sendFcm(msg: FcmMessage): Promise<boolean> {
  const projectId = Deno.env.get("FCM_PROJECT_ID");
  if (!projectId) {
    throw new AppError("CONFIG_ERROR", "FCM_PROJECT_ID chưa được cấu hình", 500);
  }

  const accessToken = await getAccessToken();
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: msg.token,
          notification: { title: msg.title, body: msg.body },
          data: msg.data ?? {},
        },
      }),
    },
  );

  if (res.status === 404 || res.status === 410) return false; // token hết hạn / không tồn tại
  if (!res.ok) {
    const bodyText = await res.text();
    console.error("[fcm] send error", res.status, bodyText);
    return true; // lỗi tạm thời — giữ token
  }
  return true;
}