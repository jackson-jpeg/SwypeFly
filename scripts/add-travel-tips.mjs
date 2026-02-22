import fs from 'fs';

// Travel tips data keyed by destination id
const tips = {
  // === destinations.ts (1-50) ===
  '1': { visa: 'Visa on arrival for US citizens (30 days)', currency: 'Indonesian Rupiah (IDR) — ~15,500 per $1', language: 'Indonesian, English in tourist areas', safety: 'Generally safe for tourists', bestFor: ['couples', 'solo', 'budget travelers'], costLevel: 1 },
  '2': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Greek, English widely spoken', safety: 'Very safe for tourists', bestFor: ['couples', 'honeymooners'], costLevel: 4 },
  '3': { visa: 'No visa needed for US citizens (90 days)', currency: 'Japanese Yen (¥) — ~¥150 per $1', language: 'Japanese, limited English', safety: 'Extremely safe', bestFor: ['solo', 'couples', 'foodies'], costLevel: 3 },
  '4': { visa: 'No visa needed for US citizens (183 days)', currency: 'Peruvian Sol (S/) — ~3.7 per $1', language: 'Spanish, Quechua', safety: 'Safe with normal precautions', bestFor: ['adventurers', 'solo', 'couples'], costLevel: 2 },
  '5': { visa: 'No visa needed for US citizens (90 days)', currency: 'Moroccan Dirham (MAD) — ~10 per $1', language: 'Arabic, French, Berber', safety: 'Generally safe, be street-smart', bestFor: ['couples', 'solo', 'culture lovers'], costLevel: 1 },
  '6': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Icelandic Króna (ISK) — ~138 per $1', language: 'Icelandic, English widely spoken', safety: 'Extremely safe', bestFor: ['couples', 'adventurers', 'solo'], costLevel: 4 },
  '7': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Italian, some English', safety: 'Very safe for tourists', bestFor: ['couples', 'honeymooners', 'foodies'], costLevel: 4 },
  '8': { visa: 'No visa needed for US citizens (90 days)', currency: 'South African Rand (ZAR) — ~18 per $1', language: 'English, Afrikaans, Xhosa', safety: 'Safe in tourist areas, stay aware', bestFor: ['adventurers', 'couples', 'families'], costLevel: 2 },
  '9': { visa: 'No visa needed for US citizens (90 days)', currency: 'Japanese Yen (¥) — ~¥150 per $1', language: 'Japanese, limited English', safety: 'Extremely safe', bestFor: ['solo', 'couples', 'culture lovers'], costLevel: 3 },
  '10': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Croatian, English widely spoken', safety: 'Very safe', bestFor: ['couples', 'families', 'history buffs'], costLevel: 2 },
  '11': { visa: 'No visa needed for US citizens (30 days)', currency: 'Maldivian Rufiyaa (MVR) — USD widely accepted', language: 'Dhivehi, English widely spoken', safety: 'Very safe', bestFor: ['couples', 'honeymooners', 'luxury travelers'], costLevel: 4 },
  '12': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Spanish, Catalan, English common', safety: 'Safe, watch for pickpockets', bestFor: ['couples', 'solo', 'foodies', 'families'], costLevel: 3 },
  '13': { visa: 'No visa needed for US citizens (180 days)', currency: 'Canadian Dollar (CAD) — ~1.36 per $1', language: 'English, French', safety: 'Very safe', bestFor: ['adventurers', 'families', 'couples'], costLevel: 3 },
  '14': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Portuguese, English widely spoken', safety: 'Very safe', bestFor: ['solo', 'couples', 'budget travelers'], costLevel: 2 },
  '15': { visa: 'No visa needed for US citizens (90 days)', currency: 'New Zealand Dollar (NZD) — ~1.65 per $1', language: 'English, Māori', safety: 'Very safe', bestFor: ['adventurers', 'couples', 'solo'], costLevel: 3 },
  '16': { visa: 'No visa needed for US citizens (30 days on arrival)', currency: 'UAE Dirham (AED) — ~3.67 per $1', language: 'Arabic, English widely spoken', safety: 'Extremely safe', bestFor: ['luxury travelers', 'families', 'couples'], costLevel: 4 },
  '17': { visa: 'No visa needed for US citizens (90 days)', currency: 'Argentine Peso (ARS) — blue rate varies', language: 'Spanish', safety: 'Safe in tourist areas', bestFor: ['adventurers', 'solo', 'nature lovers'], costLevel: 2 },
  '18': { visa: 'No visa needed for US citizens (30 days, extendable)', currency: 'Thai Baht (฿) — ~35 per $1', language: 'Thai, English in tourist areas', safety: 'Very safe for tourists', bestFor: ['solo', 'budget travelers', 'digital nomads'], costLevel: 1 },
  '19': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Swiss Franc (CHF) — ~0.88 per $1', language: 'German, French, Italian', safety: 'Extremely safe', bestFor: ['couples', 'families', 'adventurers'], costLevel: 4 },
  '20': { visa: 'Visa required — tourist card available', currency: 'Cuban Peso (CUP) — ~24 per $1', language: 'Spanish', safety: 'Generally safe', bestFor: ['solo', 'culture lovers', 'adventurers'], costLevel: 1 },
  '21': { visa: 'No visa needed for US citizens (180 days)', currency: 'Mexican Peso (MXN) — ~17 per $1', language: 'Spanish, English in resorts', safety: 'Safe in resort areas', bestFor: ['families', 'couples', 'spring breakers'], costLevel: 2 },
  '22': { visa: 'No visa needed for US citizens (30 days, tourist card)', currency: 'Dominican Peso (DOP) — USD widely accepted', language: 'Spanish, English in resorts', safety: 'Safe in resort areas', bestFor: ['families', 'couples', 'budget travelers'], costLevel: 2 },
  '23': { visa: 'No visa needed for US citizens (90 days)', currency: 'Jamaican Dollar (JMD) — USD widely accepted', language: 'English, Jamaican Patois', safety: 'Safe in resort areas, be cautious elsewhere', bestFor: ['couples', 'families', 'spring breakers'], costLevel: 2 },
  '24': { visa: 'No visa needed (US territory)', currency: 'US Dollar ($)', language: 'Spanish, English', safety: 'Generally safe in tourist areas', bestFor: ['couples', 'families', 'culture lovers'], costLevel: 2 },
  '25': { visa: 'No visa needed for US citizens (30 days)', currency: 'Aruban Florin (AWG) — USD widely accepted', language: 'Dutch, Papiamento, English, Spanish', safety: 'Very safe', bestFor: ['couples', 'families', 'beach lovers'], costLevel: 3 },
  '26': { visa: 'No visa needed for US citizens (90 days)', currency: 'Bahamian Dollar (BSD) — pegged to USD', language: 'English', safety: 'Safe in resort areas', bestFor: ['families', 'couples', 'spring breakers'], costLevel: 3 },
  '27': { visa: 'No visa needed for US citizens (180 days)', currency: 'Mexican Peso (MXN) — USD widely accepted', language: 'Spanish, English in tourist areas', safety: 'Safe in tourist areas', bestFor: ['couples', 'divers', 'families'], costLevel: 2 },
  '28': { visa: 'No visa needed for US citizens (6 weeks)', currency: 'East Caribbean Dollar (XCD) — USD accepted', language: 'English, French Creole', safety: 'Very safe', bestFor: ['couples', 'honeymooners', 'adventurers'], costLevel: 3 },
  '29': { visa: 'No visa needed for US citizens (90 days)', currency: 'Costa Rican Colón (CRC) — ~520 per $1', language: 'Spanish, English in tourist areas', safety: 'Very safe', bestFor: ['adventurers', 'families', 'eco-travelers'], costLevel: 2 },
  '30': { visa: 'No visa needed for US citizens (90 days)', currency: 'Colombian Peso (COP) — ~4,000 per $1', language: 'Spanish, limited English', safety: 'Safe in tourist areas, stay aware', bestFor: ['solo', 'culture lovers', 'budget travelers'], costLevel: 1 },
  '31': { visa: 'No visa needed for US citizens (90 days)', currency: 'Colombian Peso (COP) — ~4,000 per $1', language: 'Spanish, some English', safety: 'Much improved, safe in tourist areas', bestFor: ['digital nomads', 'solo', 'couples'], costLevel: 1 },
  '32': { visa: 'No visa needed for US citizens (183 days)', currency: 'Peruvian Sol (S/) — ~3.7 per $1', language: 'Spanish, Quechua', safety: 'Safe with normal precautions', bestFor: ['foodies', 'solo', 'culture lovers'], costLevel: 2 },
  '33': { visa: 'No visa needed for US citizens (90 days)', currency: 'Colombian Peso (COP) — ~4,000 per $1', language: 'Spanish, some English', safety: 'Safe in tourist areas', bestFor: ['couples', 'history buffs', 'foodies'], costLevel: 2 },
  '34': { visa: 'No visa needed for US citizens (180 days)', currency: 'US Dollar ($) — official currency', language: 'Spanish, English widely spoken', safety: 'Safe in tourist areas', bestFor: ['families', 'couples', 'business travelers'], costLevel: 2 },
  '35': { visa: 'No visa needed for US citizens (6 months)', currency: 'British Pound (£) — ~$1.27 USD', language: 'English', safety: 'Very safe', bestFor: ['solo', 'couples', 'families', 'culture lovers'], costLevel: 4 },
  '36': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'French, English in tourist areas', safety: 'Safe, watch for pickpockets', bestFor: ['couples', 'solo', 'foodies', 'culture lovers'], costLevel: 4 },
  '37': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Dutch, English very widely spoken', safety: 'Very safe', bestFor: ['solo', 'couples', 'culture lovers'], costLevel: 3 },
  '38': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Italian, some English', safety: 'Safe, watch for pickpockets', bestFor: ['couples', 'families', 'foodies', 'history buffs'], costLevel: 3 },
  '39': { visa: 'No visa needed for US citizens (90 days)', currency: 'Euro (€) — ~$1.08 USD', language: 'English, Irish', safety: 'Very safe', bestFor: ['solo', 'couples', 'families'], costLevel: 3 },
  '40': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Czech Koruna (CZK) — ~23 per $1', language: 'Czech, English widely spoken in tourism', safety: 'Very safe', bestFor: ['couples', 'budget travelers', 'culture lovers'], costLevel: 2 },
  '41': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Danish Krone (DKK) — ~6.9 per $1', language: 'Danish, English very widely spoken', safety: 'Extremely safe', bestFor: ['couples', 'foodies', 'design lovers'], costLevel: 4 },
  '42': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'German, English widely spoken', safety: 'Very safe', bestFor: ['solo', 'couples', 'culture lovers', 'nightlife'], costLevel: 2 },
  '43': { visa: 'No visa needed for US citizens (30 days, extendable)', currency: 'Thai Baht (฿) — ~35 per $1', language: 'Thai, English in tourist areas', safety: 'Very safe for tourists', bestFor: ['solo', 'budget travelers', 'foodies', 'families'], costLevel: 1 },
  '44': { visa: 'No visa needed for US citizens (90 days)', currency: 'Singapore Dollar (SGD) — ~1.35 per $1', language: 'English, Mandarin, Malay, Tamil', safety: 'Extremely safe', bestFor: ['families', 'foodies', 'couples'], costLevel: 3 },
  '45': { visa: 'No visa needed for US citizens (90 days, K-ETA)', currency: 'South Korean Won (₩) — ~1,330 per $1', language: 'Korean, English in Seoul', safety: 'Very safe', bestFor: ['solo', 'couples', 'foodies', 'culture lovers'], costLevel: 2 },
  '46': { visa: 'No visa needed for US citizens (45 days)', currency: 'Vietnamese Dong (₫) — ~24,500 per $1', language: 'Vietnamese, limited English', safety: 'Very safe for tourists', bestFor: ['solo', 'budget travelers', 'foodies'], costLevel: 1 },
  '47': { visa: 'No visa needed (US state)', currency: 'US Dollar ($)', language: 'English, Hawaiian', safety: 'Very safe', bestFor: ['families', 'couples', 'honeymooners'], costLevel: 3 },
  '48': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Safe in tourist areas', bestFor: ['couples', 'solo', 'foodies', 'culture lovers'], costLevel: 2 },
  '49': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Safe', bestFor: ['couples', 'solo', 'music lovers'], costLevel: 2 },
  '50': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Safe, standard city precautions', bestFor: ['solo', 'couples', 'families', 'foodies'], costLevel: 4 },

  // === destinations-new.ts (51-100) ===
  '51': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Safe', bestFor: ['solo', 'couples', 'foodies', 'music lovers'], costLevel: 2 },
  '52': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Safe', bestFor: ['adventurers', 'solo', 'couples'], costLevel: 2 },
  '53': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['couples', 'foodies', 'history buffs'], costLevel: 2 },
  '54': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Safe, standard city precautions', bestFor: ['solo', 'couples', 'foodies'], costLevel: 4 },
  '55': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Safe on the Strip', bestFor: ['couples', 'groups', 'nightlife lovers'], costLevel: 3 },
  '56': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Safe', bestFor: ['solo', 'couples', 'foodies'], costLevel: 3 },
  '57': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English, Spanish', safety: 'Safe in tourist areas', bestFor: ['couples', 'nightlife lovers', 'beach lovers'], costLevel: 3 },
  '58': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['couples', 'luxury travelers', 'golfers'], costLevel: 3 },
  '59': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['couples', 'history buffs', 'foodies'], costLevel: 2 },
  '60': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Safe', bestFor: ['families', 'couples', 'beach lovers'], costLevel: 2 },
  '61': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Safe', bestFor: ['solo', 'foodies', 'couples'], costLevel: 2 },
  '62': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Safe in tourist areas', bestFor: ['families', 'culture lovers', 'foodies'], costLevel: 2 },
  '63': { visa: 'No visa needed for US citizens (6 months)', currency: 'Barbadian Dollar (BBD) — pegged 2:1 to USD', language: 'English', safety: 'Very safe', bestFor: ['couples', 'families', 'beach lovers'], costLevel: 3 },
  '64': { visa: 'No visa needed for US citizens (30 days)', currency: 'Cayman Islands Dollar (KYD) — USD widely accepted', language: 'English', safety: 'Very safe', bestFor: ['couples', 'divers', 'luxury travelers'], costLevel: 4 },
  '65': { visa: 'No visa needed for US citizens (90 days)', currency: 'Trinidad & Tobago Dollar (TTD) — ~6.8 per $1', language: 'English', safety: 'Safe in tourist areas', bestFor: ['culture lovers', 'foodies', 'carnival goers'], costLevel: 2 },
  '66': { visa: 'No visa needed for US citizens (90 days)', currency: 'Netherlands Antillean Guilder (ANG) — USD accepted', language: 'Dutch, Papiamentu, English', safety: 'Very safe', bestFor: ['couples', 'divers', 'beach lovers'], costLevel: 2 },
  '67': { visa: 'No visa needed for US citizens (90 days)', currency: 'Netherlands Antillean Guilder (ANG) — USD accepted', language: 'Dutch, English, French', safety: 'Safe', bestFor: ['couples', 'beach lovers', 'families'], costLevel: 3 },
  '68': { visa: 'Visa on arrival for US citizens (30 days)', currency: 'Cambodian Riel (KHR) — USD widely used', language: 'Khmer, English in tourist areas', safety: 'Generally safe', bestFor: ['solo', 'budget travelers', 'history buffs'], costLevel: 1 },
  '69': { visa: 'Visa on arrival for US citizens (30 days)', currency: 'Lao Kip (LAK) — ~20,000 per $1', language: 'Lao, limited English', safety: 'Very safe', bestFor: ['solo', 'budget travelers', 'culture lovers'], costLevel: 1 },
  '70': { visa: 'Visa on arrival for US citizens (28 days)', currency: 'Myanmar Kyat (MMK) — ~2,100 per $1', language: 'Burmese, limited English', safety: 'Check current travel advisories', bestFor: ['adventurers', 'culture lovers'], costLevel: 1 },
  '71': { visa: 'No visa needed for US citizens (30 days)', currency: 'Philippine Peso (₱) — ~56 per $1', language: 'Filipino, English widely spoken', safety: 'Generally safe in tourist areas', bestFor: ['solo', 'budget travelers', 'divers'], costLevel: 1 },
  '72': { visa: 'No visa needed for US citizens (45 days)', currency: 'Vietnamese Dong (₫) — ~24,500 per $1', language: 'Vietnamese, some English', safety: 'Very safe', bestFor: ['solo', 'budget travelers', 'beach lovers'], costLevel: 1 },
  '73': { visa: 'No visa needed for US citizens (90 days)', currency: 'Malaysian Ringgit (MYR) — ~4.7 per $1', language: 'Malay, English widely spoken', safety: 'Very safe', bestFor: ['families', 'foodies', 'budget travelers'], costLevel: 1 },
  '74': { visa: 'No visa needed for US citizens (90 days)', currency: 'Brazilian Real (BRL) — ~5 per $1', language: 'Portuguese', safety: 'Safe in tourist areas, stay aware', bestFor: ['couples', 'culture lovers', 'nightlife lovers'], costLevel: 2 },
  '75': { visa: 'No visa needed for US citizens (90 days)', currency: 'Chilean Peso (CLP) — ~900 per $1', language: 'Spanish, limited English', safety: 'Very safe', bestFor: ['solo', 'foodies', 'couples'], costLevel: 2 },
  '76': { visa: 'No visa needed for US citizens (90 days)', currency: 'US Dollar ($) — official currency', language: 'Spanish, Quechua', safety: 'Safe with normal precautions', bestFor: ['adventurers', 'culture lovers', 'budget travelers'], costLevel: 1 },
  '77': { visa: 'No visa needed for US citizens (90 days)', currency: 'Uruguayan Peso (UYU) — ~40 per $1', language: 'Spanish', safety: 'Very safe', bestFor: ['couples', 'foodies', 'culture lovers'], costLevel: 2 },
  '78': { visa: 'eVisa required for US citizens', currency: 'Kenyan Shilling (KES) — ~155 per $1', language: 'Swahili, English', safety: 'Safe on guided safaris', bestFor: ['adventurers', 'couples', 'families'], costLevel: 2 },
  '79': { visa: 'Visa on arrival for US citizens', currency: 'Tanzanian Shilling (TZS) — ~2,500 per $1', language: 'Swahili, English', safety: 'Safe in tourist areas', bestFor: ['couples', 'beach lovers', 'honeymooners'], costLevel: 2 },
  '80': { visa: 'No visa needed for US citizens (90 days)', currency: 'Moroccan Dirham (MAD) — ~10 per $1', language: 'Arabic, French, Berber', safety: 'Generally safe', bestFor: ['couples', 'solo', 'culture lovers'], costLevel: 1 },
  '81': { visa: 'Visa on arrival for US citizens (30 days)', currency: 'Ghanaian Cedi (GHS) — ~14 per $1', language: 'English', safety: 'Safe, friendly locals', bestFor: ['solo', 'culture lovers', 'adventurers'], costLevel: 1 },
  '82': { visa: 'No visa needed for US citizens (30 days)', currency: 'Qatari Riyal (QAR) — ~3.64 per $1', language: 'Arabic, English widely spoken', safety: 'Extremely safe', bestFor: ['luxury travelers', 'families', 'couples'], costLevel: 4 },
  '83': { visa: 'No visa needed for US citizens (60 days)', currency: 'Jordanian Dinar (JOD) — ~0.71 per $1', language: 'Arabic, English widely spoken', safety: 'Very safe for tourists', bestFor: ['couples', 'history buffs', 'adventurers'], costLevel: 2 },
  '84': { visa: 'No visa needed for US citizens (90 days)', currency: 'Israeli New Shekel (₪) — ~3.7 per $1', language: 'Hebrew, Arabic, English widely spoken', safety: 'Check current travel advisories', bestFor: ['solo', 'foodies', 'culture lovers', 'nightlife'], costLevel: 3 },
  '85': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'German, English widely spoken', safety: 'Very safe', bestFor: ['couples', 'culture lovers', 'foodies'], costLevel: 3 },
  '86': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Greek, English widely spoken', safety: 'Safe, watch for pickpockets', bestFor: ['solo', 'couples', 'history buffs'], costLevel: 2 },
  '87': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Hungarian Forint (HUF) — ~360 per $1', language: 'Hungarian, English in tourist areas', safety: 'Very safe', bestFor: ['couples', 'budget travelers', 'nightlife lovers'], costLevel: 1 },
  '88': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Polish Zloty (PLN) — ~4 per $1', language: 'Polish, English in cities', safety: 'Very safe', bestFor: ['solo', 'budget travelers', 'history buffs'], costLevel: 1 },
  '89': { visa: 'No visa needed for US citizens (6 months)', currency: 'British Pound (£) — ~$1.27 USD', language: 'English', safety: 'Very safe', bestFor: ['solo', 'couples', 'history buffs'], costLevel: 3 },
  '90': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Italian, some English', safety: 'Very safe', bestFor: ['couples', 'honeymooners', 'culture lovers'], costLevel: 4 },
  '91': { visa: 'eVisa or visa on arrival for US citizens', currency: 'Turkish Lira (TRY) — ~30 per $1', language: 'Turkish, English in tourist areas', safety: 'Generally safe in tourist areas', bestFor: ['couples', 'solo', 'history buffs', 'foodies'], costLevel: 2 },
  '92': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Italian, English in business areas', safety: 'Safe, watch for pickpockets', bestFor: ['couples', 'foodies', 'fashion lovers'], costLevel: 4 },
  '93': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Portuguese, English widely spoken', safety: 'Very safe', bestFor: ['couples', 'solo', 'foodies'], costLevel: 2 },
  '94': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Spanish, some English', safety: 'Very safe', bestFor: ['couples', 'solo', 'culture lovers'], costLevel: 2 },
  '95': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Italian, some English', safety: 'Very safe', bestFor: ['couples', 'foodies', 'art lovers'], costLevel: 3 },
  '96': { visa: 'ETA required for US citizens (online)', currency: 'Australian Dollar (AUD) — ~1.55 per $1', language: 'English', safety: 'Very safe', bestFor: ['families', 'solo', 'couples', 'adventurers'], costLevel: 3 },
  '97': { visa: 'ETA required for US citizens (online)', currency: 'Australian Dollar (AUD) — ~1.55 per $1', language: 'English', safety: 'Very safe', bestFor: ['solo', 'foodies', 'culture lovers'], costLevel: 3 },
  '98': { visa: 'No visa needed for US citizens (90 days)', currency: 'Hong Kong Dollar (HKD) — ~7.8 per $1', language: 'Cantonese, English widely spoken', safety: 'Very safe', bestFor: ['solo', 'foodies', 'couples', 'families'], costLevel: 3 },
  '99': { visa: 'No visa needed for US citizens (90 days)', currency: 'New Taiwan Dollar (TWD) — ~32 per $1', language: 'Mandarin, some English', safety: 'Very safe', bestFor: ['solo', 'foodies', 'culture lovers'], costLevel: 2 },
  '100': { visa: 'eVisa required for US citizens', currency: 'Indian Rupee (₹) — ~83 per $1', language: 'Hindi, English widely spoken', safety: 'Safe with normal precautions', bestFor: ['solo', 'culture lovers', 'adventurers'], costLevel: 1 },

  // === destinations-extra.ts (101-146) ===
  '101': { visa: 'No visa needed (US state)', currency: 'US Dollar ($)', language: 'English, Hawaiian', safety: 'Very safe', bestFor: ['couples', 'honeymooners', 'families'], costLevel: 4 },
  '102': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Safe', bestFor: ['couples', 'solo', 'nightlife lovers'], costLevel: 3 },
  '103': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English, Spanish', safety: 'Very safe', bestFor: ['couples', 'art lovers', 'culture lovers'], costLevel: 2 },
  '104': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['couples', 'luxury travelers', 'adventurers'], costLevel: 4 },
  '105': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['families', 'couples', 'adventurers'], costLevel: 3 },
  '106': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['couples', 'foodies', 'nature lovers'], costLevel: 2 },
  '107': { visa: 'No visa needed (US state)', currency: 'US Dollar ($)', language: 'English', safety: 'Safe, wildlife awareness needed', bestFor: ['adventurers', 'families', 'nature lovers'], costLevel: 3 },
  '108': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['couples', 'families', 'luxury travelers'], costLevel: 4 },
  '109': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['adventurers', 'couples', 'luxury travelers'], costLevel: 4 },
  '110': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Safe', bestFor: ['adventurers', 'solo', 'nature lovers'], costLevel: 2 },
  '111': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['families', 'adventurers', 'couples'], costLevel: 2 },
  '112': { visa: 'No visa needed for US citizens (90 days)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['couples', 'honeymooners', 'beach lovers'], costLevel: 4 },
  '113': { visa: 'No visa needed (US territory)', currency: 'US Dollar ($)', language: 'English', safety: 'Safe in tourist areas', bestFor: ['couples', 'families', 'beach lovers'], costLevel: 3 },
  '114': { visa: 'No visa needed for US citizens (6 months)', currency: 'East Caribbean Dollar (XCD) — USD accepted', language: 'English', safety: 'Very safe', bestFor: ['couples', 'families', 'beach lovers'], costLevel: 3 },
  '115': { visa: 'No visa needed for US citizens (6 months)', currency: 'East Caribbean Dollar (XCD) — USD accepted', language: 'English, French Creole', safety: 'Very safe', bestFor: ['couples', 'adventurers', 'divers'], costLevel: 2 },
  '116': { visa: 'No visa needed for US citizens (90 days)', currency: 'East Caribbean Dollar (XCD) — USD accepted', language: 'English', safety: 'Very safe', bestFor: ['couples', 'beach lovers', 'history buffs'], costLevel: 3 },
  '117': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'US Dollar ($)', language: 'Dutch, Papiamentu, English', safety: 'Very safe', bestFor: ['divers', 'couples', 'nature lovers'], costLevel: 2 },
  '118': { visa: 'No visa needed for US citizens (90 days)', currency: 'Bermudian Dollar (BMD) — pegged to USD', language: 'English', safety: 'Very safe', bestFor: ['couples', 'families', 'golfers'], costLevel: 4 },
  '119': { visa: 'No visa needed for US citizens (30 days)', currency: 'Belize Dollar (BZD) — pegged 2:1 to USD', language: 'English, Spanish, Kriol', safety: 'Safe in tourist areas', bestFor: ['adventurers', 'divers', 'couples'], costLevel: 2 },
  '120': { visa: 'No visa needed for US citizens (90 days)', currency: 'Honduran Lempira (HNL) — USD accepted on island', language: 'Spanish, English on Roatán', safety: 'Safe on the island', bestFor: ['divers', 'budget travelers', 'couples'], costLevel: 1 },
  '121': { visa: 'No visa needed for US citizens (90 days)', currency: 'Guatemalan Quetzal (GTQ) — ~7.8 per $1', language: 'Spanish, Mayan languages', safety: 'Safe with guided tours', bestFor: ['adventurers', 'culture lovers', 'budget travelers'], costLevel: 1 },
  '122': { visa: 'No visa needed for US citizens (90 days)', currency: 'Nicaraguan Córdoba (NIO) — ~37 per $1', language: 'Spanish', safety: 'Check travel advisories', bestFor: ['adventurers', 'budget travelers'], costLevel: 1 },
  '123': { visa: 'No visa needed for US citizens (90 days)', currency: 'US Dollar ($) — official currency', language: 'Spanish', safety: 'Safe in tourist areas', bestFor: ['adventurers', 'surfers', 'budget travelers'], costLevel: 1 },
  '124': { visa: 'No visa needed for US citizens (90 days)', currency: 'Honduran Lempira (HNL) — ~25 per $1', language: 'Spanish', safety: 'Exercise caution', bestFor: ['adventurers', 'culture lovers'], costLevel: 1 },
  '125': { visa: 'No visa needed for US citizens (90 days)', currency: 'Boliviano (BOB) — ~6.9 per $1', language: 'Spanish, Quechua, Aymara', safety: 'Generally safe', bestFor: ['adventurers', 'budget travelers', 'culture lovers'], costLevel: 1 },
  '126': { visa: 'No visa needed for US citizens (90 days)', currency: 'Brazilian Real (BRL) — ~5 per $1', language: 'Portuguese', safety: 'Safe in upscale areas, stay aware', bestFor: ['foodies', 'culture lovers', 'business travelers'], costLevel: 2 },
  '127': { visa: 'No visa needed for US citizens (90 days)', currency: 'US Dollar ($) — official currency', language: 'Spanish, English', safety: 'Very safe', bestFor: ['adventurers', 'nature lovers', 'couples'], costLevel: 4 },
  '128': { visa: 'No visa needed for US citizens (90 days)', currency: 'Argentine Peso (ARS) — blue rate varies', language: 'Spanish', safety: 'Safe', bestFor: ['adventurers', 'nature lovers', 'couples'], costLevel: 2 },
  '129': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Maltese, English', safety: 'Very safe', bestFor: ['couples', 'history buffs', 'divers'], costLevel: 2 },
  '130': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'French, Dutch, German', safety: 'Very safe', bestFor: ['foodies', 'couples', 'culture lovers'], costLevel: 3 },
  '131': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Norwegian Krone (NOK) — ~10.5 per $1', language: 'Norwegian, English widely spoken', safety: 'Extremely safe', bestFor: ['adventurers', 'couples', 'nature lovers'], costLevel: 4 },
  '132': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Croatian, English widely spoken', safety: 'Very safe', bestFor: ['couples', 'beach lovers', 'history buffs'], costLevel: 2 },
  '133': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Estonian, English widely spoken', safety: 'Very safe', bestFor: ['solo', 'couples', 'digital nomads'], costLevel: 2 },
  '134': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Latvian, English in cities', safety: 'Very safe', bestFor: ['solo', 'budget travelers', 'culture lovers'], costLevel: 1 },
  '135': { visa: 'No visa needed for US citizens (1 year)', currency: 'Georgian Lari (GEL) — ~2.7 per $1', language: 'Georgian, some English', safety: 'Very safe', bestFor: ['solo', 'foodies', 'budget travelers', 'adventurers'], costLevel: 1 },
  '136': { visa: 'eVisa or visa on arrival for US citizens', currency: 'West African CFA Franc (XOF) — ~620 per $1', language: 'French, Wolof', safety: 'Generally safe', bestFor: ['solo', 'culture lovers', 'adventurers'], costLevel: 1 },
  '137': { visa: 'eVisa required for US citizens', currency: 'Zambian Kwacha (ZMW) — ~25 per $1', language: 'English, local languages', safety: 'Safe in tourist areas', bestFor: ['adventurers', 'couples', 'nature lovers'], costLevel: 2 },
  '138': { visa: 'Visa on arrival for US citizens', currency: 'Tanzanian Shilling (TZS) — ~2,500 per $1', language: 'Swahili, English', safety: 'Safe with guides', bestFor: ['adventurers', 'couples'], costLevel: 3 },
  '139': { visa: 'Visa on arrival for US citizens', currency: 'Nigerian Naira (NGN) — ~1,500 per $1', language: 'English, Yoruba, Igbo', safety: 'Exercise caution', bestFor: ['culture lovers', 'adventurers'], costLevel: 1 },
  '140': { visa: 'eVisa for US citizens', currency: 'Ethiopian Birr (ETB) — ~56 per $1', language: 'Amharic, English in cities', safety: 'Check travel advisories', bestFor: ['culture lovers', 'adventurers', 'history buffs'], costLevel: 1 },
  '141': { visa: 'eVisa for US citizens (10 days)', currency: 'Omani Rial (OMR) — ~0.38 per $1', language: 'Arabic, English widely spoken', safety: 'Very safe', bestFor: ['couples', 'adventurers', 'culture lovers'], costLevel: 3 },
  '142': { visa: 'eVisa required for US citizens', currency: 'Indian Rupee (₹) — ~83 per $1', language: 'Konkani, English, Hindi', safety: 'Safe in tourist areas', bestFor: ['solo', 'budget travelers', 'beach lovers'], costLevel: 1 },
  '143': { visa: 'Visa on arrival for US citizens (30 days)', currency: 'Nepalese Rupee (NPR) — ~133 per $1', language: 'Nepali, English in tourist areas', safety: 'Safe', bestFor: ['adventurers', 'solo', 'budget travelers'], costLevel: 1 },
  '144': { visa: 'eVisa for US citizens (30 days)', currency: 'Sri Lankan Rupee (LKR) — ~320 per $1', language: 'Sinhala, Tamil, English', safety: 'Safe', bestFor: ['couples', 'solo', 'adventurers'], costLevel: 1 },
  '145': { visa: 'No visa needed for US citizens (4 months)', currency: 'Fijian Dollar (FJD) — ~2.2 per $1', language: 'English, Fijian, Hindi', safety: 'Very safe', bestFor: ['couples', 'honeymooners', 'families'], costLevel: 3 },
  '146': { visa: 'No visa needed for US citizens (90 days)', currency: 'CFP Franc (XPF) — ~$1.08 per 100 XPF', language: 'French, Tahitian', safety: 'Very safe', bestFor: ['couples', 'honeymooners', 'luxury travelers'], costLevel: 4 },

  // === destinations-batch3.ts (147-206) ===
  '147': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['couples', 'solo', 'nature lovers'], costLevel: 3 },
  '148': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['couples', 'foodies', 'luxury travelers'], costLevel: 4 },
  '149': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['couples', 'solo', 'luxury travelers'], costLevel: 3 },
  '150': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['adventurers', 'couples', 'luxury travelers'], costLevel: 4 },
  '151': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['families', 'couples', 'beach lovers'], costLevel: 2 },
  '152': { visa: 'No visa needed (US state)', currency: 'US Dollar ($)', language: 'English, Hawaiian', safety: 'Very safe', bestFor: ['couples', 'families', 'adventurers'], costLevel: 3 },
  '153': { visa: 'No visa needed (US state)', currency: 'US Dollar ($)', language: 'English, Hawaiian', safety: 'Very safe', bestFor: ['adventurers', 'couples', 'nature lovers'], costLevel: 3 },
  '154': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['adventurers', 'families', 'nature lovers'], costLevel: 2 },
  '155': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['families', 'couples', 'nature lovers'], costLevel: 2 },
  '156': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['families', 'couples', 'golfers'], costLevel: 3 },
  '157': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['families', 'couples', 'beach lovers'], costLevel: 2 },
  '158': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['couples', 'families', 'luxury travelers'], costLevel: 3 },
  '159': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['families', 'couples', 'beach lovers'], costLevel: 2 },
  '160': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Safe', bestFor: ['families', 'budget travelers', 'beach lovers'], costLevel: 1 },
  '161': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['families', 'couples'], costLevel: 1 },
  '162': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['couples', 'families', 'foodies'], costLevel: 2 },
  '163': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Safe', bestFor: ['foodies', 'couples', 'culture lovers'], costLevel: 2 },
  '164': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['families', 'couples', 'nature lovers'], costLevel: 3 },
  '165': { visa: 'No visa needed (US city)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['couples', 'families', 'luxury travelers'], costLevel: 4 },
  '166': { visa: 'No visa needed for US citizens', currency: 'East Caribbean Dollar (XCD) — USD widely accepted', language: 'English', safety: 'Very safe', bestFor: ['couples', 'luxury travelers', 'beach lovers'], costLevel: 4 },
  '167': { visa: 'No visa needed for US citizens (21 days)', currency: 'East Caribbean Dollar (XCD) — USD accepted', language: 'English, French Creole', safety: 'Very safe', bestFor: ['adventurers', 'eco-travelers', 'nature lovers'], costLevel: 2 },
  '168': { visa: 'No visa needed for US citizens (90 days)', currency: 'Euro (€) — ~$1.08 USD', language: 'French', safety: 'Very safe', bestFor: ['couples', 'luxury travelers'], costLevel: 4 },
  '169': { visa: 'No visa needed for US citizens (90 days)', currency: 'Euro (€) — ~$1.08 USD', language: 'French, Creole', safety: 'Safe', bestFor: ['couples', 'culture lovers', 'beach lovers'], costLevel: 2 },
  '170': { visa: 'No visa needed for US citizens (90 days)', currency: 'Euro (€) — ~$1.08 USD', language: 'French, Creole', safety: 'Safe', bestFor: ['couples', 'adventurers', 'beach lovers'], costLevel: 2 },
  '171': { visa: 'No visa needed for US citizens (6 months)', currency: 'East Caribbean Dollar (XCD) — USD accepted', language: 'English', safety: 'Safe', bestFor: ['adventurers', 'nature lovers'], costLevel: 2 },
  '172': { visa: 'No visa needed for US citizens (30 days)', currency: 'US Dollar ($)', language: 'English', safety: 'Very safe', bestFor: ['couples', 'sailors', 'beach lovers'], costLevel: 3 },
  '173': { visa: 'No visa needed for US citizens (90 days)', currency: 'Trinidad & Tobago Dollar (TTD) — ~6.8 per $1', language: 'English', safety: 'Safe in tourist areas', bestFor: ['couples', 'nature lovers', 'divers'], costLevel: 2 },
  '174': { visa: 'No visa needed for US citizens (30 days)', currency: 'Cayman Islands Dollar (KYD) — USD accepted', language: 'English', safety: 'Very safe', bestFor: ['adventurers', 'divers', 'nature lovers'], costLevel: 3 },
  '175': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Italian', safety: 'Very safe', bestFor: ['couples', 'foodies', 'hikers'], costLevel: 3 },
  '176': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Greek, English widely spoken', safety: 'Very safe', bestFor: ['couples', 'nightlife lovers', 'beach lovers'], costLevel: 3 },
  '177': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'French, English common', safety: 'Safe', bestFor: ['couples', 'luxury travelers', 'foodies'], costLevel: 4 },
  '178': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Italian', safety: 'Very safe', bestFor: ['couples', 'families', 'history buffs'], costLevel: 2 },
  '179': { visa: 'No visa needed for US citizens (90 days)', currency: 'Euro (€) — ~$1.08 USD', language: 'Montenegrin, English in tourist areas', safety: 'Very safe', bestFor: ['couples', 'budget travelers', 'beach lovers'], costLevel: 2 },
  '180': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Slovenian, English widely spoken', safety: 'Very safe', bestFor: ['couples', 'nature lovers', 'culture lovers'], costLevel: 2 },
  '181': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'German, English widely spoken', safety: 'Very safe', bestFor: ['couples', 'families', 'culture lovers'], costLevel: 3 },
  '182': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'French', safety: 'Very safe', bestFor: ['couples', 'adventurers', 'beach lovers'], costLevel: 3 },
  '183': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Italian, Sardinian', safety: 'Very safe', bestFor: ['couples', 'families', 'beach lovers'], costLevel: 3 },
  '184': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Portuguese', safety: 'Very safe', bestFor: ['couples', 'adventurers', 'nature lovers'], costLevel: 2 },
  '185': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Portuguese', safety: 'Very safe', bestFor: ['adventurers', 'nature lovers', 'couples'], costLevel: 2 },
  '186': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'Italian', safety: 'Very safe', bestFor: ['couples', 'culture lovers', 'foodies'], costLevel: 2 },
  '187': { visa: 'No visa needed for US citizens (90 days Schengen)', currency: 'Euro (€) — ~$1.08 USD', language: 'French, Alsatian', safety: 'Very safe', bestFor: ['couples', 'foodies', 'culture lovers'], costLevel: 3 },
  '188': { visa: 'No visa needed for US citizens (90 days)', currency: 'Malaysian Ringgit (MYR) — ~4.7 per $1', language: 'Malay, English', safety: 'Very safe', bestFor: ['couples', 'families', 'beach lovers'], costLevel: 1 },
  '189': { visa: 'No visa needed for US citizens (30 days)', currency: 'Philippine Peso (₱) — ~56 per $1', language: 'Filipino, English', safety: 'Safe in tourist areas', bestFor: ['adventurers', 'couples', 'divers'], costLevel: 1 },
  '190': { visa: 'Visa on arrival for US citizens (30 days)', currency: 'Indonesian Rupiah (IDR) — ~15,500 per $1', language: 'Indonesian, limited English', safety: 'Safe', bestFor: ['couples', 'surfers', 'budget travelers'], costLevel: 1 },
  '191': { visa: 'Visa on arrival for US citizens (30 days)', currency: 'Indonesian Rupiah (IDR) — ~15,500 per $1', language: 'Indonesian, Papuan languages', safety: 'Safe with guides', bestFor: ['adventurers', 'divers', 'nature lovers'], costLevel: 3 },
  '192': { visa: 'No visa needed for US citizens (30 days, extendable)', currency: 'Thai Baht (฿) — ~35 per $1', language: 'Thai, English in resorts', safety: 'Very safe', bestFor: ['couples', 'families', 'beach lovers'], costLevel: 2 },
  '193': { visa: 'Visa required — apply through licensed tour operator', currency: 'Bhutanese Ngultrum (BTN) — ~83 per $1', language: 'Dzongkha, English', safety: 'Very safe', bestFor: ['adventurers', 'culture lovers', 'solo'], costLevel: 4 },
  '194': { visa: 'No visa needed for US citizens (90 days)', currency: 'Japanese Yen (¥) — ~¥150 per $1', language: 'Japanese', safety: 'Extremely safe', bestFor: ['couples', 'families', 'beach lovers'], costLevel: 2 },
  '195': { visa: 'No visa needed for US citizens (90 days, K-ETA)', currency: 'South Korean Won (₩) — ~1,330 per $1', language: 'Korean', safety: 'Very safe', bestFor: ['couples', 'families', 'nature lovers'], costLevel: 2 },
  '196': { visa: 'No visa needed for US citizens (90 days)', currency: 'Seychellois Rupee (SCR) — ~14 per $1', language: 'Seychellois Creole, English, French', safety: 'Very safe', bestFor: ['couples', 'honeymooners', 'luxury travelers'], costLevel: 4 },
  '197': { visa: 'No visa needed for US citizens (60 days)', currency: 'Mauritian Rupee (MUR) — ~45 per $1', language: 'English, French, Creole', safety: 'Very safe', bestFor: ['couples', 'honeymooners', 'families'], costLevel: 3 },
  '198': { visa: 'eVisa for US citizens (30 days)', currency: 'Malagasy Ariary (MGA) — ~4,500 per $1', language: 'Malagasy, French', safety: 'Safe with guides', bestFor: ['adventurers', 'nature lovers', 'eco-travelers'], costLevel: 2 },
  '199': { visa: 'Visa on arrival for US citizens (30 days)', currency: 'Egyptian Pound (EGP) — ~31 per $1', language: 'Arabic, English in tourist areas', safety: 'Safe in tourist areas', bestFor: ['couples', 'history buffs', 'culture lovers'], costLevel: 1 },
  '200': { visa: 'No visa needed for US citizens (90 days)', currency: 'Moroccan Dirham (MAD) — ~10 per $1', language: 'Arabic, French, Berber', safety: 'Generally safe', bestFor: ['solo', 'couples', 'culture lovers'], costLevel: 1 },
  '201': { visa: 'No visa needed for US citizens (30 days on arrival)', currency: 'UAE Dirham (AED) — ~3.67 per $1', language: 'Arabic, English widely spoken', safety: 'Extremely safe', bestFor: ['families', 'luxury travelers', 'couples'], costLevel: 4 },
  '202': { visa: 'No visa needed for US citizens (90 days)', currency: 'Argentine Peso (ARS) — blue rate varies', language: 'Spanish', safety: 'Safe', bestFor: ['adventurers', 'couples', 'nature lovers'], costLevel: 2 },
  '203': { visa: 'No visa needed for US citizens (90 days)', currency: 'Argentine Peso (ARS) — blue rate varies', language: 'Spanish', safety: 'Safe', bestFor: ['couples', 'families', 'nature lovers'], costLevel: 2 },
  '204': { visa: 'No visa needed for US citizens (90 days)', currency: 'Brazilian Real (BRL) — ~5 per $1', language: 'Portuguese', safety: 'Safe', bestFor: ['couples', 'nature lovers', 'divers'], costLevel: 3 },
  '205': { visa: 'No visa needed for US citizens (90 days)', currency: 'Argentine Peso (ARS) — blue rate varies', language: 'Spanish', safety: 'Very safe', bestFor: ['couples', 'foodies', 'wine lovers'], costLevel: 2 },
  '206': { visa: 'No visa needed for US citizens (90 days)', currency: 'Boliviano (BOB) — ~6.9 per $1', language: 'Spanish, Quechua, Aymara', safety: 'Safe with guides', bestFor: ['adventurers', 'solo', 'nature lovers'], costLevel: 1 },
};

