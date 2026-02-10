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

export default function TermsOfService() {
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

          <h1 style={{ margin: '0 0 4px', color: '#1E293B', fontSize: 28, fontWeight: 800 }}>Terms of Service</h1>
          <p style={{ margin: '0 0 24px', color: '#94A3B8', fontSize: 13 }}>Last updated: {LAST_UPDATED}</p>

          <Section title="Service Description">
            <P>SoGoJet is a travel discovery platform that helps you explore destinations through a swipe-based interface. We provide personalized recommendations, estimated flight and hotel prices, and links to third-party booking services.</P>
          </Section>

          <Section title="Acceptable Use">
            <P>You agree to use SoGoJet for personal, non-commercial purposes only. You will not attempt to scrape, reverse-engineer, or interfere with the operation of our service. You will not create automated accounts or use bots to interact with the platform.</P>
          </Section>

          <Section title="Affiliate Links & Pricing Disclaimer">
            <P>SoGoJet displays estimated flight and hotel prices sourced from third-party providers including Travelpayouts, Amadeus, and LiteAPI. These prices are estimates and may differ from actual prices at the time of booking.</P>
            <P>When you click through to book flights, hotels, or activities, you will be directed to third-party websites. SoGoJet may earn a commission from these referrals at no additional cost to you. We are not responsible for the booking process, pricing, or terms of these third-party services.</P>
            <P>All bookings are subject to the terms and conditions of the respective booking platform.</P>
          </Section>

          <Section title="Content Accuracy">
            <P>We strive to provide accurate destination information, including descriptions, ratings, weather data, and travel recommendations. However, we cannot guarantee the accuracy, completeness, or timeliness of all content. Destination details, safety conditions, and travel requirements can change without notice.</P>
            <P>Always verify travel requirements, visa regulations, and safety advisories with official sources before booking travel.</P>
          </Section>

          <Section title="User Accounts">
            <P>You are responsible for maintaining the security of your account credentials. You may use the app in Guest mode without creating an account, with limited functionality.</P>
            <P>We reserve the right to suspend or terminate accounts that violate these terms or engage in suspicious activity.</P>
          </Section>

          <Section title="Limitation of Liability">
            <P>SoGoJet is provided "as is" without warranties of any kind, express or implied. We are not liable for any direct, indirect, incidental, or consequential damages arising from your use of the service.</P>
            <P>We are not responsible for any losses incurred from travel bookings made through third-party links on our platform, including but not limited to price changes, booking errors, or service disruptions by third-party providers.</P>
          </Section>

          <Section title="Intellectual Property">
            <P>All content, design, and code within SoGoJet are the property of SoGoJet and its licensors. You may not copy, modify, or distribute our content without prior written permission.</P>
          </Section>

          <Section title="Changes to Terms">
            <P>We may update these Terms of Service from time to time. Continued use of the service after changes constitutes acceptance of the updated terms. We will indicate the date of the most recent update at the top of this page.</P>
          </Section>

          <Section title="Contact Us">
            <P>If you have questions about these Terms of Service, please contact us at legal@sogojet.com.</P>
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

        <Text style={{ color: '#1E293B', fontSize: 28, fontWeight: '800', marginBottom: 4 }}>Terms of Service</Text>
        <Text style={{ color: '#94A3B8', fontSize: 13, marginBottom: 24 }}>Last updated: {LAST_UPDATED}</Text>

        <Section title="Service Description">
          <P>SoGoJet is a travel discovery platform that helps you explore destinations through a swipe-based interface. We provide personalized recommendations, estimated flight and hotel prices, and links to third-party booking services.</P>
        </Section>

        <Section title="Acceptable Use">
          <P>You agree to use SoGoJet for personal, non-commercial purposes only. You will not attempt to scrape, reverse-engineer, or interfere with the operation of our service. You will not create automated accounts or use bots to interact with the platform.</P>
        </Section>

        <Section title="Affiliate Links & Pricing Disclaimer">
          <P>SoGoJet displays estimated flight and hotel prices sourced from third-party providers including Travelpayouts, Amadeus, and LiteAPI. These prices are estimates and may differ from actual prices at the time of booking.</P>
          <P>When you click through to book flights, hotels, or activities, you will be directed to third-party websites. SoGoJet may earn a commission from these referrals at no additional cost to you. We are not responsible for the booking process, pricing, or terms of these third-party services.</P>
          <P>All bookings are subject to the terms and conditions of the respective booking platform.</P>
        </Section>

        <Section title="Content Accuracy">
          <P>We strive to provide accurate destination information, including descriptions, ratings, weather data, and travel recommendations. However, we cannot guarantee the accuracy, completeness, or timeliness of all content. Destination details, safety conditions, and travel requirements can change without notice.</P>
          <P>Always verify travel requirements, visa regulations, and safety advisories with official sources before booking travel.</P>
        </Section>

        <Section title="User Accounts">
          <P>You are responsible for maintaining the security of your account credentials. You may use the app in Guest mode without creating an account, with limited functionality.</P>
          <P>We reserve the right to suspend or terminate accounts that violate these terms or engage in suspicious activity.</P>
        </Section>

        <Section title="Limitation of Liability">
          <P>SoGoJet is provided "as is" without warranties of any kind, express or implied. We are not liable for any direct, indirect, incidental, or consequential damages arising from your use of the service.</P>
          <P>We are not responsible for any losses incurred from travel bookings made through third-party links on our platform, including but not limited to price changes, booking errors, or service disruptions by third-party providers.</P>
        </Section>

        <Section title="Intellectual Property">
          <P>All content, design, and code within SoGoJet are the property of SoGoJet and its licensors. You may not copy, modify, or distribute our content without prior written permission.</P>
        </Section>

        <Section title="Changes to Terms">
          <P>We may update these Terms of Service from time to time. Continued use of the service after changes constitutes acceptance of the updated terms. We will indicate the date of the most recent update at the top of this page.</P>
        </Section>

        <Section title="Contact Us">
          <P>If you have questions about these Terms of Service, please contact us at legal@sogojet.com.</P>
        </Section>
      </ScrollView>
    </View>
  );
}
