import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { colors, fonts } from '@/tokens';
import type { ReactNode } from 'react';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '');

interface StripeProviderProps {
  clientSecret: string;
  children: ReactNode;
}

export default function StripeProvider({ clientSecret, children }: StripeProviderProps) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'flat',
          variables: {
            colorPrimary: colors.deepDusk,
            colorBackground: colors.offWhite,
            colorText: colors.deepDusk,
            colorDanger: colors.terracotta,
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            borderRadius: '10px',
            spacingUnit: '4px',
          },
          rules: {
            '.Input': {
              border: '1px solid #C9A99A60',
              boxShadow: 'none',
            },
            '.Input:focus': {
              border: `1px solid ${colors.sageDrift}`,
              boxShadow: 'none',
            },
          },
        },
      }}
    >
      {children}
    </Elements>
  );
}
