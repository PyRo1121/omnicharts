-- Free-tier audit: health lag, prune, and MAX(sampled_at) — docs/audits/cloudflare-free-tier-audit.md
CREATE INDEX IF NOT EXISTS idx_viewer_samples_sampled_at ON viewer_samples(sampled_at);
