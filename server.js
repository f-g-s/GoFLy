import "dotenv/config";
import express from "express";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { watch } from "fs";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 5000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

app.use(express.static(join(__dirname, "public")));
app.use(express.json());

app.get("/api/spots", async (req, res) => {
  const { data, error } = await supabase.from("spots").select("*").order("created_at");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/spots", async (req, res) => {
  console.log("body:", req.body);
  const { data, error } = await supabase.from("spots").insert(req.body).select().single();
  console.log("data:", data, "error:", error);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.put("/api/spots/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("spots")
    .update(req.body)
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

app.delete("/api/spots/:id", async (req, res) => {
  const { error } = await supabase.from("spots").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// Live-reload: SSE endpoint
const reloadClients = new Set();
app.get("/livereload", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.write("data: connected\n\n");
  reloadClients.add(res);
  req.on("close", () => reloadClients.delete(res));
});

function notifyReload() {
  for (const res of reloadClients) {
    res.write("data: reload\n\n");
  }
}

const watchDirs = [__dirname, join(__dirname, "public")];
for (const dir of watchDirs) {
  watch(dir, (_, filename) => {
    if (filename && /\.(js|html|css)$/.test(filename) && filename !== "server.js") {
      console.log(`[livereload] ${filename} geändert`);
      notifyReload();
    }
  });
}

// Server-Sent Events: run check.js and stream output to browser
app.get("/run", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const child = spawn("node", ["check.js"], { cwd: __dirname });

  child.stdout.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (line !== undefined && line !== null) {
        res.write(`data: ${JSON.stringify({ type: "log", text: line })}\n\n`);
      }
    }
  });

  child.stderr.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) {
        res.write(`data: ${JSON.stringify({ type: "error", text: line })}\n\n`);
      }
    }
  });

  child.on("close", (code) => {
    res.write(`data: ${JSON.stringify({ type: "done", code })}\n\n`);
    res.end();
  });

  req.on("close", () => child.kill());
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});