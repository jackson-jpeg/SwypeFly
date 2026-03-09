import { colors, typography, fonts } from '@/tokens';

export default function SearchScreen() {
  return (
    <div
      className="screen"
      style={{ background: colors.duskSand, minHeight: '100dvh', padding: 16 }}
    >
      <h1 style={{ ...typography.pageTitle, fontFamily: `"${fonts.display}", system-ui, sans-serif`, color: colors.deepDusk }}>
        Search Deals
      </h1>
    </div>
  );
}
