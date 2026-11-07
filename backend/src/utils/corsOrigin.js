function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

export function isLocalDevelopmentOrigin(origin) {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;

    const hostname = url.hostname.toLowerCase();
    return hostname === "localhost"
      || hostname === "0.0.0.0"
      || hostname === "::1"
      || hostname === "[::1]"
      || isPrivateIpv4(hostname);
  } catch {
    return false;
  }
}

  export function isCorsOriginAllowed(origin, { allowedOrigins = [], nodeEnv } = {}) {
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;

    const normalizedOrigin = origin.toLowerCase().trim();

    // Support wildcard patterns like https://*.vercel.app or *.onrender.com
    for (const allowed of allowedOrigins) {
      const cleanAllowed = allowed.toLowerCase().trim();
      if (cleanAllowed === "*") return true;
      if (cleanAllowed.includes("*")) {
        const regexPattern = "^" + cleanAllowed.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$";
        if (new RegExp(regexPattern).test(normalizedOrigin)) return true;
      }
    }

    // If any vercel.app origin is configured in allowedOrigins, automatically allow Vercel previews
    const hasVercelAllowed = allowedOrigins.some((o) => o.toLowerCase().includes("vercel.app"));
    if (hasVercelAllowed && /^https:\/\/[a-z0-9-_.]+\.vercel\.app$/i.test(normalizedOrigin)) {
      return true;
    }

    return nodeEnv !== "production" && isLocalDevelopmentOrigin(origin);
  }
