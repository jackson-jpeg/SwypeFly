import { Platform } from 'react-native';
import type { Destination } from '../../types/destination';
import { colors } from '../../constants/theme';

// Approximate lat/lng → SVG coordinates for a simplified world map
const COUNTRY_COORDS: Record<string, [number, number]> = {
  'Indonesia': [680, 210], 'Greece': [500, 130], 'Japan': [730, 130],
  'Peru': [230, 220], 'Morocco': [440, 145], 'Iceland': [420, 70],
  'Italy': [485, 130], 'South Africa': [510, 270], 'Croatia': [490, 125],
  'Maldives': [600, 200], 'Spain': [450, 135], 'Canada': [220, 90],
  'Portugal': [435, 138], 'New Zealand': [780, 290], 'UAE': [560, 165],
  'Argentina': [250, 275], 'Thailand': [650, 180], 'Switzerland': [475, 120],
  'Cuba': [230, 165], 'Australia': [740, 260], 'Mexico': [195, 165],
  'France': [460, 125], 'Colombia': [230, 195], 'India': [610, 170],
  'Egypt': [520, 155], 'Brazil': [270, 230], 'USA': [190, 130],
  'United States': [190, 130], 'Vietnam': [660, 175], 'Turkey': [530, 135],
  'Kenya': [540, 210], 'Chile': [240, 265], 'Costa Rica': [215, 180],
  'Philippines': [700, 180], 'Tanzania': [540, 220], 'Cambodia': [660, 180],
  'Sri Lanka': [615, 190], 'Nepal': [620, 155], 'Fiji': [800, 240],
  'Norway': [470, 75], 'Ecuador': [225, 205], 'Sweden': [485, 75],
  'Scotland': [445, 95], 'United Kingdom': [445, 105], 'Ireland': [435, 100],
  'Germany': [480, 115], 'Netherlands': [470, 110], 'Czech Republic': [488, 115],
  'Austria': [488, 120], 'Hungary': [495, 120], 'Poland': [495, 110],
  'Romania': [505, 125], 'Bulgaria': [505, 130], 'Serbia': [500, 128],
  'Montenegro': [495, 130], 'Albania': [495, 135], 'Bosnia': [492, 128],
  'Slovenia': [488, 122], 'Slovakia': [495, 118], 'Latvia': [500, 95],
  'Lithuania': [500, 98], 'Estonia': [500, 90], 'Finland': [500, 80],
  'Denmark': [478, 100], 'Belgium': [468, 112], 'Luxembourg': [472, 115],
  'Malta': [488, 142], 'Cyprus': [525, 140], 'Georgia': [540, 130],
  'Jordan': [535, 155], 'Israel': [530, 155], 'Lebanon': [530, 145],
  'Oman': [565, 170], 'Qatar': [555, 165], 'Bahrain': [555, 162],
  'Kuwait': [548, 155], 'Saudi Arabia': [545, 165],
  'South Korea': [720, 135], 'Taiwan': [710, 165], 'Singapore': [660, 205],
  'Malaysia': [660, 200], 'Myanmar': [645, 170], 'Laos': [655, 170],
  'Mongolia': [670, 120], 'China': [670, 140],
  'Jamaica': [235, 170], 'Dominican Republic': [245, 168],
  'Puerto Rico': [250, 168], 'Bahamas': [235, 160],
  'Trinidad and Tobago': [260, 185], 'Barbados': [262, 180],
  'Belize': [210, 170], 'Guatemala': [205, 175], 'Honduras': [210, 175],
  'Panama': [225, 185], 'Nicaragua': [212, 178],
  'Rwanda': [530, 215], 'Uganda': [535, 210], 'Ethiopia': [545, 195],
  'Ghana': [455, 195], 'Nigeria': [470, 195], 'Senegal': [425, 180],
  'Madagascar': [555, 250], 'Botswana': [510, 255], 'Namibia': [490, 255],
  'Zambia': [520, 240], 'Zimbabwe': [520, 250], 'Mozambique': [535, 250],
};

function getCoords(country: string): [number, number] | null {
  return COUNTRY_COORDS[country] ?? null;
}

interface WorldMapHeaderProps {
  destinations: Destination[];
}

