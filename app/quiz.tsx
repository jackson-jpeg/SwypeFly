import { useState } from 'react';
import { Platform, View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { destinations } from '../data/destinations';
import { useFeedStore } from '../stores/feedStore';
import { colors } from '../constants/theme';
import type { VibeTag } from '../types/destination';

const QUESTIONS = [
  {
    question: "What's your ideal vacation vibe?",
    options: [
      { label: '🏖️ Beach & chill', vibes: ['beach', 'tropical'] },
      { label: '🏔️ Adventure & nature', vibes: ['mountain', 'adventure', 'nature'] },
      { label: '🏛️ Culture & history', vibes: ['culture', 'historic'] },
      { label: '🍜 Food & nightlife', vibes: ['foodie', 'nightlife'] },
    ],
  },
  {
    question: "What's your budget?",
    options: [
      { label: '💰 Budget-friendly (under $300)', maxPrice: 300 },
      { label: '💳 Mid-range ($300-600)', maxPrice: 600 },
      { label: '💎 Splurge ($600+)', maxPrice: 99999 },
    ],
  },
  {
    question: 'Who are you traveling with?',
    options: [
      { label: '💕 Partner', vibes: ['romantic'] },
      { label: '🎒 Solo', vibes: ['adventure', 'budget'] },
      { label: '👨‍👩‍👧 Family', vibes: ['beach', 'nature'] },
      { label: '🎉 Friends', vibes: ['nightlife', 'city'] },
    ],
  },
  {
    question: 'Warm or cold?',
    options: [
      { label: '☀️ Warm & sunny', vibes: ['tropical', 'beach'] },
      { label: '❄️ Cold & cozy', vibes: ['winter', 'mountain'] },
      { label: '🌤️ Mild & pleasant', vibes: ['city', 'culture'] },
    ],
  },
];

export default function QuizPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<any[]>([]);
  const [results, setResults] = useState<typeof destinations | null>(null);

  const handleAnswer = (option: any) => {
    const newAnswers = [...answers, option];
    setAnswers(newAnswers);

    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      // Calculate results
      const vibeScores = new Map<string, number>();
      let maxPrice = 99999;

      for (const ans of newAnswers) {
        if (ans.vibes) {
          for (const v of ans.vibes) {
            vibeScores.set(v, (vibeScores.get(v) || 0) + 1);
          }
        }
        if (ans.maxPrice && ans.maxPrice < maxPrice) {
          maxPrice = ans.maxPrice;
        }
      }

      const scored = destinations
        .filter(d => (d.livePrice ?? d.flightPrice) <= maxPrice)
        .map(d => {
          let score = 0;
          for (const tag of d.vibeTags) {
            score += vibeScores.get(tag) || 0;
          }
          return { dest: d, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(s => s.dest);

      setResults(scored);

      // Apply quiz preferences to feed filters
      const topVibe = [...vibeScores.entries()].sort((a, b) => b[1] - a[1])[0];
      if (topVibe) {
        useFeedStore.getState().setVibeFilter(topVibe[0]);
      }
      if (maxPrice <= 300) {
        useFeedStore.getState().setSortPreset('cheapest');
      }
    }
  };

  if (Platform.OS !== 'web') return null;

  // Results
  if (results) {
    return (
      <div style={{
        minHeight: '100vh', backgroundColor: '#0F172A', padding: '60px 20px 40px',
      }}>
        <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: '0 0 8px 0' }}>
            Your Perfect Destinations
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: '0 0 32px 0' }}>
            Based on your preferences, here are our top picks:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {results.map(dest => (
              <button
                key={dest.id}
                onClick={() => router.push(`/destination/${dest.id}`)}
                style={{
                  borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
                  position: 'relative', aspectRatio: '3/2',
                  border: 'none', padding: 0, textAlign: 'left',
                }}
              >
                <img src={dest.imageUrl} alt={`${dest.city}, ${dest.country}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.8))' }} />
                <div style={{ position: 'absolute', bottom: 10, left: 12 }}>
                  <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{dest.city}</div>
                  <div style={{ color: colors.primary, fontSize: 13, fontWeight: 700 }}>${dest.livePrice ?? dest.flightPrice}</div>
                </div>
              </button>
            ))}
          </div>

          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '16px 0 0', fontStyle: 'italic' }}>
            Your feed has been personalized based on your answers
          </p>

          <div style={{ display: 'flex', gap: 12, marginTop: 16, justifyContent: 'center' }}>
            <button
              onClick={() => { setStep(0); setAnswers([]); setResults(null); }}
              style={{
                padding: '12px 24px', borderRadius: 9999,
                backgroundColor: 'transparent', border: '1.5px solid rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >Retake Quiz</button>
            <button
              onClick={() => router.replace('/')}
              style={{
                padding: '12px 24px', borderRadius: 9999,
                backgroundColor: colors.primary, border: 'none',
                color: '#0F172A', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >View Your Feed</button>
          </div>
        </div>
      </div>
    );
  }

  const q = QUESTIONS[step];

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#0F172A',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      {/* Close */}
      <button
        onClick={() => router.back()}
        style={{
          position: 'fixed', top: 16, left: 16, zIndex: 50,
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.1)', border: 'none',
          color: 'rgba(255,255,255,0.6)', fontSize: 20, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >✕</button>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 40 }}>
        {QUESTIONS.map((_, i) => (
          <div key={i} style={{
            width: i <= step ? 32 : 12, height: 4, borderRadius: 2,
            backgroundColor: i <= step ? colors.primary : 'rgba(255,255,255,0.15)',
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>

      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: '0 0 32px 0' }}>
          {q.question}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(opt)}
              style={{
                padding: '18px 20px', borderRadius: 16,
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1.5px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: 16, fontWeight: 600,
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(56,189,248,0.1)';
                e.currentTarget.style.borderColor = 'rgba(56,189,248,0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              }}
            >{opt.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
