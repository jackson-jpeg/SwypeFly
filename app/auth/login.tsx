import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Platform, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { router } from 'expo-router';
import { useAuthContext } from '../../hooks/AuthContext';

function WebLogin() {
  const { signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, browseAsGuest } =
    useAuthContext();
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    setError(null);
    const fn = isSignUp ? signUpWithEmail : signInWithEmail;
    const { error: err } = await fn(email, password);
    setLoading(false);
    if (err) setError(err);
  };

  const handleGuest = () => {
    browseAsGuest();
    router.replace('/(tabs)');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0A0A0A',
        padding: 24,
      }}
    >
      {/* Background with blur effect */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage:
            'url(https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(20px) brightness(0.3)',
          transform: 'scale(1.1)',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 360,
          width: '100%',
        }}
      >
        {/* Logo */}
        <h1
          style={{
            margin: 0,
            fontSize: 42,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: -1,
          }}
        >
          Swype<span style={{ color: '#FF6B35' }}>Fly</span>
        </h1>
        <p
          style={{
            margin: '8px 0 40px 0',
            fontSize: 15,
            color: 'rgba(255,255,255,0.5)',
            fontWeight: 400,
          }}
        >
          Swipe to discover your next adventure
        </p>

        {/* Auth buttons */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Google */}
          <button
            onClick={() => signInWithGoogle()}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: 12,
              border: 'none',
              backgroundColor: '#fff',
              color: '#1a1a1a',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          {/* Apple */}
          <button
            onClick={() => signInWithApple()}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.15)',
              backgroundColor: 'rgba(255,255,255,0.08)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            Continue with Apple
          </button>

          {/* Email */}
          {!showEmail ? (
            <button
              onClick={() => setShowEmail(true)}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.15)',
                backgroundColor: 'transparent',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Continue with Email
            </button>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 16,
                borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.15)',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.15)',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {error && (
                <span style={{ color: '#EF4444', fontSize: 13 }}>{error}</span>
              )}
              <button
                onClick={handleEmailAuth}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: '#FF6B35',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: loading ? 'wait' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 13,
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          )}
        </div>

        {/* Guest */}
        <button
          onClick={handleGuest}
          style={{
            marginTop: 24,
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            fontSize: 14,
            cursor: 'pointer',
            padding: 8,
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Browse without account
        </button>
      </div>
    </div>
  );
}

function NativeLogin() {
  const { signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, browseAsGuest } =
    useAuthContext();
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    setError(null);
    const fn = isSignUp ? signUpWithEmail : signInWithEmail;
    const { error: err } = await fn(email, password);
    setLoading(false);
    if (err) setError(err);
  };

  const handleGuest = () => {
    browseAsGuest();
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', paddingHorizontal: 28 }}
    >
      {/* Logo */}
      <Text style={{ fontSize: 42, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: -1 }}>
        Swype<Text style={{ color: '#FF6B35' }}>Fly</Text>
      </Text>
      <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 8, marginBottom: 40 }}>
        Swipe to discover your next adventure
      </Text>

      {/* Google */}
      <Pressable
        onPress={() => signInWithGoogle()}
        style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          paddingVertical: 14,
          paddingHorizontal: 20,
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Text style={{ color: '#1a1a1a', fontSize: 15, fontWeight: '600' }}>Continue with Google</Text>
      </Pressable>

      {/* Apple */}
      <Pressable
        onPress={() => signInWithApple()}
        style={{
          borderRadius: 12,
          paddingVertical: 14,
          paddingHorizontal: 20,
          alignItems: 'center',
          marginBottom: 12,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.15)',
          backgroundColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Continue with Apple</Text>
      </Pressable>

      {/* Email */}
      {!showEmail ? (
        <Pressable
          onPress={() => setShowEmail(true)}
          style={{
            borderRadius: 12,
            paddingVertical: 14,
            paddingHorizontal: 20,
            alignItems: 'center',
            marginBottom: 12,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' }}>
            Continue with Email
          </Text>
        </Pressable>
      ) : (
        <View
          style={{
            borderRadius: 12,
            padding: 16,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <TextInput
            placeholder="Email"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={{
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
              backgroundColor: 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontSize: 14,
            }}
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
              backgroundColor: 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontSize: 14,
            }}
          />
          {error && <Text style={{ color: '#EF4444', fontSize: 13 }}>{error}</Text>}
          <Pressable
            onPress={handleEmailAuth}
            disabled={loading}
            style={{
              backgroundColor: '#FF6B35',
              borderRadius: 8,
              paddingVertical: 12,
              alignItems: 'center',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Text>
            )}
          </Pressable>
          <Pressable onPress={() => setIsSignUp(!isSignUp)} style={{ alignItems: 'center', padding: 4 }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Guest */}
      <Pressable onPress={handleGuest} style={{ alignItems: 'center', marginTop: 24, padding: 8 }}>
        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, textDecorationLine: 'underline' }}>
          Browse without account
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

export default function LoginScreen() {
  if (Platform.OS === 'web') return <WebLogin />;
  return <NativeLogin />;
}