export function WorldMapHeader({ destinations }: WorldMapHeaderProps) {
  if (Platform.OS !== 'web') return null;

  const pins = destinations
    .map((d) => {
      const coords = getCoords(d.country);
      if (!coords) return null;
      return { id: d.id, city: d.city, x: coords[0], y: coords[1] };
    })
    .filter(Boolean) as { id: string; city: string; x: number; y: number }[];

  // Deduplicate by rounding
  const seen = new Set<string>();
  const uniquePins = pins.filter((p) => {
    const key = `${Math.round(p.x / 10)}-${Math.round(p.y / 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: 160,
      overflow: 'hidden',
      borderRadius: 20,
      margin: '0 auto 16px',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
    }}>
      <svg
        viewBox="0 0 900 340"
        style={{ width: '100%', height: '100%', opacity: 0.15 }}
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Simplified world map outline paths */}
        <path d="M150,80 Q180,70 220,85 Q260,75 280,90 Q300,80 320,95 L310,130 Q290,150 260,160 Q240,170 220,165 Q200,175 180,160 Q160,150 150,130 Z" fill="#38BDF8" opacity="0.4" />
        <path d="M230,165 Q240,175 250,200 Q260,220 270,240 Q265,260 255,275 Q245,285 240,270 Q235,255 230,240 Q225,220 228,200 Z" fill="#38BDF8" opacity="0.4" />
        <path d="M200,155 Q210,165 215,175 Q212,185 205,180 Q200,170 200,155 Z" fill="#38BDF8" opacity="0.3" />
        <path d="M430,80 Q460,70 500,75 Q530,70 550,90 Q540,100 520,110 Q510,120 490,130 Q470,140 450,145 Q440,140 435,130 Q430,120 435,110 Q430,100 430,80 Z" fill="#38BDF8" opacity="0.4" />
        <path d="M510,150 Q530,140 545,150 Q550,160 545,170 Q535,175 525,175 Q518,170 510,165 Z" fill="#38BDF8" opacity="0.3" />
        <path d="M440,150 Q460,145 480,150 Q500,155 510,165 Q520,175 515,185 Q505,195 490,200 Q475,195 460,185 Q450,175 445,165 Q440,160 440,150 Z" fill="#38BDF8" opacity="0.3" />
        <path d="M540,130 Q560,120 590,130 Q620,140 640,155 Q660,170 665,185 Q660,200 645,205 Q630,200 620,190 Q610,175 595,165 Q575,155 555,150 Q540,145 540,130 Z" fill="#38BDF8" opacity="0.4" />
        <path d="M670,120 Q690,110 720,120 Q740,130 735,150 Q725,160 710,165 Q700,160 695,150 Q685,140 675,135 Q670,130 670,120 Z" fill="#38BDF8" opacity="0.4" />
        <path d="M700,170 Q720,175 730,190 Q725,200 715,195 Q705,185 700,170 Z" fill="#38BDF8" opacity="0.3" />
        <path d="M710,230 Q740,225 770,240 Q780,255 770,270 Q755,280 740,275 Q725,265 715,250 Q710,240 710,230 Z" fill="#38BDF8" opacity="0.4" />
        <path d="M780,240 Q790,235 800,240 Q795,250 785,250 Z" fill="#38BDF8" opacity="0.3" />
        <path d="M440,175 Q470,170 500,180 Q520,190 530,210 Q535,230 525,250 Q510,265 490,270 Q475,265 465,250 Q455,230 450,210 Q445,195 440,175 Z" fill="#38BDF8" opacity="0.35" />
      </svg>
      {/* Animated pins */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <svg viewBox="0 0 900 340" style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid slice">
          {uniquePins.map((pin, i) => (
            <g key={pin.id}>
              <circle cx={pin.x} cy={pin.y} r="8" fill={colors.primary} opacity="0.2">
                <animate attributeName="r" values="6;14;6" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0.05;0.3" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
              </circle>
              <circle className="sg-map-pin" cx={pin.x} cy={pin.y} r="4" fill={colors.primary} />
            </g>
          ))}
        </svg>
      </div>
      {/* Overlay text */}
      <div style={{
        position: 'absolute', bottom: 12, left: 16,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 22 }}>🌍</span>
        <span style={{
          color: 'rgba(255,255,255,0.5)', fontSize: 12,
          fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
        }}>
          Your World · {uniquePins.length} pin{uniquePins.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
