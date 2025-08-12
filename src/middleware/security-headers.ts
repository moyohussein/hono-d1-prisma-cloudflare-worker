import type { MiddlewareHandler } from "hono";

/**
 * Security headers middleware that adds various security-related HTTP headers
 * to responses. This should be used in combination with the CORS middleware.
 * 
 * The headers are added after the request is processed to ensure they're
 * present on all responses, including error responses.
 */
export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    // First process the request
    await next();
    
    const res = c.res;
    
    // Security headers
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-XSS-Protection", "1; mode=block");
    
    // Content Security Policy (CSP)
    // Note: This is a basic CSP - you should customize this based on your needs
    // and test thoroughly in development before deploying to production
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: http:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'"
    ].join("; ");
    
    // Set the CSP header
    res.headers.set("Content-Security-Policy", cspDirectives);
    
    // Feature Policy (now Permissions Policy in newer browsers)
    // Restrict which features can be used in the browser
    res.headers.set(
      "Permissions-Policy",
      [
        "camera=()",
        "microphone=()",
        "geolocation=()",
        "payment=()",
        "fullscreen=()",
        "accelerometer=()",
        "gyroscope=()",
        "magnetometer=()",
        "usb=()"
      ].join(", ")
    );
    
    // Prevent MIME type sniffing
    res.headers.set("X-Content-Type-Options", "nosniff");
    
    // Referrer policy
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    
    // HSTS (HTTP Strict Transport Security)
    // Note: Be careful with this in development as it can cause issues
    if (c.env?.ENVIRONMENT === 'production') {
      res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
  };
}
