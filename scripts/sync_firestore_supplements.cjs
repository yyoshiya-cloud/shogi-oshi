const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const bundled = JSON.parse(fs.readFileSync('src/data/results2026.json', 'utf8'));

async function syncToFirestore() {
  console.log('Syncing enriched results to Firestore fiscal_results...');
  const months = Object.keys(bundled);

  for (const month of months) {
    const list = bundled[month];
    if (!list || list.length === 0) continue;

    // Check if doc already exists or write updated list
    const docRef = doc(db, 'fiscal_results', month);
    try {
      await setDoc(docRef, {
        results: list,
        count: list.length,
        updatedAt: new Date().toISOString(),
        enriched: true,
      }, { merge: true });
      console.log(`Synced month ${month}: ${list.length} matches`);
    } catch (e) {
      console.error(`Failed to sync month ${month}:`, e.message);
    }
  }

  console.log('Finished syncing to Firestore!');
  process.exit(0);
}

syncToFirestore();
