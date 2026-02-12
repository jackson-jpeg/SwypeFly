/**
 * Seed destination_images for destinations 21-50.
 * Run: npx tsx scripts/seed-images-batch2.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceRoleKey);

const u = (id: string) => `https://images.unsplash.com/photo-${id}?w=1080&q=80&auto=format&fit=crop`;
const uSmall = (id: string) => `https://images.unsplash.com/photo-${id}?w=400&q=80&auto=format&fit=crop`;
const uRaw = (id: string) => `https://images.unsplash.com/photo-${id}`;

interface CuratedImage {
  photoId: string;
  photographer: string;
  photographerUrl: string;
}

const CURATED_IMAGES: Record<string, CuratedImage[]> = {
  // 21. Cancún
  '21': [
    { photoId: '1510097467424-ae18c8e2bd26', photographer: 'Marv Watson', photographerUrl: 'https://unsplash.com/@marvelous' },
    { photoId: '1552074284-5e88ef1aef18', photographer: 'Sandro Schuh', photographerUrl: 'https://unsplash.com/@sandroschuh' },
    { photoId: '1507525428034-b723cf961d3e', photographer: 'Sean Oulashin', photographerUrl: 'https://unsplash.com/@oulashin' },
  ],
  // 22. Punta Cana
  '22': [
    { photoId: '1505881502353-a1986add3762', photographer: 'Chen Mizrach', photographerUrl: 'https://unsplash.com/@chenmizrach' },
    { photoId: '1519046904884-53103b34b206', photographer: 'Maciej Serafinowicz', photographerUrl: 'https://unsplash.com/@maciej' },
    { photoId: '1471922694854-ff1b63b20054', photographer: 'Adam Birkett', photographerUrl: 'https://unsplash.com/@abrkett' },
  ],
  // 23. Montego Bay
  '23': [
    { photoId: '1580237072617-771c3ecc4a24', photographer: 'Yves Alarie', photographerUrl: 'https://unsplash.com/@yvesalarie' },
    { photoId: '1544551763-46a013bb70d5', photographer: 'Shawn Ang', photographerUrl: 'https://unsplash.com/@shawnanggg' },
    { photoId: '1548574505-5e239809ee19', photographer: 'Yousef Espanioly', photographerUrl: 'https://unsplash.com/@yespanioly' },
  ],
  // 24. San Juan
  '24': [
    { photoId: '1564604961077-43f33bc77c90', photographer: 'Lance Asper', photographerUrl: 'https://unsplash.com/@lanceasper' },
    { photoId: '1580309237429-661ea32afd36', photographer: 'Willian Justen', photographerUrl: 'https://unsplash.com/@willianjusten' },
    { photoId: '1515862122502-cdd1660ae3b6', photographer: 'Kirsten Drew', photographerUrl: 'https://unsplash.com/@kirsten_drew' },
  ],
  // 25. Aruba
  '25': [
    { photoId: '1548574505-5e239809ee19', photographer: 'Yousef Espanioly', photographerUrl: 'https://unsplash.com/@yespanioly' },
    { photoId: '1506953823645-5f46f0aff5fa', photographer: 'Aaron Burden', photographerUrl: 'https://unsplash.com/@aaronburden' },
    { photoId: '1520454974749-611b7248ffdb', photographer: 'Jason Briscoe', photographerUrl: 'https://unsplash.com/@jsnbrsc' },
  ],
  // 26. Nassau / Bahamas
  '26': [
    { photoId: '1548574505-5e239809ee19', photographer: 'Yousef Espanioly', photographerUrl: 'https://unsplash.com/@yespanioly' },
    { photoId: '1559128010-7c1ad6e1b6a3', photographer: 'Jason Briscoe', photographerUrl: 'https://unsplash.com/@jsnbrsc' },
    { photoId: '1544551763-77932be1fd02', photographer: 'Ishan', photographerUrl: 'https://unsplash.com/@seefromthesky' },
  ],
  // 27. Cozumel
  '27': [
    { photoId: '1544551763-46a013bb70d5', photographer: 'Shawn Ang', photographerUrl: 'https://unsplash.com/@shawnanggg' },
    { photoId: '1507525428034-b723cf961d3e', photographer: 'Sean Oulashin', photographerUrl: 'https://unsplash.com/@oulashin' },
    { photoId: '1505228395891-9a51e7e86bf6', photographer: 'Daniel Olah', photographerUrl: 'https://unsplash.com/@danesduet' },
  ],
  // 28. St. Lucia
  '28': [
    { photoId: '1560713781-d00f6e0e5664', photographer: 'Sandro Schuh', photographerUrl: 'https://unsplash.com/@sandroschuh' },
    { photoId: '1514282401047-d79a71a590e8', photographer: 'Shifaaz shamoon', photographerUrl: 'https://unsplash.com/@sotti' },
    { photoId: '1559128010-7c1ad6e1b6a3', photographer: 'Jason Briscoe', photographerUrl: 'https://unsplash.com/@jsnbrsc' },
  ],
  // 29. Costa Rica
  '29': [
    { photoId: '1518259102261-b40117eabbc9', photographer: 'Etienne Delorieux', photographerUrl: 'https://unsplash.com/@etiennedelorieux' },
    { photoId: '1544551763-77932be1fd02', photographer: 'Ishan', photographerUrl: 'https://unsplash.com/@seefromthesky' },
    { photoId: '1469521669194-a7216b455aa2', photographer: 'David Wirzba', photographerUrl: 'https://unsplash.com/@dwirzba' },
  ],
  // 30. Bogotá
  '30': [
    { photoId: '1568226940647-163e5e5bf32b', photographer: 'Flavia Carpio', photographerUrl: 'https://unsplash.com/@flaviac' },
    { photoId: '1518791841217-8f162f1e1131', photographer: 'Kimi Albertson', photographerUrl: 'https://unsplash.com/@kimi' },
    { photoId: '1524413840807-0c3cb6fa808d', photographer: 'Andrea Junqueira', photographerUrl: 'https://unsplash.com/@ajunq' },
  ],
  // 31. Medellín
  '31': [
    { photoId: '1599930113854-d6d7fd521f10', photographer: 'Kobby Mendez', photographerUrl: 'https://unsplash.com/@kobbymendez' },
    { photoId: '1568226940647-163e5e5bf32b', photographer: 'Flavia Carpio', photographerUrl: 'https://unsplash.com/@flaviac' },
    { photoId: '1558642084-fd07fae5282e', photographer: 'Annie Spratt', photographerUrl: 'https://unsplash.com/@anniespratt' },
  ],
  // 32. Lima
  '32': [
    { photoId: '1531968455002-56953528e7eb', photographer: 'Willian Justen', photographerUrl: 'https://unsplash.com/@willianjusten' },
    { photoId: '1526392060635-9d6019884377', photographer: 'Errin Casano', photographerUrl: 'https://unsplash.com/@errin' },
    { photoId: '1580619305218-8423a7ef79b4', photographer: 'Eddie Kiszka', photographerUrl: 'https://unsplash.com/@eddiekiszka' },
  ],
  // 33. Cartagena
  '33': [
    { photoId: '1583361704493-d4d105451adc', photographer: 'Azzedine Rouichi', photographerUrl: 'https://unsplash.com/@azzedinerouichi' },
    { photoId: '1558642084-fd07fae5282e', photographer: 'Annie Spratt', photographerUrl: 'https://unsplash.com/@anniespratt' },
    { photoId: '1524413840807-0c3cb6fa808d', photographer: 'Andrea Junqueira', photographerUrl: 'https://unsplash.com/@ajunq' },
  ],
  // 34. Panama City
  '34': [
    { photoId: '1555217851-5dc7cb14e76c', photographer: 'Carlos Muza', photographerUrl: 'https://unsplash.com/@kmuza' },
    { photoId: '1512453979798-5ea266f8880c', photographer: 'David Rodrigo', photographerUrl: 'https://unsplash.com/@davidrodrigophoto' },
    { photoId: '1518684079-3c830dcef090', photographer: 'ZQ Lee', photographerUrl: 'https://unsplash.com/@zqlee' },
  ],
  // 35. London
  '35': [
    { photoId: '1513635269975-59663e0ac1ad', photographer: 'Benjamin Davies', photographerUrl: 'https://unsplash.com/@bendavisual' },
    { photoId: '1486299267070-83823f5448dd', photographer: 'Charles Postiaux', photographerUrl: 'https://unsplash.com/@charlpost' },
    { photoId: '1533929736458-ca588d08c8be', photographer: 'Eva Dang', photographerUrl: 'https://unsplash.com/@evdang' },
  ],
  // 36. Paris
  '36': [
    { photoId: '1502602898657-3e91760cbb34', photographer: 'Chris Karidis', photographerUrl: 'https://unsplash.com/@chriskaridis' },
    { photoId: '1499856871958-5b9627545d1a', photographer: 'Anthony DELANOIX', photographerUrl: 'https://unsplash.com/@anthonydelanoix' },
    { photoId: '1511739001486-6bfe10ce65f6', photographer: 'Alexander Kagan', photographerUrl: 'https://unsplash.com/@alxndr_kgn' },
  ],
  // 37. Amsterdam
  '37': [
    { photoId: '1534351590666-13e3e96b5017', photographer: 'Adrien Olichon', photographerUrl: 'https://unsplash.com/@adrienolichon' },
    { photoId: '1512470876767-fc00e9c6bd56', photographer: 'Deborah Cortelazzi', photographerUrl: 'https://unsplash.com/@dcortelazzi' },
    { photoId: '1558618666-fcd25c85f82e', photographer: 'Max van den Oetelaar', photographerUrl: 'https://unsplash.com/@maxvdo' },
  ],
  // 38. Rome
  '38': [
    { photoId: '1552832230-c0197dd311b5', photographer: 'David Kohler', photographerUrl: 'https://unsplash.com/@davidkhlr' },
    { photoId: '1515542622106-78bda8ba0e5b', photographer: 'David Köhler', photographerUrl: 'https://unsplash.com/@davidkhlr' },
    { photoId: '1529260830199-42c24126f198', photographer: 'Nicole Reyes', photographerUrl: 'https://unsplash.com/@nicolereyesphoto' },
  ],
  // 39. Dublin
  '39': [
    { photoId: '1549918864-48ac978761a4', photographer: 'Diogo Palhais', photographerUrl: 'https://unsplash.com/@diogo_palhais' },
    { photoId: '1543432532-3e7a70edc8b1', photographer: 'Ruben Hanssen', photographerUrl: 'https://unsplash.com/@rubenhanssen' },
    { photoId: '1564959130747-897fb406b9af', photographer: 'Leo Moko', photographerUrl: 'https://unsplash.com/@leo_moko' },
  ],
  // 40. Prague
  '40': [
    { photoId: '1541849546-216549ae216d', photographer: 'Anthony Delanoix', photographerUrl: 'https://unsplash.com/@anthonydelanoix' },
    { photoId: '1519677100203-a0e668c92439', photographer: 'Sasha Stories', photographerUrl: 'https://unsplash.com/@sanfrancisco' },
    { photoId: '1458150945489-84ca0f44e1ca', photographer: 'Soner Eker', photographerUrl: 'https://unsplash.com/@sonereker' },
  ],
  // 41. Copenhagen
  '41': [
    { photoId: '1513622470522-26c3c8a854bc', photographer: 'Nick Karvounis', photographerUrl: 'https://unsplash.com/@nickkarvounis' },
    { photoId: '1552560880-2482dbb9852e', photographer: 'Peter Lloyd', photographerUrl: 'https://unsplash.com/@peterrlloyd' },
    { photoId: '1531366936337-7c912a4589a7', photographer: 'Ricardo Gomez Angel', photographerUrl: 'https://unsplash.com/@rgaleriacom' },
  ],
  // 42. Berlin
  '42': [
    { photoId: '1560969184-10fe8719e047', photographer: 'Adam Vradenburg', photographerUrl: 'https://unsplash.com/@vradenburg' },
    { photoId: '1528728329032-2972f65dfb3f', photographer: 'Claudio Schwarz', photographerUrl: 'https://unsplash.com/@purzlbaum' },
    { photoId: '1546726747-421c6d69c929', photographer: 'Florian Wehde', photographerUrl: 'https://unsplash.com/@florianwehde' },
  ],
  // 43. Bangkok
  '43': [
    { photoId: '1508009603885-50cf7c579365', photographer: 'Florian Wehde', photographerUrl: 'https://unsplash.com/@florianwehde' },
    { photoId: '1563492065599-3520f775eeed', photographer: 'Evan Krause', photographerUrl: 'https://unsplash.com/@evankrause' },
    { photoId: '1528181304800-259b08848526', photographer: 'Florian Wehde', photographerUrl: 'https://unsplash.com/@florianwehde' },
  ],
  // 44. Singapore
  '44': [
    { photoId: '1525625293386-3f8f99389edd', photographer: 'Victor Garcia', photographerUrl: 'https://unsplash.com/@viktorgh' },
    { photoId: '1496939376851-89342e90adcd', photographer: 'Corinne Kutz', photographerUrl: 'https://unsplash.com/@corinnekutz' },
    { photoId: '1565967511849-76a60a516170', photographer: 'Sergio Sala', photographerUrl: 'https://unsplash.com/@sergiosala' },
  ],
  // 45. Seoul
  '45': [
    { photoId: '1517154421773-0529f29ea451', photographer: 'Ryoji Iwata', photographerUrl: 'https://unsplash.com/@ryoji__iwata' },
    { photoId: '1546874177-9e664f230a75', photographer: 'Sava Bobov', photographerUrl: 'https://unsplash.com/@savabobov' },
    { photoId: '1534274988757-a28bf68a9c74', photographer: 'Craig Whitehead', photographerUrl: 'https://unsplash.com/@sixstreetunder' },
  ],
  // 46. Hanoi
  '46': [
    { photoId: '1555921015-5532091f6026', photographer: 'Florian Wehde', photographerUrl: 'https://unsplash.com/@florianwehde' },
    { photoId: '1528127269322-539152af5929', photographer: 'Peter Hammer', photographerUrl: 'https://unsplash.com/@peterham' },
    { photoId: '1583417319070-4a69db38a482', photographer: 'Silver Ringvee', photographerUrl: 'https://unsplash.com/@silverringvee' },
  ],
  // 47. Honolulu
  '47': [
    { photoId: '1507876466758-bc54f384809c', photographer: 'Braden Jarvis', photographerUrl: 'https://unsplash.com/@bradenjarvis' },
    { photoId: '1542259009477-d625272157b7', photographer: 'Karsten Winegeart', photographerUrl: 'https://unsplash.com/@karsten116' },
    { photoId: '1519451241324-20b4ea2c4220', photographer: 'Sean Oulashin', photographerUrl: 'https://unsplash.com/@oulashin' },
  ],
  // 48. New Orleans
  '48': [
    { photoId: '1568402102990-bc541580b59f', photographer: 'Rosie Kerr', photographerUrl: 'https://unsplash.com/@rosiekerr' },
    { photoId: '1549924231-f129b911e442', photographer: 'Miguel Andrade', photographerUrl: 'https://unsplash.com/@miguelavandrade' },
    { photoId: '1560543743-95d9c5bab2f6', photographer: 'Jessica Loaiza', photographerUrl: 'https://unsplash.com/@jessploaiza' },
  ],
  // 49. Nashville
  '49': [
    { photoId: '1545419913-ee0ca1e2a9eb', photographer: 'Drew Hays', photographerUrl: 'https://unsplash.com/@drew_hays' },
    { photoId: '1569449571296-3c5e73bd523e', photographer: 'Drew Hays', photographerUrl: 'https://unsplash.com/@drew_hays' },
    { photoId: '1543168256-418811576931', photographer: 'Tanner Boriack', photographerUrl: 'https://unsplash.com/@tannerboriack' },
  ],
  // 50. New York
  '50': [
    { photoId: '1496442226666-8d4d0e62e6e9', photographer: 'Pedro Lastra', photographerUrl: 'https://unsplash.com/@peterlaster' },
    { photoId: '1534430480872-3498386e7856', photographer: 'Colton Duke', photographerUrl: 'https://unsplash.com/@csoref' },
    { photoId: '1522083165195-3424ed4f7b27', photographer: 'Robert Bye', photographerUrl: 'https://unsplash.com/@robertbye' },
    { photoId: '1518235925288-2dda0e23395a', photographer: 'Luca Bravo', photographerUrl: 'https://unsplash.com/@lucabravo' },
  ],
};

async function seedImages() {
  console.log('Seeding curated images for destinations 21-50...\n');

  let total = 0;
  let errors = 0;

  for (const [destId, images] of Object.entries(CURATED_IMAGES)) {
    const { error: deleteErr } = await supabase
      .from('destination_images')
      .delete()
      .eq('destination_id', destId);

    if (deleteErr) {
      console.error(`  ✗ Delete failed for dest ${destId}: ${deleteErr.message}`);
      errors++;
      continue;
    }

    const rows = images.map((img, idx) => ({
      destination_id: destId,
      unsplash_id: img.photoId.split('-')[0] || img.photoId,
      url_raw: uRaw(img.photoId),
      url_regular: u(img.photoId),
      url_small: uSmall(img.photoId),
      blur_hash: '',
      photographer: img.photographer,
      photographer_url: img.photographerUrl,
      is_primary: idx === 0,
      fetched_at: new Date().toISOString(),
    }));

    const { error: insertErr } = await supabase
      .from('destination_images')
      .insert(rows);

    if (insertErr) {
      console.error(`  ✗ Insert failed for dest ${destId}: ${insertErr.message}`);
      errors++;
    } else {
      console.log(`  ✓ Dest ${destId}: ${images.length} images`);
      total += images.length;
    }
  }

  console.log(`\nDone! Seeded ${total} images for ${Object.keys(CURATED_IMAGES).length} destinations.`);
  if (errors > 0) console.log(`${errors} errors occurred.`);
}

seedImages().catch(console.error);
