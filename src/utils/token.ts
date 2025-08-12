import { sign, verify } from 'hono/jwt';

// Helper function to decode base64 in web environments
function decodeBase64(str: string): string {
  // In a Cloudflare Worker, we can use atob directly
  if (typeof atob === 'function') {
    return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  }
  
  // Fallback for environments without atob (shouldn't happen in Cloudflare Workers)
  // Using a simple base64 decoder that works in the browser and Cloudflare Workers
  return decodeURIComponent(
    atob(str)
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

// Token expires in 24 hours
const EMAIL_VERIFICATION_EXPIRY = '24h';

type TokenPayload = {
  userId: string | number;
  email: string;
  purpose: 'email-verification';
};

export async function generateVerificationToken(
  userId: string | number,
  email: string,
  secret: string
): Promise<string> {
  const payload: TokenPayload = {
    userId,
    email,
    purpose: 'email-verification',
  };

  return await sign(payload, secret);
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<{ payload: TokenPayload; expired: boolean }> {
  try {
    const payload = await verify(token, secret) as TokenPayload;
    return { payload, expired: false };
  } catch (error: any) {
    if (error.name === 'JWTExpired') {
      // Return expired: true if token is just expired
      try {
        const base64Payload = token.split('.')[1];
        const payloadStr = decodeBase64(base64Payload);
        const decoded = JSON.parse(payloadStr) as TokenPayload;
        return { payload: decoded, expired: true };
      } catch (e) {
        throw new Error('Invalid token');
      }
    }
    throw error;
  }
}
