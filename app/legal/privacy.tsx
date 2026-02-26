import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';

const LAST_UPDATED = 'February 9, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    return (
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 8px', color: '#1E293B', fontSize: 18, fontWeight: 700 }}>{title}</h2>
        {children}
      </div>
    );
  }
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ color: '#1E293B', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{title}</Text>
      {children}
    </View>
  );
}

function P({ children }: { children: string }) {
  if (Platform.OS === 'web') {
    return <p style={{ margin: '0 0 8px', color: '#475569', fontSize: 14, lineHeight: '22px' }}>{children}</p>;
  }
  return <Text style={{ color: '#475569', fontSize: 14, lineHeight: 22, marginBottom: 8 }}>{children}</Text>;
}

export default function PrivacyPolicy() {
  if (Platform.OS === 'web') {
    return (
      <div style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', overflowY: 'auto' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 20px 100px' }}>
          <button
            onClick={() => router.back()}
            style={{
              background: 'none', border: 'none', color: '#0EA5E9', fontSize: 15,
              fontWeight: 600, cursor: 'pointer', padding: '12px 0', marginBottom: 8,
            }}
          >
            &larr; Back
          </button>

          <h1 style={{ margin: '0 0 4px', color: '#1E293B', fontSize: 28, fontWeight: 800 }}>Privacy Policy</h1>
          <p style={{ margin: '0 0 24px', color: '#94A3B8', fontSize: 13 }}>Last updated: {LAST_UPDATED}</p>

          <Section title="Introduction">
            <P>SoGoJet ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share information when you use our travel discovery application.</P>
          </Section>

          <Section title="Information We Collect">
            <P>Account information: email address and authentication credentials when you create an account.</P>
            <P>Usage data: swipe history (viewed, skipped, saved destinations), time spent viewing destinations, and interaction patterns to personalize your feed.</P>
            <P>Preferences: departure city, budget level, travel style preferences (beach, city, adventure, etc.), and currency selection.</P>
            <P>Device information: browser type, platform, and general usage analytics.</P>
          </Section>

          <Section title="How We Use Your Information">
            <P>To personalize your destination recommendations based on your preferences and behavior.</P>
            <P>To display relevant flight and hotel prices for your selected departure city.</P>
            <P>To improve our recommendation algorithms and overall service quality.</P>
            <P>To communicate service updates if you have an account.</P>
          </Section>

          <Section title="Third-Party Services">
            <P>Appwrite: database hosting and user authentication.</P>
            <P>Travelpayouts / Aviasales: flight price data and affiliate booking links.</P>
            <P>Amadeus: supplemental flight pricing data.</P>
            <P>LiteAPI: hotel pricing data.</P>
            <P>Vercel: application hosting and serverless API infrastructure.</P>
            <P>Sentry (optional): error monitoring and performance tracking.</P>
          </Section>

          <Section title="Cookies & Local Storage">
            <P>We use browser localStorage to persist your preferences (departure city, currency, haptic settings) and session state. We do not use third-party tracking cookies. Third-party services loaded on the site may set their own cookies according to their respective privacy policies.</P>
          </Section>

          <Section title="Your Rights">
            <P>Access: you can request a copy of the personal data we hold about you.</P>
            <P>Deletion: you can request deletion of your account and associated data by contacting us.</P>
            <P>Data export: you can request an export of your swipe history and preferences.</P>
            <P>Opt-out: you can use the app in Guest mode without creating an account, limiting data collection to local device storage only.</P>
          </Section>

          <Section title="Data Retention">
            <P>We retain your data for as long as your account is active. If you delete your account, we will remove your personal data within 30 days. Anonymized, aggregated analytics data may be retained indefinitely.</P>
          </Section>

          <Section title="Contact Us">
            <P>If you have questions about this Privacy Policy or wish to exercise your data rights, please contact us at privacy@sogojet.com.</P>
          </Section>
        </div>
      </div>
    );
  }

  // Native
  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={{ paddingVertical: 12, marginBottom: 8 }}>
          <Text style={{ color: '#0EA5E9', fontSize: 15, fontWeight: '600' }}>&larr; Back</Text>
        </Pressable>

        <Text style={{ color: '#1E293B', fontSize: 28, fontWeight: '800', marginBottom: 4 }}>Privacy Policy</Text>
        <Text style={{ color: '#94A3B8', fontSize: 13, marginBottom: 24 }}>Last updated: {LAST_UPDATED}</Text>

        <Section title="Introduction">
          <P>SoGoJet ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share information when you use our travel discovery application.</P>
        </Section>

        <Section title="Information We Collect">
          <P>Account information: email address and authentication credentials when you create an account.</P>
          <P>Usage data: swipe history (viewed, skipped, saved destinations), time spent viewing destinations, and interaction patterns to personalize your feed.</P>
          <P>Preferences: departure city, budget level, travel style preferences (beach, city, adventure, etc.), and currency selection.</P>
          <P>Device information: browser type, platform, and general usage analytics.</P>
        </Section>

        <Section title="How We Use Your Information">
          <P>To personalize your destination recommendations based on your preferences and behavior.</P>
          <P>To display relevant flight and hotel prices for your selected departure city.</P>
          <P>To improve our recommendation algorithms and overall service quality.</P>
          <P>To communicate service updates if you have an account.</P>
        </Section>

        <Section title="Third-Party Services">
          <P>Appwrite: database hosting and user authentication.</P>
          <P>Travelpayouts / Aviasales: flight price data and affiliate booking links.</P>
          <P>Amadeus: supplemental flight pricing data.</P>
          <P>LiteAPI: hotel pricing data.</P>
          <P>Vercel: application hosting and serverless API infrastructure.</P>
          <P>Sentry (optional): error monitoring and performance tracking.</P>
        </Section>

        <Section title="Cookies & Local Storage">
          <P>We use browser localStorage to persist your preferences (departure city, currency, haptic settings) and session state. We do not use third-party tracking cookies. Third-party services loaded on the site may set their own cookies according to their respective privacy policies.</P>
        </Section>

        <Section title="Your Rights">
          <P>Access: you can request a copy of the personal data we hold about you.</P>
          <P>Deletion: you can request deletion of your account and associated data by contacting us.</P>
          <P>Data export: you can request an export of your swipe history and preferences.</P>
          <P>Opt-out: you can use the app in Guest mode without creating an account, limiting data collection to local device storage only.</P>
        </Section>

        <Section title="Data Retention">
          <P>We retain your data for as long as your account is active. If you delete your account, we will remove your personal data within 30 days. Anonymized, aggregated analytics data may be retained indefinitely.</P>
        </Section>

        <Section title="Contact Us">
          <P>If you have questions about this Privacy Policy or wish to exercise your data rights, please contact us at privacy@sogojet.com.</P>
        </Section>
      </ScrollView>
    </View>
  );
}