// Process each file
const files = [
  'data/destinations.ts',
  'data/destinations-new.ts',
  'data/destinations-extra.ts',
  'data/destinations-batch3.ts',
];

for (const file of files) {
  const filePath = `/Users/Jackson/SwypeFly/${file}`;
  let content = fs.readFileSync(filePath, 'utf8');

  // For each destination, find the closing of its object and insert travelTips before it
  // We look for patterns like:  restaurants: [...],\n  },  and insert travelTips before the closing },
  
  // Strategy: find each id, then find its object's closing pattern
  // We'll use a regex to find each destination block by id and add travelTips
  
  for (const [id, tip] of Object.entries(tips)) {
    // Check if this id exists in this file
    const idPattern = new RegExp(`id: '${id}'[,\\s]`);
    if (!idPattern.test(content)) continue;
    
    // Already has travelTips?
    // Find the position of this id, then look for the next destination's id or end of array
    const idMatch = content.match(new RegExp(`id: '${id}'`));
    if (!idMatch) continue;
    
    const idPos = content.indexOf(`id: '${id}'`);
    
    // Find the restaurants closing or itinerary closing or the object closing
    // Look for the pattern "],\n  }," or similar that closes this destination object
    // We need to find the closing of this specific destination object
    
    // Find the next occurrence of "\n  }," or "\n  }\n" after this id
    // Actually, let's find the closing brace of this object
    // Each destination ends with "  }," (with possible variations)
    
    // Let's find all "}," after idPos and pick the right one by tracking brace depth
    let braceDepth = 0;
    let startedObject = false;
    let insertPos = -1;
    
    for (let i = idPos; i < content.length; i++) {
      if (content[i] === '{') {
        braceDepth++;
        startedObject = true;
      } else if (content[i] === '}') {
        braceDepth--;
        if (startedObject && braceDepth === 0) {
          // This is the closing brace of the main destination object
          // But we started after id:, so we're inside the object. Actually we need to go back.
          // Let me reconsider: id: '1' is inside the object, so the first { we encounter is a nested one
          // We need to find the enclosing object's closing brace
          // Actually, id is at depth 0 within the object, so the first unmatched } closes it
          insertPos = i;
          break;
        }
      }
    }
    
    if (insertPos === -1) continue;
    
    // Check if travelTips already exists
    const blockBefore = content.substring(idPos, insertPos);
    if (blockBefore.includes('travelTips')) continue;
    
    // Find the last comma-newline before the closing brace
    // Insert travelTips property before the closing }
    const travelTipsStr = `    travelTips: {\n` +
      `      visa: ${JSON.stringify(tip.visa)},\n` +
      `      currency: ${JSON.stringify(tip.currency)},\n` +
      `      language: ${JSON.stringify(tip.language)},\n` +
      `      safety: ${JSON.stringify(tip.safety)},\n` +
      `      bestFor: ${JSON.stringify(tip.bestFor)},\n` +
      `      costLevel: ${tip.costLevel} as 1 | 2 | 3 | 4,\n` +
      `    },\n`;
    
    // Insert before the closing brace
    // Look backwards from insertPos to find where to insert
    let beforeClose = content.substring(0, insertPos);
    // Remove trailing whitespace
    const trimmed = beforeClose.trimEnd();
    // If it ends with comma, great. If not, add one
    if (trimmed.endsWith(',')) {
      content = trimmed + '\n' + travelTipsStr + '  ' + content.substring(insertPos);
    } else {
      content = trimmed + ',\n' + travelTipsStr + '  ' + content.substring(insertPos);
    }
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${file}`);
}

console.log('Done adding travel tips!');
