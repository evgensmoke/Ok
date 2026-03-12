import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to scrape OK.ru playlist or search results
  app.post("/api/scrape", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Input is required" });
    }

    let targetUrl = url;
    if (!url.startsWith("http")) {
      // Treat as a search query
      targetUrl = `https://m.ok.ru/music/search/${encodeURIComponent(url)}`;
    } else if (!url.includes("ok.ru")) {
      return res.status(400).json({ error: "Invalid OK.ru URL" });
    }

    try {
      // Try to fetch the page with a mobile user agent to get a simpler HTML
      const response = await axios.get(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
          "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        timeout: 10000,
      });

      if (typeof response.data !== "string") {
        throw new Error("Invalid response format from OK.ru");
      }

      const $ = cheerio.load(response.data);
      const tracks: any[] = [];

      // Check for embedded JSON data in scripts
      $("script").each((i, el) => {
        const content = $(el).html();
        if (content && content.includes("musicData")) {
          try {
            // Look for patterns like musicData: { ... }
            const match = content.match(/musicData\s*:\s*({.+?})\s*,\s*\n/);
            if (match) {
              const data = JSON.parse(match[1]);
              if (data.tracks) {
                data.tracks.forEach((t: any) => {
                  tracks.push({
                    id: t.id,
                    title: t.name || t.title,
                    artist: t.artistName || t.artist,
                    imageUrl: t.imageUrl || t.album?.imageUrl,
                  });
                });
              }
            }
          } catch (e) {}
        }
      });

      // Try to find tracks in the mobile version if not found yet
      if (tracks.length === 0) {
        $(".m_track_item, .track-item, [data-track]").each((i, el) => {
          const trackData = $(el).attr("data-track");
          if (trackData) {
            try {
              const parsed = JSON.parse(trackData);
              tracks.push({
                id: parsed.id,
                title: parsed.title,
                artist: parsed.artist,
                duration: parsed.duration,
                imageUrl: parsed.imageUrl || parsed.album?.imageUrl,
              });
            } catch (e) {}
          } else {
            // Fallback to text extraction
            const title = $(el).find(".m_track_title, .title").text().trim();
            const artist = $(el).find(".m_track_artist, .artist").text().trim();
            if (title && artist) {
              tracks.push({ title, artist });
            }
          }
        });
      }

      // If no tracks found via cheerio, try Gemini to parse the HTML
      if (tracks.length === 0) {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
        const prompt = `Extract a list of music tracks (Artist and Title) from this HTML snippet of an OK.ru playlist. Return the result as a JSON array of objects with "artist" and "title" keys. HTML: ${response.data.substring(0, 10000)}`;
        
        const result = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ parts: [{ text: prompt }] }],
          config: { responseMimeType: "application/json" }
        });

        try {
          const aiTracks = JSON.parse(result.text);
          if (Array.isArray(aiTracks)) {
            return res.json({ tracks: aiTracks });
          }
        } catch (e) {
          console.error("Gemini parsing error:", e);
        }
      }

      res.json({ tracks });
    } catch (error: any) {
      console.error("Scraping error:", error.message);
      res.status(500).json({ error: "Failed to scrape playlist. The page might be protected or require login." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
