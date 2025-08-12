// Types for email sending
type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  sender?: { email: string; name?: string };
};

/**
 * EmailService handles all email sending functionality with Brevo
 */
class EmailService {
  private apiKey: string | undefined;
  private defaultSender: { email: string; name: string };
  private _isInitialized = false;

  /**
   * Check if the email service is initialized
   */
  public get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Update the default sender information
   */
  public setDefaultSender(email: string, name: string): void {
    this.defaultSender = { email, name };
  }

  constructor(apiKey?: string, defaultSenderEmail: string = 'noreply@leamspoyostate.com', defaultSenderName: string = 'Leamsp oyo state') {
    this.apiKey = apiKey || process.env.BREVO_API_KEY;
    this.defaultSender = { email: defaultSenderEmail, name: defaultSenderName };
    this._isInitialized = !!this.apiKey;
  }

  /**
   * Initialize the email service with API key if not provided in constructor
   */
  public async initialize(apiKey?: string): Promise<void> {
    if (this._isInitialized) return;
    
    this.apiKey = apiKey || process.env.BREVO_API_KEY;
    this._isInitialized = !!this.apiKey;
    
    if (!this._isInitialized) {
      console.warn('EmailService: No Brevo API key provided. Email sending will be disabled.');
    }
  }

  /**
   * Send an email using Brevo
   */
  public async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
    // Skip sending emails if not initialized (e.g., in test environment)
    if (!this.isInitialized) {
      console.warn('EmailService: Not initialized. Email not sent:', {
        to: options.to,
        subject: options.subject
      });
      return { success: true };
    }

    try {
      // Dynamically import Brevo to avoid bundling issues
      const brevo = await import('@getbrevo/brevo');
      
      // Create API instance and set API key
      const apiInstance = new brevo.TransactionalEmailsApi();
      (apiInstance as any).authentications.apiKey.apiKey = this.apiKey;
      
      // Prepare sender
      const sender = options.sender || this.defaultSender;
      
      // Prepare recipients
      const toAddresses = Array.isArray(options.to) 
        ? options.to.map(email => ({ email })) 
        : [{ email: options.to }];
      
      // Create sendSmtpEmail object
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.subject = options.subject;
      sendSmtpEmail.htmlContent = options.html;
      sendSmtpEmail.sender = sender;
      sendSmtpEmail.to = toAddresses;
      
      // Add text content if provided
      if (options.text) {
        sendSmtpEmail.textContent = options.text;
      }
      
      // Send email
      const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
      
      // Check if the response indicates success
      if (response.response?.statusCode && response.response.statusCode >= 200 && response.response.statusCode < 300) {
        return { success: true };
      } else {
        console.error('EmailService: Failed to send email - unexpected response:', response);
        return { success: false, error: 'Failed to send email' };
      }
    } catch (error) {
      console.error('EmailService: Error sending email:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null && 'response' in error
          ? JSON.stringify((error as any).response?.body)
          : 'Unknown error occurred';
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }

  /**
   * Send an email verification email using Brevo
   */
  public async sendVerificationEmail(
    email: string, 
    verificationUrl: string,
    userName?: string
  ): Promise<{ success: boolean; error?: string }> {
    const subject = 'Verify your email address';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Welcome${userName ? ` ${userName}` : ''}!</h1>
        <p>Thank you for signing up. Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 4px; font-weight: bold;">
            Verify Email
          </a>
        </div>
        <p>Or copy and paste this URL into your browser:</p>
        <p style="word-break: break-all;">${verificationUrl}</p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          This link will expire in 24 hours.
        </p>
      </div>
    `;

    const text = `Welcome${userName ? ` ${userName}` : ''}!

Thank you for signing up. Please verify your email address by visiting this URL:

${verificationUrl}

This link will expire in 24 hours.`;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
      sender: {
        email: this.defaultSender.email,
        name: 'LeamSP Verification'
      }
    });
  }

  /**
   * Send a password reset email using Brevo
   */
  public async sendPasswordResetEmail(
    email: string, 
    resetUrl: string,
    userName?: string
  ): Promise<{ success: boolean; error?: string }> {
    const subject = 'Reset Your Password';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Reset Your Password</h1>
        <p>Hello${userName ? ` ${userName}` : ''},</p>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 4px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p>Or copy and paste this URL into your browser:</p>
        <p style="word-break: break-all;">${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          If you didn't request this, please ignore this email and your password will remain unchanged.
        </p>
      </div>
    `;

    const text = `Hello${userName ? ` ${userName}` : ''},

We received a request to reset your password. Please visit the following link to set a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request this, please ignore this email and your password will remain unchanged.`;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
      sender: {
        email: this.defaultSender.email,
        name: 'LeamSP Support'
      }
    });
  }
}

// Export a singleton instance
const emailService = new EmailService();

export { EmailService, emailService };
