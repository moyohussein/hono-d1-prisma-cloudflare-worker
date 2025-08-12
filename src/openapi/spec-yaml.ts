export const openApiYaml = `openapi: 3.0.3
info:
  title: leamsp-api
  version: 1.0.0
  description: OpenAPI spec for implemented authentication and profile endpoints
servers:
  - url: /api
paths:
  /auth/login:
    post:
      summary: Login
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 1
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: object
                    properties:
                      token:
                        type: string
                      user:
                        type: object
                        properties:
                          id:
                            type: integer
                          email:
                            type: string
                          name:
                            type: string
                          role:
                            type: string
                            enum: [USER, ADMIN]
                            description: User role
        '401':
          description: Invalid credentials
  /auth/register:
    post:
      summary: Register
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, email, password, password_confirmation]
              properties:
                name:
                  type: string
                email:
                  type: string
                  format: email
                password:
                  type: string
                password_confirmation:
                  type: string
      responses:
        '200':
          description: Created
        '400':
          description: Validation error
  /auth/verify-email:
    post:
      summary: Issue email verification token
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  format: email
      responses:
        '200':
          description: OK
  /auth/verify:
    get:
      summary: Verify email by token
      parameters:
        - in: query
          name: token
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Verified
        '410':
          description: Expired or invalid
  /auth/forgot-password:
    post:
      summary: Issue password reset token
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email]
              properties:
                email:
                  type: string
                  format: email
      responses:
        '200':
          description: OK
  /auth/reset-password:
    post:
      summary: Reset password with token
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [token, newPassword, confirmPassword]
              properties:
                token:
                  type: string
                newPassword:
                  type: string
                confirmPassword:
                  type: string
      responses:
        '200':
          description: OK
        '410':
          description: Expired or invalid
  /user/profile:
    get:
      summary: Get current user profile
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Profile
        '401':
          description: Unauthorized
    put:
      summary: Update current user profile
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
      responses:
        '200':
          description: Updated
        '401':
          description: Unauthorized
  /user/password:
    put:
      summary: Change password
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [currentPassword, newPassword, confirmPassword]
              properties:
                currentPassword:
                  type: string
                newPassword:
                  type: string
                confirmPassword:
                  type: string
      responses:
        '200':
          description: OK
        '401':
          description: Unauthorized
  /admin/ping:
    get:
      summary: Admin ping (admin-only)
      security:
        - bearerAuth: []
      responses:
        '200':
          description: OK
        '401':
          description: Unauthorized
        '403':
          description: Forbidden - requires ADMIN role
  /auth/delete-account:
    post:
      summary: Schedule account deletion and redact sensitive data
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                confirm:
                  type: boolean
                  description: Must be true to confirm deletion
              required: [confirm]
      responses:
        '200':
          description: Deletion scheduled
          content:
            application/json:
              schema:
                type: object
                properties:
                  scheduledAt:
                    type: string
                    format: date-time
        '401':
          description: Unauthorized
        '429':
          description: Too Many Requests
          headers:
            X-RateLimit-Limit:
              $ref: '#/components/headers/RateLimit-Limit'
            X-RateLimit-Remaining:
              $ref: '#/components/headers/RateLimit-Remaining'
  /auth/request-export:
    post:
      summary: Request an export of user data via email
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                format:
                  type: string
                  enum: [json, csv]
              required: [format]
      responses:
        '200':
          description: OK
        '401':
          description: Unauthorized
        '429':
          description: Too Many Requests
  /users/{id}/created-at:
    get:
      summary: Fetch user creation date
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: Creation date
          content:
            application/json:
              schema:
                type: object
                properties:
                  userId:
                    type: integer
                  createdAt:
                    type: string
                    format: date-time
        '401':
          description: Unauthorized
        '404':
          description: Not found
  /id-card:
    get:
      summary: Get current user’s latest active card with recent logs
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Latest active card
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: object
                    nullable: true
                    properties:
                      id:
                        type: string
                      expiresAt:
                        type: string
                        format: date-time
                        nullable: true
                      status:
                        type: string
                        enum: [active]
                      imageUrl:
                        type: string
                      user:
                        type: object
                        properties:
                          id:
                            type: string
                          name:
                            type: string
                          email:
                            type: string
                            format: email
                          image:
                            type: string
                            nullable: true
                          role:
                            type: string
                            enum: [USER, ADMIN]
                      recentVerifications:
                        type: array
                        items:
                          type: object
                          properties:
                            status:
                              type: string
                              enum: [success]
                            verifiedAt:
                              type: string
                              format: date-time
                              nullable: true
                            ipAddress:
                              type: string
                              nullable: true
                      previewUrl:
                        type: string
        '401':
          description: Unauthorized
    post:
      summary: Create an ID card record for the logged-in user
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                displayName:
                  type: string
                attributes:
                  type: object
                  additionalProperties: true
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                  displayName:
                    type: string
                  attributes:
                    type: object
                    additionalProperties: true
        '400':
          description: Validation error
        '401':
          description: Unauthorized
  /id-card/generate:
    post:
      summary: Generate/render an ID card
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [cardId]
              properties:
                cardId:
                  type: string
                options:
                  type: object
                  properties:
                    format:
                      type: string
                      enum: [png, webp]
                    width:
                      type: integer
                    height:
                      type: integer
      responses:
        '200':
          description: Token or URL for generated card
          content:
            application/json:
              schema:
                oneOf:
                  - type: object
                    properties:
                      token:
                        type: string
                      expiresAt:
                        type: string
                        format: date-time
                  - type: object
                    properties:
                      url:
                        type: string
                        format: uri
                      publicId:
                        type: string
        '400':
          description: Validation error
        '401':
          description: Unauthorized
  /id-card/verify/{token}:
    get:
      summary: Verify an ID card token
      parameters:
        - in: path
          name: token
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Valid token
          content:
            application/json:
              schema:
                type: object
                properties:
                  valid:
                    type: boolean
                  cardId:
                    type: string
                  owner:
                    type: object
                    properties:
                      id:
                        type: string
                      name:
                        type: string
        '400':
          description: Bad request
        '410':
          description: Expired or invalid
  /id-card/{id}/image:
    get:
      summary: Retrieve a rendered image or redirect to CDN
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
        - in: query
          name: format
          schema:
            type: string
            enum: [png, webp]
        - in: query
          name: w
          schema:
            type: integer
        - in: query
          name: h
          schema:
            type: integer
      responses:
        '200':
          description: Image bytes or URL
          content:
            application/json:
              schema:
                type: object
                properties:
                  url:
                    type: string
                    format: uri
        '401':
          description: Unauthorized
        '404':
          description: Not found
  /id-card:
    get:
      summary: List user’s ID cards
      security:
        - bearerAuth: []
      parameters:
        - in: query
          name: page
          schema:
            type: integer
            minimum: 1
        - in: query
          name: pageSize
          schema:
            type: integer
            minimum: 1
      responses:
        '200':
          description: Paginated list
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
                    items:
                      type: object
                  total:
                    type: integer
                  page:
                    type: integer
                  pageSize:
                    type: integer
        '401':
          description: Unauthorized
  /cloudinary:
    post:
      summary: Upload an image via Cloudinary
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
      responses:
        '200':
          description: Uploaded
          content:
            application/json:
              schema:
                type: object
                properties:
                  url:
                    type: string
                    format: uri
                  public_id:
                    type: string
                  width:
                    type: integer
                  height:
                    type: integer
                  format:
                    type: string
        '400':
          description: Bad request
        '500':
          description: Server error
  /upload:
    post:
      summary: Alternate upload endpoint
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
      responses:
        '200':
          description: Uploaded
        '400':
          description: Bad request
        '500':
          description: Server error
  /cron/cleanup:
    post:
      summary: Cleanup job (remove expired tokens, execute scheduled deletions)
      parameters:
        - in: header
          name: X-Internal-Cron
          required: false
          schema:
            type: string
      responses:
        '200':
          description: OK
        '403':
          description: Forbidden
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  headers:
    RateLimit-Limit:
      description: The number of allowed requests in the current rate limit window.
      schema:
        type: integer
    RateLimit-Remaining:
      description: The number of remaining requests in the current rate limit window.
      schema:
        type: integer
  schemas:
    Error:
      type: object
      properties:
        error:
          type: string
        details:
          type: string
        code:
          type: string
`;
