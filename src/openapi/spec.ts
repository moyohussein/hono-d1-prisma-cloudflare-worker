import type { Bindings } from "~/types";

// Minimal OpenAPI 3.0 spec for implemented endpoints
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "leamsp-api",
    version: "1.0.0",
    description: "OpenAPI spec for implemented authentication and profile endpoints",
  },
  servers: [{ url: "/api" }],
  paths: {
    "/auth/login": {
      post: {
        summary: "Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 1 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        token: { type: "string" },
                        user: {
                          type: "object",
                          properties: {
                            id: { type: "integer" },
                            email: { type: "string" },
                            name: { type: "string" },
                            role: { type: "string", enum: ["USER", "ADMIN"], description: "User role" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/auth/signup": {
      post: {
        summary: "Signup",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password", "password_confirmation"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                  password_confirmation: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Created" },
          "400": { description: "Validation error" },
        },
      },
    },
    "/auth/verify-email": {
      post: {
        summary: "Issue email verification token",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { email: { type: "string", format: "email" } },
              },
            },
          },
        },
        responses: { "200": { description: "OK" } },
      },
    },
    "/auth/verify": {
      get: {
        summary: "Verify email by token",
        parameters: [
          { in: "query", name: "token", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Verified" }, "410": { description: "Expired or invalid" } },
      },
    },
    "/auth/forgot-password": {
      post: {
        summary: "Issue password reset token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: { email: { type: "string", format: "email" } },
              },
            },
          },
        },
        responses: { "200": { description: "OK" } },
      },
    },
    "/auth/reset-password": {
      post: {
        summary: "Reset password with token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "newPassword", "confirmPassword"],
                properties: {
                  token: { type: "string" },
                  newPassword: { type: "string" },
                  confirmPassword: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "OK" }, "410": { description: "Expired or invalid" } },
      },
    },
    "/user/profile": {
      get: {
        summary: "Get current user profile",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Profile" }, "401": { description: "Unauthorized" } },
      },
      put: {
        summary: "Update current user profile",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" }, "401": { description: "Unauthorized" } },
      },
    },
    "/user/password": {
      put: {
        summary: "Change password",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["currentPassword", "newPassword", "confirmPassword"],
                properties: {
                  currentPassword: { type: "string" },
                  newPassword: { type: "string" },
                  confirmPassword: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } },
      },
    },
    "/admin/ping": {
      get: {
        summary: "Admin ping (admin-only)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "OK" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden - requires ADMIN role" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
} as const;

export type OpenApi = typeof openApiSpec;
