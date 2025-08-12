export type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  DEV_MODE?: string;
  ENVIRONMENT?: 'development' | 'production';
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_UPLOAD_PRESET?: string;
  CLOUDINARY_FOLDER?: string;
  CRON_SECRET?: string;
};

export type EmailEnv = Pick<Bindings, 'RESEND_API_KEY' | 'ENVIRONMENT'>;
