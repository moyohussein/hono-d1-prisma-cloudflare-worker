import { cors as honoCors } from 'hono/cors';

/**
 * CORS middleware with secure defaults
 * 
 * @returns Hono middleware function with CORS configuration
 */
export function cors() {
  return honoCors({
    // Allow requests from these origins
    origin: [
      'http://localhost:3000', // Local development
      'http://localhost:5173', // Common Vite dev server port
      'https://your-production-domain.com', // Replace with your production domain
    ],
    
    // Allowed HTTP methods
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    
    // Allowed headers
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-CSRF-Token',
    ],
    
    // Expose headers to the client
    exposeHeaders: [
      'Content-Length',
      'Content-Range',
    ],
    
    // Allow credentials (cookies, authorization headers, etc.)
    credentials: true,
    
    // Cache preflight requests for 1 hour (in seconds)
    maxAge: 3600,
  });
}
