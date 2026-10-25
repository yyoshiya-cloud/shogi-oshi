import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { scrapeAllActivePlayers, fetchPlayerProfileDetail } from './src/services/playerSyncService';
import { scrapeMatchPlan, scrapeMonthlyResults, getAll2026Results } from './src/services/matchSyncService';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure HMR is disabled in AI Studio dev server environment
process.env.DISABLE_HMR = 'true';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // API Route for automatic / manual player scraping & synchronization
  app.get('/api/players/sync', async (req, res) => {
    try {
      const force = req.query.force === 'true';
      const result = await scrapeAllActivePlayers(force);
      res.json(result);
    } catch (error: any) {
      console.error('Error in /api/players/sync:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to sync players',
      });
    }
  });

  // API Route for scraping match plans from https://www.shogi.or.jp/game/?tab=schedule
  app.get('/api/matches/sync', async (req, res) => {
    try {
      const force = req.query.force === 'true';
      const result = await scrapeMatchPlan(force);
      res.json(result);
    } catch (error: any) {
      console.error('Error in /api/matches/sync:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to sync matches',
      });
    }
  });

  // API Route for retrieving monthly official match results from https://www.shogi.or.jp/game/?month=YYYYMM
  app.get('/api/matches/results', async (req, res) => {
    try {
      const month = (req.query.month as string) || '202610';
      const force = req.query.force === 'true';
      const all = req.query.all === 'true';
      if (all) {
        const results = await getAll2026Results();
        return res.json({ success: true, all: true, data: results });
      }
      const result = await scrapeMonthlyResults(month, force);
      res.json(result);
    } catch (error: any) {
      console.error('Error in /api/matches/results:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to fetch match results',
      });
    }
  });


  app.get('/api/players/profile-details', async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ success: false, error: 'url parameter required' });
      }
      const name = req.query.name as string | undefined;
      const details = await fetchPlayerProfileDetail(url, name);
      res.json({ success: true, details });
    } catch (error: any) {
      console.error('Error in /api/players/profile-details:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to fetch player details',
      });
    }
  });

  // Secure Image Proxy for official Shogi Federation & LPSA player profile photos
  app.get('/api/proxy/image', async (req, res) => {
    try {
      const targetUrl = req.query.url as string;
      if (!targetUrl) {
        return res.status(400).send('Missing url parameter');
      }
      const parsed = new URL(targetUrl);
      if (
        !parsed.hostname.endsWith('shogi.or.jp') &&
        !parsed.hostname.endsWith('joshi-shogi.com')
      ) {
        return res.status(403).send('Forbidden host');
      }

      const imgRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: `${parsed.protocol}//${parsed.hostname}/`,
        },
      });

      if (!imgRes.ok) {
        return res.status(imgRes.status).send('Failed to fetch upstream image');
      }

      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const arrayBuffer = await imgRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error('Error proxying image:', err);
      res.status(500).send('Error proxying image');
    }
  });

  const httpServer = http.createServer(app);

  // Setup Vite in Dev mode or serve static files in Production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
    // Non-blocking background initial scrape cache warmup
    scrapeAllActivePlayers(false)
      .then((res) => {
        console.log(`[Auto-Scrape] Cache warmed with ${res.count} players from official sites (Pros: ${res.sourceCounts.proFederation}, Ladies: ${res.sourceCounts.ladyFederation}, LPSA: ${res.sourceCounts.ladyLPSA})`);
      })
      .catch((err) => {
        console.warn('[Auto-Scrape] Warmup warning:', err.message);
      });

    scrapeMatchPlan(false)
      .then((res) => {
        console.log(`[Auto-MatchPlan] Cache warmed with ${res.count} match plans from shogidata.info`);
      })
      .catch((err) => {
        console.warn('[Auto-MatchPlan] Warmup warning:', err.message);
      });
  });
}

startServer();
