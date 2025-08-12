export async function generateToken(bytes: number = 32): Promise<string> {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  // Return hex string for convenience
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(value: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
