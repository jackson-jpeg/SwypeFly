import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useAuthContext } from '@/hooks/AuthContext';

const emailInputStyle: React.CSSProperties = {
  width: '100%',
  height: 44,
  borderRadius: 10,
  border: '1px solid #C9A99A60',
  paddingInline: 14,
  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
  fontSize: 15,
  color: colors.deepDusk,
  outline: 'none',
  backgroundColor: colors.duskSand,
  boxSizing: 'border-box',
};

export default function LoginScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    signInWithGoogle, signInWithApple, signInWithTikTok,
    signInWithEmail, signUpWithEmail, verifyEmail, resendVerification,
    forgotPassword, resetPassword,
    browseAsGuest,
  } = useAuthContext();
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(
    searchParams.get('error') === 'oauth' ? 'Social login failed. Please try again or use email.' : null,
  );
  const [emailLoading, setEmailLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // Verification state
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleEmailSubmit = async () => {
    if (!email || !password) {
      setEmailError('Please enter both email and password');
      return;
    }
    setEmailLoading(true);
    setEmailError(null);

    if (isSignUp) {
      const result = await signUpWithEmail(email, password);
      setEmailLoading(false);
      if (result.error) {
        setEmailError(result.error);
      } else if (result.needsVerification) {
        setNeedsVerification(true);
      } else {
        navigate('/');
      }
    } else {
      const result = await signInWithEmail(email, password);
      setEmailLoading(false);
      if (result.error) {
        setEmailError(result.error);
      } else {
        navigate('/');
      }
    }
  };

  const handleVerify = async () => {
    if (!verificationCode.trim()) {
      setVerifyError('Please enter the verification code');
      return;
    }
    setVerifyLoading(true);
    setVerifyError(null);
    const result = await verifyEmail(verificationCode.trim());
    setVerifyLoading(false);
    if (result.error) {
      setVerifyError(result.error);
    } else {
      navigate('/');
    }
  };

  const handleForgotSubmit = async () => {
    if (!email) {
      setResetError('Please enter your email address above');
      return;
    }
    setResetLoading(true);
    setResetError(null);
    const result = await forgotPassword(email);
    setResetLoading(false);
    if (result.error) {
      setResetError(result.error);
    } else {
      setResetSent(true);
    }
  };

  const handleResetSubmit = async () => {
    if (!resetCode.trim() || !newPassword) {
      setResetError('Please enter the code and a new password');
      return;
    }
    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters');
      return;
    }
    setResetLoading(true);
    setResetError(null);
    const result = await resetPassword(resetCode.trim(), newPassword);
    setResetLoading(false);
    if (result.error) {
      setResetError(result.error);
    } else {
      setResetSuccess(true);
      setTimeout(() => {
        setForgotMode(false);
        setResetSent(false);
        setResetCode('');
        setNewPassword('');
        setResetSuccess(false);
      }, 2000);
    }
  };

  const handleResend = async () => {
    setResendMsg(null);
    setVerifyError(null);
    const result = await resendVerification();
    if (result.error) {
      setVerifyError(result.error);
    } else {
      setResendMsg('Code resent — check your inbox');
      setTimeout(() => setResendMsg(null), 4000);
    }
  };

  return (
    <div className="screen-fixed" style={{ background: colors.duskSand, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'clip' }}>
      {/* Background destination photo — 15% opacity */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/images/login-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
          opacity: 0.15,
        }}
      />

      {/* Main content */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 60,
          paddingTop: 80,
          paddingBottom: 40,
          paddingLeft: 20,
          paddingRight: 20,
        }}
      >
        {/* Logo + tagline */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <h1
            style={{
              fontFamily: `"${fonts.display}", system-ui, sans-serif`,
              fontWeight: 800,
              fontSize: 32,
              lineHeight: '36px',
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              color: colors.deepDusk,
              textAlign: 'center',
              margin: 0,
            }}
          >
            Welcome to SoGoJet
          </h1>
          <p
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 14,
              lineHeight: '18px',
              color: colors.borderTint,
              textAlign: 'center',
              margin: 0,
            }}
          >
            Discover incredible flight deals and plan your perfect trip
          </p>
        </div>

        {/* Auth buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
          {/* Error banner */}
          {emailError && !showEmail && !needsVerification && (
            <div
              style={{
                backgroundColor: '#FEE2E2',
                border: '1px solid #FECACA',
                borderRadius: 12,
                padding: '12px 16px',
                textAlign: 'center',
              }}
            >
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: '#991B1B' }}>
                {emailError}
              </span>
            </div>
          )}

          {/* ── Forgot password flow ── */}
          {forgotMode ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                backgroundColor: colors.offWhite,
                border: '1px solid #C9A99A40',
                borderRadius: 14,
                padding: 20,
                width: '100%',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 15, fontWeight: 600, color: colors.deepDusk }}>
                  Reset your password
                </span>
              </div>

              {resetSuccess ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingBlock: 12 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={colors.confirmGreen} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: colors.confirmGreen }}>
                    Password reset successfully!
                  </span>
                </div>
              ) : !resetSent ? (
                <>
                  <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.mutedText, textAlign: 'center' }}>
                    Enter your email and we'll send a reset code
                  </span>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setResetError(null); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleForgotSubmit()}
                    style={emailInputStyle}
                  />
                  {resetError && (
                    <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.terracotta, textAlign: 'center' }}>
                      {resetError}
                    </span>
                  )}
                  <button
                    onClick={handleForgotSubmit}
                    disabled={resetLoading}
                    style={{
                      width: '100%',
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: colors.deepDusk,
                      border: 'none',
                      cursor: resetLoading ? 'wait' : 'pointer',
                      opacity: resetLoading ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 15, fontWeight: 600, color: colors.paleHorizon }}>
                      {resetLoading ? 'Sending...' : 'Send Reset Code'}
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.mutedText, textAlign: 'center' }}>
                    Enter the code sent to <strong style={{ color: colors.deepDusk }}>{email}</strong> and your new password
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Reset code"
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => { setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setResetError(null); }}
                    style={{ ...emailInputStyle, textAlign: 'center', fontSize: 20, fontWeight: 600, letterSpacing: '0.2em' }}
                  />
                  <input
                    type="password"
                    placeholder="New password (min 8 characters)"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setResetError(null); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleResetSubmit()}
                    style={emailInputStyle}
                  />
                  {resetError && (
                    <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.terracotta, textAlign: 'center' }}>
                      {resetError}
                    </span>
                  )}
                  <button
                    onClick={handleResetSubmit}
                    disabled={resetLoading}
                    style={{
                      width: '100%',
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: colors.deepDusk,
                      border: 'none',
                      cursor: resetLoading ? 'wait' : 'pointer',
                      opacity: resetLoading ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 15, fontWeight: 600, color: colors.paleHorizon }}>
                      {resetLoading ? 'Resetting...' : 'Reset Password'}
                    </span>
                  </button>
                </>
              )}

              <button
                onClick={() => { setForgotMode(false); setResetSent(false); setResetCode(''); setNewPassword(''); setResetError(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, alignSelf: 'center' }}
              >
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.sageDrift }}>
                  Back to sign in
                </span>
              </button>
            </div>
          ) : needsVerification ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                backgroundColor: colors.offWhite,
                border: '1px solid #C9A99A40',
                borderRadius: 14,
                padding: 20,
                width: '100%',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 15, fontWeight: 600, color: colors.deepDusk }}>
                  Verify your email
                </span>
              </div>
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.mutedText, textAlign: 'center' }}>
                We sent a 6-digit code to <strong style={{ color: colors.deepDusk }}>{email}</strong>
              </span>

              <input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => {
                  setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setVerifyError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                style={{
                  ...emailInputStyle,
                  textAlign: 'center',
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: '0.3em',
                  height: 56,
                }}
              />

              {verifyError && (
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.terracotta, textAlign: 'center' }}>
                  {verifyError}
                </span>
              )}
              {resendMsg && (
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.confirmGreen, textAlign: 'center' }}>
                  {resendMsg}
                </span>
              )}

              <button
                onClick={handleVerify}
                disabled={verifyLoading}
                style={{
                  width: '100%',
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: colors.deepDusk,
                  border: 'none',
                  cursor: verifyLoading ? 'wait' : 'pointer',
                  opacity: verifyLoading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 15, fontWeight: 600, color: colors.paleHorizon }}>
                  {verifyLoading ? 'Verifying...' : 'Verify'}
                </span>
              </button>

              <button
                onClick={handleResend}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  alignSelf: 'center',
                }}
              >
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 13, color: colors.sageDrift }}>
                  Resend code
                </span>
              </button>
            </div>
          ) : (
            <>
              {/* Google */}
              <button
                onClick={() => signInWithGoogle()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  height: 56,
                  borderRadius: 14,
                  backgroundColor: '#FFFFFF',
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span
                  style={{
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 15,
                    fontWeight: 600,
                    lineHeight: '18px',
                    color: colors.deepDusk,
                  }}
                >
                  Continue with Google
                </span>
              </button>

              {/* Apple */}
              <button
                onClick={() => signInWithApple()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  height: 56,
                  borderRadius: 14,
                  backgroundColor: colors.deepDusk,
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                <span
                  style={{
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 15,
                    fontWeight: 600,
                    lineHeight: '18px',
                    color: colors.paleHorizon,
                  }}
                >
                  Continue with Apple
                </span>
              </button>

              {/* TikTok */}
              <button
                onClick={() => signInWithTikTok()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  height: 56,
                  borderRadius: 14,
                  backgroundColor: '#000000',
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.98a8.21 8.21 0 0 0 4.76 1.52V7.05a4.84 4.84 0 0 1-1-.36z" />
                </svg>
                <span
                  style={{
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 15,
                    fontWeight: 600,
                    lineHeight: '18px',
                    color: '#FFFFFF',
                  }}
                >
                  Continue with TikTok
                </span>
              </button>

              {/* Email */}
              {!showEmail ? (
                <button
                  onClick={() => setShowEmail(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    height: 56,
                    borderRadius: 14,
                    backgroundColor: colors.offWhite,
                    border: '1px solid #C9A99A40',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.deepDusk} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <span
                    style={{
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      fontSize: 15,
                      fontWeight: 600,
                      lineHeight: '18px',
                      color: colors.deepDusk,
                    }}
                  >
                    Continue with Email
                  </span>
                </button>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    backgroundColor: colors.offWhite,
                    border: '1px solid #C9A99A40',
                    borderRadius: 14,
                    padding: 16,
                    width: '100%',
                  }}
                >
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={emailInputStyle}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                    style={emailInputStyle}
                  />
                  {emailError && (
                    <span
                      style={{
                        fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                        fontSize: 13,
                        color: colors.terracotta,
                      }}
                    >
                      {emailError}
                    </span>
                  )}
                  <button
                    onClick={handleEmailSubmit}
                    disabled={emailLoading}
                    style={{
                      width: '100%',
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: colors.deepDusk,
                      border: 'none',
                      cursor: emailLoading ? 'wait' : 'pointer',
                      opacity: emailLoading ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                        fontSize: 15,
                        fontWeight: 600,
                        color: colors.paleHorizon,
                      }}
                    >
                      {emailLoading ? 'Signing in...' : isSignUp ? 'Create Account' : 'Sign In'}
                    </span>
                  </button>
                  <button
                    onClick={() => setIsSignUp(!isSignUp)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 4,
                      alignSelf: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                        fontSize: 13,
                        color: colors.sageDrift,
                      }}
                    >
                      {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                    </span>
                  </button>
                  {!isSignUp && (
                    <button
                      onClick={() => { setForgotMode(true); setEmailError(null); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        alignSelf: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                          fontSize: 13,
                          color: colors.borderTint,
                        }}
                      >
                        Forgot password?
                      </span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom section: Guest + Terms */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          paddingLeft: 20,
          paddingRight: 20,
          paddingBottom: 40,
          marginTop: 'auto',
        }}
      >
        {!needsVerification && (
          <button
            onClick={() => { browseAsGuest(); navigate('/'); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 56,
              borderRadius: 14,
              backgroundColor: '#A8C4B830',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 15,
                fontWeight: 600,
                lineHeight: '18px',
                color: colors.sageDrift,
              }}
            >
              Continue as Guest
            </span>
          </button>
        )}
        <p
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 11,
            lineHeight: '14px',
            color: colors.borderTint,
            textAlign: 'center',
            margin: 0,
          }}
        >
          By continuing, you agree to our{' '}
          <a href="/legal/terms" style={{ color: colors.sageDrift, textDecoration: 'underline' }}>Terms</a>
          {' & '}
          <a href="/legal/privacy" style={{ color: colors.sageDrift, textDecoration: 'underline' }}>Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
