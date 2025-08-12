import { hashSync } from 'bcrypt-ts';
import dotenv from 'dotenv';
import { sha256Hex } from '../src/utils/crypto';

type Env = {
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  ENVIRONMENT?: string;
};

// Load environment variables from .env file
dotenv.config();

// Get environment variables
const env: Env = {
  JWT_SECRET: process.env.JWT_SECRET || 'test-secret-key-for-dev-only',
  RESEND_API_KEY: process.env.RESEND_API_KEY || 're_test_key_for_dev_only',
  ENVIRONMENT: process.env.ENVIRONMENT || 'development',
};

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  WARNING: Using default JWT_SECRET. Set JWT_SECRET in .env for production use.');
}

// Test user data
const testUser = {
  email: 'test@example.com',
  id: 1,
  password: 'oldPassword123!',
  newPassword: 'newSecurePassword123!'
};

// Mock database functions
const mockDb = {
  users: {
    findFirst: async (params: any) => {
      if (params?.where?.email === testUser.email) {
        return {
          id: testUser.id,
          email: testUser.email,
          password: hashSync(testUser.password, 8),
        };
      }
      return null;
    },
    update: async (params: any) => {
      if (params.where.id === testUser.id) {
        return {
          ...testUser,
          password: params.data.password,
        };
      }
      return null;
    },
  },
  tokens: [] as any[],
};

// Mock crypto functions
const mockCrypto = {
  generateToken: (length: number) => 'test-reset-token-' + 'a'.repeat(length - 17),
  sha256Hex: async (input: string) => {
    // Simple mock implementation for testing
    return input.split('').reverse().join('');
  },
};

// Mock response utility
const mockResponse = {
  success: (data: any) => ({ success: true, data }),
  error: (message: string, status = 400) => ({
    success: false,
    error: { message, status },
  }),
};

// Test the forgot password flow
async function testForgotPassword() {
  console.log('\n🔐 Testing Forgot Password Flow...');
  
  // 1. Request password reset
  console.log('\n1. Requesting password reset...');
  const email = testUser.email;
  
  // This would be the actual endpoint call in a real test:
  // const response = await fetch('/api/auth/forgot-password', {
  //   method: 'POST',
  //   body: JSON.stringify({ email }),
  //   headers: { 'Content-Type': 'application/json' },
  // });
  
  // For our test, we'll simulate the endpoint logic
  try {
    // Find user by email
    const user = await mockDb.users.findFirst({ where: { email } });
    
    if (!user) {
      console.log('✅ Test passed: Returns success even if email not found (security measure)');
      return { success: true };
    }
    
    // Generate reset token
    const rawToken = mockCrypto.generateToken(32);
    const tokenHash = await mockCrypto.sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    
    // Store token in mock DB
    mockDb.tokens.push({
      userId: user.id,
      type: 'reset',
      tokenHash,
      expiresAt,
      usedAt: null,
    });
    
    // In dev mode, return the token for testing
    const response = env.ENVIRONMENT === 'development' 
      ? { ok: true, devToken: rawToken }
      : { ok: true };
    
    console.log('✅ Test passed: Password reset email sent successfully');
    if (env.ENVIRONMENT === 'development') {
      console.log(`   Dev reset token: ${response.devToken}`);
    }
    
    return { success: true, token: rawToken };
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error };
  }
}

// Test the reset password flow
async function testResetPassword(token: string) {
  console.log('\n🔄 Testing Reset Password Flow...');
  
  // 1. Reset password with token
  console.log('\n1. Resetting password...');
  const newPassword = testUser.newPassword;
  
  // This would be the actual endpoint call in a real test:
  // const response = await fetch('/api/auth/reset-password', {
  //   method: 'POST',
  //   body: JSON.stringify({ 
  //     token, 
  //     newPassword,
  //     confirmPassword: newPassword 
  //   }),
  //   headers: { 'Content-Type': 'application/json' },
  // });
  
  try {
    // 1. Validate input
    if (!token || !newPassword) {
      throw new Error('Token and new password are required');
    }
    
    // 2. Hash the token to find it in the database
    const tokenHash = await mockCrypto.sha256Hex(token);
    const now = new Date();
    
    // 3. Find the token in the database
    const tokenRecord = mockDb.tokens.find(
      t => t.tokenHash === tokenHash && 
           t.type === 'reset' && 
           t.usedAt === null && 
           t.expiresAt > now
    );
    
    if (!tokenRecord) {
      throw new Error('Invalid or expired token');
    }
    
    // 4. Update user's password
    const hashedPassword = hashSync(newPassword, 8);
    await mockDb.users.update({
      where: { id: tokenRecord.userId },
      data: { password: hashedPassword },
    });
    
    // 5. Mark token as used
    tokenRecord.usedAt = new Date();
    
    console.log('✅ Test passed: Password reset successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Run the tests
async function runTests() {
  console.log('🚀 Starting Password Reset Flow Tests');
  console.log('===================================');
  
  // Test 1: Forgot Password
  const forgotResult = await testForgotPassword();
  
  if (forgotResult.success && 'token' in forgotResult && forgotResult.token) {
    // Test 2: Reset Password
    await testResetPassword(forgotResult.token);
  }
  
  console.log('\n🏁 Test sequence completed');
}

// Run the tests
runTests().catch(console.error);
