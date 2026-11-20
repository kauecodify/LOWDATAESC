-- Split Payment Service Database Initialization
-- Schema: split_payments

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS split_payments;

-- Set search path
SET search_path TO split_payments;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create split_transactions table
CREATE TABLE IF NOT EXISTS split_payments.split_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consortium_id UUID NOT NULL,
    payment_id UUID NOT NULL,
    transaction_type VARCHAR(50) NOT NULL DEFAULT 'PAYMENT',
    method VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    original_amount DECIMAL(20, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    tax_info JSONB NOT NULL,
    split_amounts JSONB NOT NULL,
    gateway_info JSONB,
    transaction_id VARCHAR(255),
    reference_id VARCHAR(255),
    split_hash VARCHAR(512) NOT NULL UNIQUE,
    sped_info JSONB,
    webhook_info JSONB,
    escrow_info JSONB,
    error_info JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500)
);

-- Create indexes for split_transactions
CREATE INDEX IF NOT EXISTS idx_split_transactions_consortium_id ON split_payments.split_transactions(consortium_id);
CREATE INDEX IF NOT EXISTS idx_split_transactions_payment_id ON split_payments.split_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_split_transactions_transaction_id ON split_payments.split_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_split_transactions_status ON split_payments.split_transactions(status);
CREATE INDEX IF NOT EXISTS idx_split_transactions_method ON split_payments.split_transactions(method);
CREATE INDEX IF NOT EXISTS idx_split_transactions_split_hash ON split_payments.split_transactions(split_hash);
CREATE INDEX IF NOT EXISTS idx_split_transactions_reference_id ON split_payments.split_transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_split_transactions_created_at ON split_payments.split_transactions(created_at);

-- Create split_escrow_accounts table
CREATE TABLE IF NOT EXISTS split_payments.split_escrow_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consortium_id UUID NOT NULL,
    account_number VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    account_details JSONB NOT NULL,
    balance DECIMAL(20, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

-- Create indexes for split_escrow_accounts
CREATE INDEX IF NOT EXISTS idx_split_escrow_accounts_consortium_id ON split_payments.split_escrow_accounts(consortium_id);
CREATE INDEX IF NOT EXISTS idx_split_escrow_accounts_account_number ON split_payments.split_escrow_accounts(account_number);

-- Create tax_rate_cache table
CREATE TABLE IF NOT EXISTS split_payments.tax_rate_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_type VARCHAR(20) NOT NULL,
    state_code VARCHAR(2),
    municipality_code VARCHAR(100),
    rate DECIMAL(10, 6) NOT NULL,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_to TIMESTAMP WITH TIME ZONE NOT NULL,
    source VARCHAR(255),
    reference VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for tax_rate_cache
CREATE INDEX IF NOT EXISTS idx_tax_rate_cache_tax_type ON split_payments.tax_rate_cache(tax_type);
CREATE INDEX IF NOT EXISTS idx_tax_rate_cache_state_code ON split_payments.tax_rate_cache(state_code);
CREATE INDEX IF NOT EXISTS idx_tax_rate_cache_valid_from ON split_payments.tax_rate_cache(valid_from);
CREATE INDEX IF NOT EXISTS idx_tax_rate_cache_valid_to ON split_payments.tax_rate_cache(valid_to);

-- Create split_audit_logs table
CREATE TABLE IF NOT EXISTS split_payments.split_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID,
    consortium_id UUID,
    action VARCHAR(100) NOT NULL,
    before_data JSONB,
    after_data JSONB,
    metadata JSONB,
    status VARCHAR(50),
    error_message VARCHAR(255),
    created_by VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for split_audit_logs
CREATE INDEX IF NOT EXISTS idx_split_audit_logs_transaction_id ON split_payments.split_audit_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_split_audit_logs_action ON split_payments.split_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_split_audit_logs_created_at ON split_payments.split_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_split_audit_logs_created_by ON split_payments.split_audit_logs(created_by);

-- Create update triggers for updated_at fields
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to tables
DROP TRIGGER IF EXISTS update_split_transactions_updated_at ON split_payments.split_transactions;
CREATE TRIGGER update_split_transactions_updated_at
    BEFORE UPDATE ON split_payments.split_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_split_escrow_accounts_updated_at ON split_payments.split_escrow_accounts;
CREATE TRIGGER update_split_escrow_accounts_updated_at
    BEFORE UPDATE ON split_payments.split_escrow_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tax_rate_cache_updated_at ON split_payments.tax_rate_cache;
CREATE TRIGGER update_tax_rate_cache_updated_at
    BEFORE UPDATE ON split_payments.tax_rate_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create initial tax rates (example data)
INSERT INTO split_payments.tax_rate_cache (
    tax_type, state_code, rate, valid_from, valid_to, source, reference
) VALUES (
    'CBS', NULL, 0.01, NOW(), NOW() + INTERVAL '1 year', 'BACEN', 'Reforma Tributaria 2024'
) ON CONFLICT DO NOTHING;

-- Insert example IBS rates for all states
INSERT INTO split_payments.tax_rate_cache (
    tax_type, state_code, rate, valid_from, valid_to, source, reference
) VALUES (
    'IBS', 'AC', 0.02, NOW(), NOW() + INTERVAL '1 year', 'BACEN', 'Reforma Tributaria 2024'
) ON CONFLICT DO NOTHING;

INSERT INTO split_payments.tax_rate_cache (
    tax_type, state_code, rate, valid_from, valid_to, source, reference
) VALUES (
    'IBS', 'AL', 0.02, NOW(), NOW() + INTERVAL '1 year', 'BACEN', 'Reforma Tributaria 2024'
) ON CONFLICT DO NOTHING;

INSERT INTO split_payments.tax_rate_cache (
    tax_type, state_code, rate, valid_from, valid_to, source, reference
) VALUES (
    'IBS', 'AP', 0.02, NOW(), NOW() + INTERVAL '1 year', 'BACEN', 'Reforma Tributaria 2024'
) ON CONFLICT DO NOTHING;

INSERT INTO split_payments.tax_rate_cache (
    tax_type, state_code, rate, valid_from, valid_to, source, reference
) VALUES (
    'IBS', 'AM', 0.02, NOW(), NOW() + INTERVAL '1 year', 'BACEN', 'Reforma Tributaria 2024'
) ON CONFLICT DO NOTHING;

INSERT INTO split_payments.tax_rate_cache (
    tax_type, state_code, rate, valid_from, valid_to, source, reference
) VALUES (
    'IBS', 'BA', 0.02, NOW(), NOW() + INTERVAL '1 year', 'BACEN', 'Reforma Tributaria 2024'
) ON CONFLICT DO NOTHING;

-- Add more states as needed...

-- Grant permissions (if needed)
-- GRANT ALL PRIVILEGES ON SCHEMA split_payments TO split_user;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA split_payments TO split_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA split_payments TO split_user;

-- Log completion
RAISE NOTICE 'Split Payment Service database initialization completed!';
