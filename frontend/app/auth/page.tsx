'use client';

import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  X,
  CheckCircle,
  AlertCircle,
  MailCheck,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IrisLogo } from '@/components/iris-logo';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');
  const returnUrl = searchParams.get('returnUrl');
  const message = searchParams.get('message');

  const isSignUp = mode === 'signup';
  const [mounted, setMounted] = useState(false);

  const isSuccessMessage =
    message &&
    (message.includes('Check your email') ||
      message.includes('Account created') ||
      message.includes('success'));

  // Registration success state
  const [registrationSuccess, setRegistrationSuccess] =
    useState(!!isSuccessMessage);
  const [registrationEmail, setRegistrationEmail] = useState('');

  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordStatus, setForgotPasswordStatus] = useState<{
    success?: boolean;
    message?: string;
  }>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isSuccessMessage) {
      setRegistrationSuccess(true);
    }
  }, [isSuccessMessage]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      // TODO: Implement actual sign in with Supabase
      toast.success('Sign in functionality will be implemented with Supabase');
      router.push(returnUrl || '/');
    } catch (error) {
      toast.error('Sign in failed');
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setRegistrationEmail(email);

    try {
      // TODO: Implement actual sign up with Supabase
      setRegistrationSuccess(true);
      toast.success('Account created! Check your email to confirm your registration.');
    } catch (error) {
      toast.error('Sign up failed');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setForgotPasswordStatus({});

    if (!forgotPasswordEmail || !forgotPasswordEmail.includes('@')) {
      setForgotPasswordStatus({
        success: false,
        message: 'Please enter a valid email address',
      });
      return;
    }

    try {
      // TODO: Implement actual forgot password with Supabase
      setForgotPasswordStatus({
        success: true,
        message: 'Check your email for a password reset link',
      });
    } catch (error) {
      setForgotPasswordStatus({
        success: false,
        message: 'Failed to send password reset email',
      });
    }
  };

  const resetRegistrationSuccess = () => {
    setRegistrationSuccess(false);
    const params = new URLSearchParams(window.location.search);
    params.delete('message');
    params.set('mode', 'signin');

    const newUrl =
      window.location.pathname +
      (params.toString() ? '?' + params.toString() : '');

    window.history.pushState({ path: newUrl }, '', newUrl);
    router.refresh();
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Registration success view
  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="text-center">
            <div className="bg-green-50 dark:bg-green-950/20 rounded-full p-4 mb-6 inline-flex">
              <MailCheck className="h-12 w-12 text-green-500 dark:text-green-400" />
            </div>

            <h1 className="text-3xl font-semibold text-foreground mb-4">
              Check your email
            </h1>

            <p className="text-muted-foreground mb-2">
              We've sent a confirmation link to:
            </p>

            <p className="text-lg font-medium mb-6">
              {registrationEmail || 'your email address'}
            </p>

            <div className="bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/50 rounded-lg p-4 mb-8">
              <p className="text-sm text-green-800 dark:text-green-400">
                Click the link in the email to activate your account. If you don't see the email, check your spam folder.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Link
                href="/"
                className="flex h-11 items-center justify-center px-6 text-center rounded-lg border border-border bg-background hover:bg-accent transition-colors"
              >
                Return to home
              </Link>
              <button
                onClick={resetRegistrationSuccess}
                className="flex h-11 items-center justify-center px-6 text-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Back to sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute top-6 left-6 z-10">
        <IrisLogo width={28} height={28} />
      </div>
      <div className="flex min-h-screen">
        <div className="relative flex-1 flex items-center justify-center p-4 lg:p-8">
          <div className="w-full max-w-sm">
            <div className="mb-4 flex items-center flex-col gap-3 sm:gap-4 justify-center">
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground text-center leading-tight">
                {isSignUp ? 'Create your account' : 'Log into your account'}
              </h1>
            </div>
            
            <div className="space-y-3 mb-4">
              <Button
                variant="outline"
                className="w-full h-10"
                onClick={() => {
                  // TODO: Implement Google OAuth
                  toast.info('Google sign-in will be implemented with Supabase');
                }}
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>
              <Button
                variant="outline"
                className="w-full h-10"
                onClick={() => {
                  // TODO: Implement GitHub OAuth
                  toast.info('GitHub sign-in will be implemented with Supabase');
                }}
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Continue with GitHub
              </Button>
            </div>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-muted-foreground">
                  or email
                </span>
              </div>
            </div>
            
            <form className="space-y-3" onSubmit={isSignUp ? handleSignUp : handleSignIn}>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Email address"
                className="h-10 rounded-lg"
                required
              />
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Password"
                className="h-10 rounded-lg"
                required
              />
              {isSignUp && (
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm password"
                  className="h-10 rounded-lg"
                  required
                />
              )}
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors rounded-lg"
                >
                  {isSignUp ? 'Create account' : 'Sign in'}
                </Button>
              </div>
            </form>
            
            <div className="mt-4 space-y-3 text-center text-sm">
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => setForgotPasswordOpen(true)}
                  className="text-primary hover:underline"
                >
                  Forgot password?
                </button>
              )}
              
              <div>
                <Link
                  href={isSignUp 
                    ? `/auth${returnUrl ? `?returnUrl=${returnUrl}` : ''}`
                    : `/auth?mode=signup${returnUrl ? `&returnUrl=${returnUrl}` : ''}`
                  }
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isSignUp 
                    ? 'Already have an account? Sign in' 
                    : "Don't have an account? Sign up"
                  }
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative z-10 text-center text-white">
            <IrisLogo width={120} height={120} className="mx-auto mb-8" />
            <h2 className="text-3xl font-bold mb-4">Welcome to Iris</h2>
            <p className="text-xl opacity-90">Your AI assistant for everything</p>
          </div>
        </div>
      </div>
      
      {/* Forgot Password Dialog */}
      {forgotPasswordOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Reset Password</h3>
              <button
                onClick={() => setForgotPasswordOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <Input
                id="forgot-password-email"
                type="email"
                placeholder="Email address"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
              {forgotPasswordStatus.message && (
                <div
                  className={`p-3 rounded-md flex items-center gap-3 ${
                    forgotPasswordStatus.success
                      ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 text-green-800 dark:text-green-400'
                      : 'bg-destructive/10 border border-destructive/20 text-destructive'
                  }`}
                >
                  {forgotPasswordStatus.success ? (
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span className="text-sm">{forgotPasswordStatus.message}</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotPasswordOpen(false)}
                  className="flex-1 h-10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-10"
                >
                  Send Reset Link
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Login() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
