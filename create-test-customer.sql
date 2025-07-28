-- Skapa en testkund för att testa Dashboard v3
INSERT INTO customers (
  id,
  email,
  name,
  project,
  password_hash,
  status,
  access_expires_at,
  created_at,
  updated_at
) VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  'test@example.com',
  'Test Kund',
  'Test Projekt',
  -- Password hash för 'test123' (bcrypt)
  '$2a$10$K7L/8rLFJ5y.5uX9rOa5ueMPXf.X9J5X9rLFJ5y.5uX9rOa5ue',
  'active',
  NOW() + INTERVAL '30 days',
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  project = EXCLUDED.project,
  password_hash = EXCLUDED.password_hash,
  status = EXCLUDED.status,
  access_expires_at = EXCLUDED.access_expires_at,
  updated_at = NOW();
