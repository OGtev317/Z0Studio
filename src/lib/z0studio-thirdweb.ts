const CLIENT_ID_PATTERN = /^[a-zA-Z0-9_-]{16,128}$/;
const CHECKOUT_ID_PATTERN = /^[a-zA-Z0-9:_-]{6,160}$/;

export type Z0StudioThirdwebEnv = {
  NEXT_PUBLIC_THIRDWEB_CLIENT_ID?: string;
  NEXT_PUBLIC_Z0STUDIO_PRO_CHECKOUT_ID?: string;
  NEXT_PUBLIC_Z0STUDIO_STUDIO_CHECKOUT_ID?: string;
  NEXT_PUBLIC_Z0STUDIO_ZPRO_TOKEN_ADDRESS?: string;
};

export type ThirdwebLaneStatus = {
  id: "login" | "proCheckout" | "studioCheckout" | "zproToken";
  label: string;
  enabled: boolean;
  reason: string;
};

export type Z0StudioThirdwebStatus = {
  live: false;
  canRenderLogin: boolean;
  canRenderCheckout: boolean;
  canReferenceZpro: boolean;
  lanes: ThirdwebLaneStatus[];
  boundaries: string[];
};

export function getZ0StudioThirdwebStatus(env: Z0StudioThirdwebEnv): Z0StudioThirdwebStatus {
  const hasClientId = isValidClientId(env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID);
  const hasProCheckout = isValidCheckoutId(env.NEXT_PUBLIC_Z0STUDIO_PRO_CHECKOUT_ID);
  const hasStudioCheckout = isValidCheckoutId(env.NEXT_PUBLIC_Z0STUDIO_STUDIO_CHECKOUT_ID);
  const hasZproToken = isLikelyEvmAddress(env.NEXT_PUBLIC_Z0STUDIO_ZPRO_TOKEN_ADDRESS);

  return {
    live: false,
    canRenderLogin: hasClientId,
    canRenderCheckout: hasClientId && (hasProCheckout || hasStudioCheckout),
    canReferenceZpro: hasZproToken,
    lanes: [
      {
        id: "login",
        label: "Social login",
        enabled: hasClientId,
        reason: hasClientId ? "Client ID present; SDK wiring still requires review." : "Missing public thirdweb client ID.",
      },
      {
        id: "proCheckout",
        label: "Pro checkout",
        enabled: hasClientId && hasProCheckout,
        reason: hasProCheckout ? "Checkout target configured." : "Missing Pro checkout target.",
      },
      {
        id: "studioCheckout",
        label: "Studio checkout",
        enabled: hasClientId && hasStudioCheckout,
        reason: hasStudioCheckout ? "Checkout target configured." : "Missing Studio checkout target.",
      },
      {
        id: "zproToken",
        label: "ZPRO app credit",
        enabled: hasZproToken,
        reason: hasZproToken ? "Token reference present; app-credit only." : "No reviewed token address configured.",
      },
    ],
    boundaries: [
      "Status is configuration readiness only, not a payment processor connection.",
      "No checkout widget, wallet signing, token deployment, or chain call is executed.",
      "ZPRO is an app credit candidate only and is not the Zeero L1 native asset.",
    ],
  };
}

export function sanitizeCheckoutIntent(input: {
  creatorName: string;
  handle: string;
  plan: string;
  roomName: string;
  email?: string;
}) {
  const creatorName = cleanText(input.creatorName, 80);
  const handle = cleanHandle(input.handle);
  const roomName = cleanText(input.roomName, 96);
  const plan = input.plan === "studio" ? "studio" : input.plan === "pro" ? "pro" : "free";
  const email = input.email ? cleanText(input.email, 160).toLowerCase() : "";

  if (!creatorName || !handle || !roomName) throw new Error("CHECKOUT_INTENT_REQUIRED");
  assertNoPrivateMaterial(`${creatorName} ${handle} ${roomName} ${email}`);

  return {
    id: `intent-${hashText(`${creatorName}:${handle}:${plan}:${roomName}:${email}`)}`,
    creatorName,
    handle,
    roomName,
    plan,
    email: email || undefined,
    status: "local-intent-only" as const,
    createdAt: Date.now(),
  };
}

function isValidClientId(value: string | undefined): boolean {
  return Boolean(value && CLIENT_ID_PATTERN.test(value));
}

function isValidCheckoutId(value: string | undefined): boolean {
  return Boolean(value && CHECKOUT_ID_PATTERN.test(value));
}

function isLikelyEvmAddress(value: string | undefined): boolean {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));
}

function cleanText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanHandle(value: string): string {
  return cleanText(value, 40).replace(/^@/, "").toLowerCase();
}

function assertNoPrivateMaterial(value: string): void {
  if (/(private[_-]?key|seed phrase|mnemonic|viewing[_-]?key|witness|memo plaintext|secret)/i.test(value)) {
    throw new Error("CHECKOUT_INTENT_PRIVATE_MATERIAL");
  }
}

function hashText(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
