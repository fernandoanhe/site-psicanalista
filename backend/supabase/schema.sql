-- =============================================================
-- SCHEMA: site-psicanalista
-- =============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- TABLE: site_content
-- Stores all editable content for the website
-- =============================================================
CREATE TABLE IF NOT EXISTS site_content (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  section VARCHAR(50) NOT NULL,
  label VARCHAR(150) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('text', 'richtext', 'image', 'number')),
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- TABLE: availability
-- Weekly recurring schedule configuration
-- =============================================================
CREATE TABLE IF NOT EXISTS availability (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  -- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration INTEGER NOT NULL DEFAULT 60,
  -- duration in minutes
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (day_of_week)
);

-- =============================================================
-- TABLE: blocked_dates
-- Full days where no bookings are accepted
-- =============================================================
CREATE TABLE IF NOT EXISTS blocked_dates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  reason VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- TABLE: blocked_slots
-- Individual time slots blocked within an otherwise available day
-- =============================================================
CREATE TABLE IF NOT EXISTS blocked_slots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL,
  time TIME NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (date, time)
);

-- =============================================================
-- TABLE: bookings
-- Patient session bookings with payment info
-- =============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_name VARCHAR(200) NOT NULL,
  patient_email VARCHAR(200) NOT NULL,
  patient_phone VARCHAR(30),
  session_date DATE NOT NULL,
  session_time TIME NOT NULL,
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('pix', 'credit_card')),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_amount NUMERIC(10, 2),
  pagseguro_order_id VARCHAR(100),
  payment_id VARCHAR(100),
  reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_session_date ON bookings (session_date);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings (payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_reminder ON bookings (reminder_sent, payment_status, session_date);

-- =============================================================
-- TABLE: admin_user
-- Single admin account
-- =============================================================
CREATE TABLE IF NOT EXISTS admin_user (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email VARCHAR(200) UNIQUE NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- SEED DATA: site_content
-- =============================================================
INSERT INTO site_content (key, section, label, type, value) VALUES

-- HERO section
('hero_headline',        'hero',    'Título principal (Hero)',          'text',     'Psicanálise online para quem busca autoconhecimento real'),
('hero_subheadline',     'hero',    'Subtítulo (Hero)',                 'richtext', 'Um espaço seguro e confidencial para você falar, ser ouvido e compreender o que te move por dentro.'),
('hero_cta_text',        'hero',    'Texto do botão CTA (Hero)',        'text',     'Agendar minha sessão'),
('hero_image',           'hero',    'Imagem de fundo (Hero)',           'image',    ''),

-- SOBRE MIM section
('about_title',          'sobre',   'Título da seção Sobre Mim',        'text',     'Sobre mim'),
('about_name',           'sobre',   'Nome completo do analista',        'text',     'Dra. Ana Paula Ferreira'),
('about_credentials',    'sobre',   'Credenciais / CRP',                'text',     'Psicanalista · CRP 06/12345'),
('about_bio',            'sobre',   'Biografia',                        'richtext', 'Sou psicanalista com formação pela Sociedade Brasileira de Psicanálise de São Paulo e mais de 12 anos de experiência clínica. Atendo adultos de forma online, com escuta cuidadosa e comprometida com o processo de cada pessoa.'),
('about_photo',          'sobre',   'Foto do analista',                 'image',    ''),
('about_formation',      'sobre',   'Formação acadêmica',               'richtext', 'Graduação em Psicologia pela USP · Especialização em Psicanálise pela SBPSP · Formação em Teoria das Relações Objetais'),

-- CTA / AGENDAMENTO section
('cta_title',            'cta',     'Título da seção de agendamento',   'text',     'Agende sua sessão'),
('cta_subtitle',         'cta',     'Subtítulo da seção de agendamento','text',     'Sessões online via Google Meet, com total privacidade e comodidade.'),
('session_price',        'cta',     'Valor da sessão (em reais)',        'number',   '200'),
('session_duration',     'cta',     'Duração da sessão (em minutos)',   'number',   '50'),
('cta_pix_label',        'cta',     'Label do botão PIX',               'text',     'Pagar com PIX'),
('cta_card_label',       'cta',     'Label do botão Cartão',            'text',     'Pagar com Cartão'),

-- RODAPÉ section
('footer_email',         'rodape',  'E-mail de contato (rodapé)',       'text',     'contato@anapaulaferreira.com.br'),
('footer_instagram',     'rodape',  'Instagram (sem @)',                'text',     'draanapaula.psicanalista'),
('footer_whatsapp',      'rodape',  'WhatsApp (apenas números)',        'text',     '5511999999999'),
('footer_tagline',       'rodape',  'Tagline do rodapé',               'text',     'Psicanálise online · Atendimento individual para adultos'),
('footer_copyright',     'rodape',  'Texto de copyright',              'text',     '© 2026 Dra. Ana Paula Ferreira. Todos os direitos reservados.'),

-- CONFIGURAÇÕES section
('meta_title',           'config',  'Título da página (SEO)',           'text',     'Dra. Ana Paula Ferreira · Psicanalista Online'),
('meta_description',     'config',  'Descrição meta (SEO)',             'text',     'Psicanálise online para adultos. Agende sua sessão com a Dra. Ana Paula Ferreira, psicanalista com mais de 12 anos de experiência.'),
('google_meet_link',     'config',  'Link do Google Meet padrão',       'text',     'https://meet.google.com/seu-link-aqui'),
('timezone',             'config',  'Fuso horário do atendimento',      'text',     'America/Sao_Paulo')

ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
