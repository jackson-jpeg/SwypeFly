-- AI response cache table for controlling costs across Gemini + Claude endpoints
CREATE TABLE IF NOT EXISTS ai_cache (
  cache_key TEXT PRIMARY KEY,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ttl_seconds INT NOT NULL DEFAULT 3600
);

-- Index for cache cleanup
CREATE INDEX IF NOT EXISTS idx_ai_cache_created_at ON ai_cache (created_at);

-- Allow service role full access, public read for cache hits
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read ai_cache" ON ai_cache
  FOR SELECT USING (true);

CREATE POLICY "Service role write ai_cache" ON ai_cache
  FOR ALL USING (auth.role() = 'service_role');
