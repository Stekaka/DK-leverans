-- Download jobs table for async ZIP creation
CREATE TABLE IF NOT EXISTS download_jobs (
  id TEXT PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  file_ids JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'preparing', -- preparing, processing, completed, failed
  total_files INTEGER NOT NULL,
  processed_files INTEGER DEFAULT 0,
  progress INTEGER DEFAULT 0, -- percentage 0-100
  total_size BIGINT NOT NULL,
  zip_filename TEXT,
  zip_size BIGINT,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_download_jobs_customer_id ON download_jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_download_jobs_status ON download_jobs(status);
CREATE INDEX IF NOT EXISTS idx_download_jobs_created_at ON download_jobs(created_at);

-- Row Level Security
ALTER TABLE download_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: customers can only see their own download jobs
CREATE POLICY download_jobs_customer_policy ON download_jobs
  FOR ALL USING (customer_id = auth.uid());

-- Grant permissions
GRANT ALL ON download_jobs TO authenticated;
GRANT ALL ON download_jobs TO service_role;
