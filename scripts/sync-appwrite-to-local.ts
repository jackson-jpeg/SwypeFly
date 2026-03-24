
import { Client, Databases, Query } from 'node-appwrite';
import * as fs from 'fs';
import * as path from 'path';

const ENDPOINT = "https://nyc.cloud.appwrite.io/v1";
const PROJECT = "6999fc4200302e0ff341";
const KEY = "standard_3d8e9a1a283a8f881d9a711f90a88cf0f37690c09d697df851cbf894984e382af3f5334f118b574a1eebc5bb1b2862c16441db0110177215ef547c03de9689ad86b39be3e12c61364fe66864c419388daaa586be6ec1e48ab61762d36e458bee6c781962642b4b1f81f1de3af8e1175b58edae37e948a1ba1a6ce2b4e5cb3fb6";
const DB = "sogojet";

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT)
  .setKey(KEY);

const databases = new Databases(client);

async function sync() {
  console.log('🔄 Syncing Appwrite destinations to local code...');
  
  const response = await databases.listDocuments(DB, 'destinations', [Query.limit(500)]);
  const docs = response.documents;
  console.log(`✅ Found ${docs.length} destinations in Appwrite`);

  const imageResponse = await databases.listDocuments(DB, 'destination_images', [Query.limit(2500)]);
  const imageDocs = imageResponse.documents;
  const imageMap = new Map();
  imageDocs.forEach((img: any) => {
    if (!imageMap.has(img.destination_id)) imageMap.set(img.destination_id, []);
    imageMap.get(img.destination_id).push(img.url);
  });

  const dataDir = path.join(__dirname, '../data');
  const files = fs.readdirSync(dataDir).filter(f => f.startsWith('destinations') && f.endsWith('.ts'));

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    for (const doc of docs) {
      const iata = doc.iata_code;
      const imageUrl = doc.image_url;
      const imageUrls = imageMap.get(doc.$id) || [];

      // Find the object that has this iataCode
      const iataPattern = new RegExp(`iataCode:\\s*['"]${iata}['"]`, 'i');
      const iataMatch = content.match(iataPattern);
      if (!iataMatch) continue;

      const iataIndex = iataMatch.index!;
      // Find the start and end of the object containing this iataCode
      const blockStart = content.lastIndexOf('{', iataIndex);
      
      // Basic brace counting to find the matching closing brace
      let depth = 0;
      let blockEnd = -1;
      for (let i = blockStart; i < content.length; i++) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}') {
          depth--;
          if (depth === 0) {
            blockEnd = i;
            break;
          }
        }
      }

      if (blockStart === -1 || blockEnd === -1) continue;

      let block = content.substring(blockStart, blockEnd + 1);
      const originalBlock = block;

      if (imageUrl) {
        // Replace imageUrl: '...'
        block = block.replace(/imageUrl:\s*['"].*?['"]/, `imageUrl: '${imageUrl}'`);
      }

      if (imageUrls.length > 0) {
        // Replace imageUrls: [...]
        const newImageUrlsStr = `imageUrls: [\n      ${imageUrls.map((url: string) => `'${url}'`).join(',\n      ')}\n    ]`;
        block = block.replace(/imageUrls:\s*\[[\s\S]*?\]/, newImageUrlsStr);
      }

      if (block !== originalBlock) {
        content = content.substring(0, blockStart) + block + content.substring(blockEnd + 1);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated ${file}`);
    }
  }
}

sync().catch(console.error);
