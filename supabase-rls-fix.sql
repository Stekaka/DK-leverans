-- FILÅTKOMST OCH PRENUMERATIONER: Tidsbegränsad access och permanent köp
-- FIXED VERSION - Fixar tvetydiga kolumnreferenser

-- Fixa check_customer_access funktionen med explicit kolumnreferenser
CREATE OR REPLACE FUNCTION check_customer_access(customer_uuid UUID)
RETURNS TABLE(
    has_access BOOLEAN,
    access_type VARCHAR(20),
    expires_at TIMESTAMP WITH TIME ZONE,
    days_remaining INTEGER,
    storage_used_gb DECIMAL(10,2),
    storage_limit_gb INTEGER
) AS $$
DECLARE
    customer_record customers%ROWTYPE;
    permanent_purchase permanent_access_purchases%ROWTYPE;
BEGIN
    SELECT * INTO customer_record FROM customers WHERE id = customer_uuid;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'not_found'::VARCHAR(20), NULL::TIMESTAMP WITH TIME ZONE, 0, 0.0, 0;
        RETURN;
    END IF;
    
    -- Explicit kolumnreferenser för att undvika tvetydighet
    SELECT * INTO permanent_purchase 
    FROM permanent_access_purchases 
    WHERE customer_id = customer_uuid 
    AND status = 'active' 
    AND (permanent_access_purchases.expires_at IS NULL OR permanent_access_purchases.expires_at > NOW())
    ORDER BY permanent_access_purchases.expires_at DESC NULLS FIRST
    LIMIT 1;
    
    IF FOUND THEN
        RETURN QUERY SELECT 
            TRUE,
            'permanent'::VARCHAR(20),
            permanent_purchase.expires_at,
            CASE 
                WHEN permanent_purchase.expires_at IS NULL THEN 999999
                ELSE EXTRACT(DAYS FROM permanent_purchase.expires_at - NOW())::INTEGER
            END,
            (customer_record.total_storage_used / 1024.0 / 1024.0 / 1024.0)::DECIMAL(10,2),
            permanent_purchase.storage_limit_gb;
        RETURN;
    END IF;
    
    IF customer_record.access_expires_at IS NULL THEN
        RETURN QUERY SELECT TRUE, 'active'::VARCHAR(20), NULL::TIMESTAMP WITH TIME ZONE, 30, 0.0, 0;
        RETURN;
    END IF;
    
    IF customer_record.access_expires_at > NOW() THEN
        RETURN QUERY SELECT 
            TRUE,
            'active'::VARCHAR(20),
            customer_record.access_expires_at,
            EXTRACT(DAYS FROM customer_record.access_expires_at - NOW())::INTEGER,
            (customer_record.total_storage_used / 1024.0 / 1024.0 / 1024.0)::DECIMAL(10,2),
            0;
        RETURN;
    ELSE
        RETURN QUERY SELECT 
            FALSE,
            'expired'::VARCHAR(20),
            customer_record.access_expires_at,
            0,
            (customer_record.total_storage_used / 1024.0 / 1024.0 / 1024.0)::DECIMAL(10,2),
            0;
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql;
