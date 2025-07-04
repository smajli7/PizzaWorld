-- =====================================================
-- STORE CAPACITY V3 MATERIALIZED VIEWS FOR SUPABASE
-- =====================================================
-- Purpose: Store capacity, utilization, and delivery distance analysis
-- Compatible with Supabase SQL editor
-- =====================================================

-- Drop existing views if they exist
DROP MATERIALIZED VIEW IF EXISTS store_capacity_summary_v3 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS delivery_metrics_v3 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS customer_distance_analysis_v3 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS store_peak_hours_v3 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS store_capacity_metrics_v3 CASCADE;

-- =====================================================
-- 1. STORE CAPACITY METRICS V3 - Base capacity analysis
-- =====================================================
CREATE MATERIALIZED VIEW store_capacity_metrics_v3 AS
WITH hourly_orders AS (
    SELECT 
        s.storeid,
        s.city,
        s.state_abbr,
        s.latitude,
        s.longitude,
        EXTRACT(HOUR FROM o.orderdate) as hour_of_day,
        EXTRACT(YEAR FROM o.orderdate) as year,
        EXTRACT(MONTH FROM o.orderdate) as month,
        COUNT(DISTINCT o.orderid) as order_count,
        COUNT(DISTINCT o.customerid) as unique_customers,
        SUM(o.total) as revenue,
        AVG(o.total) as avg_order_value
    FROM stores s
    LEFT JOIN orders o ON s.storeid = o.storeid
    GROUP BY s.storeid, s.city, s.state_abbr, s.latitude, s.longitude,
             EXTRACT(HOUR FROM o.orderdate), 
             EXTRACT(YEAR FROM o.orderdate),
             EXTRACT(MONTH FROM o.orderdate)
),
capacity_baseline AS (
    SELECT 
        storeid,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY order_count)::NUMERIC as peak_capacity_95th,
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY order_count)::NUMERIC as peak_capacity_90th,
        MAX(order_count) as absolute_peak,
        AVG(order_count)::NUMERIC as avg_hourly_orders
    FROM hourly_orders
    GROUP BY storeid
)
SELECT 
    ho.storeid,
    ho.city,
    ho.state_abbr,
    ho.latitude,
    ho.longitude,
    ho.year,
    ho.month,
    ho.hour_of_day,
    ho.order_count,
    ho.unique_customers,
    ho.revenue,
    ho.avg_order_value,
    cb.peak_capacity_90th as store_capacity,
    CASE 
        WHEN cb.peak_capacity_90th > 0 THEN 
            ROUND((ho.order_count::NUMERIC / cb.peak_capacity_90th::NUMERIC) * 100, 2)
        ELSE 0 
    END as utilization_percentage,
    CASE 
        WHEN ho.order_count >= cb.peak_capacity_90th THEN 'Over Capacity'
        WHEN ho.order_count >= cb.peak_capacity_90th * 0.8 THEN 'High Utilization'
        WHEN ho.order_count >= cb.peak_capacity_90th * 0.5 THEN 'Moderate Utilization'
        ELSE 'Low Utilization'
    END as utilization_status
FROM hourly_orders ho
JOIN capacity_baseline cb ON ho.storeid = cb.storeid;

-- Create indexes
CREATE INDEX idx_store_capacity_v3_store ON store_capacity_metrics_v3(storeid);
CREATE INDEX idx_store_capacity_v3_state ON store_capacity_metrics_v3(state_abbr);
CREATE INDEX idx_store_capacity_v3_time ON store_capacity_metrics_v3(year, month, hour_of_day);
CREATE INDEX idx_store_capacity_v3_utilization ON store_capacity_metrics_v3(utilization_percentage);

-- =====================================================
-- 2. PEAK HOURS ANALYSIS V3
-- =====================================================
CREATE MATERIALIZED VIEW store_peak_hours_v3 AS
WITH hourly_stats AS (
    SELECT 
        storeid,
        state_abbr,
        hour_of_day,
        AVG(order_count)::NUMERIC as avg_orders,
        AVG(revenue)::NUMERIC as avg_revenue,
        AVG(utilization_percentage)::NUMERIC as avg_utilization,
        COUNT(*) as sample_days
    FROM store_capacity_metrics_v3
    GROUP BY storeid, state_abbr, hour_of_day
),
ranked_hours AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (PARTITION BY storeid ORDER BY avg_orders DESC) as hour_rank
    FROM hourly_stats
)
SELECT 
    storeid,
    state_abbr,
    hour_of_day,
    avg_orders,
    avg_revenue,
    avg_utilization,
    hour_rank,
    CASE 
        WHEN hour_rank <= 3 THEN 'Peak Hour'
        WHEN hour_rank <= 6 THEN 'High Traffic'
        WHEN avg_orders > 0 THEN 'Normal Traffic'
        ELSE 'Closed/No Data'
    END as traffic_category
FROM ranked_hours
ORDER BY storeid, hour_rank;

-- Create indexes
CREATE INDEX idx_peak_hours_v3_store ON store_peak_hours_v3(storeid);
CREATE INDEX idx_peak_hours_v3_state ON store_peak_hours_v3(state_abbr);
CREATE INDEX idx_peak_hours_v3_rank ON store_peak_hours_v3(hour_rank);

-- =====================================================
-- 3. CUSTOMER DISTANCE ANALYSIS V3
-- =====================================================
CREATE MATERIALIZED VIEW customer_distance_analysis_v3 AS
WITH customer_locations AS (
    SELECT DISTINCT
        o.customerid,
        o.storeid,
        s.latitude as store_lat,
        s.longitude as store_lon,
        s.state_abbr,
        c.latitude as customer_lat,
        c.longitude as customer_lon,
        COUNT(o.orderid) as order_count,
        SUM(o.total) as total_spent
    FROM orders o
    JOIN stores s ON o.storeid = s.storeid
    JOIN customers c ON o.customerid = c.customerid
    WHERE c.latitude IS NOT NULL 
    AND c.longitude IS NOT NULL
    GROUP BY o.customerid, o.storeid, s.latitude, s.longitude, s.state_abbr, c.latitude, c.longitude
)
SELECT 
    cl.storeid,
    cl.state_abbr,
    cl.customerid,
    cl.order_count,
    cl.total_spent,
    -- Haversine formula for distance calculation in miles with bounds checking
    CASE 
        WHEN cl.store_lat = cl.customer_lat AND cl.store_lon = cl.customer_lon THEN 0
        ELSE 3959 * acos(
            LEAST(1.0, GREATEST(-1.0,
                cos(radians(cl.store_lat)) * cos(radians(cl.customer_lat)) * 
                cos(radians(cl.customer_lon) - radians(cl.store_lon)) + 
                sin(radians(cl.store_lat)) * sin(radians(cl.customer_lat))
            ))
        )
    END as distance_miles,
    CASE 
        WHEN cl.store_lat = cl.customer_lat AND cl.store_lon = cl.customer_lon THEN '0-2 miles'
        WHEN 3959 * acos(
            LEAST(1.0, GREATEST(-1.0,
                cos(radians(cl.store_lat)) * cos(radians(cl.customer_lat)) * 
                cos(radians(cl.customer_lon) - radians(cl.store_lon)) + 
                sin(radians(cl.store_lat)) * sin(radians(cl.customer_lat))
            ))
        ) <= 2 THEN '0-2 miles'
        WHEN 3959 * acos(
            LEAST(1.0, GREATEST(-1.0,
                cos(radians(cl.store_lat)) * cos(radians(cl.customer_lat)) * 
                cos(radians(cl.customer_lon) - radians(cl.store_lon)) + 
                sin(radians(cl.store_lat)) * sin(radians(cl.customer_lat))
            ))
        ) <= 5 THEN '2-5 miles'
        WHEN 3959 * acos(
            LEAST(1.0, GREATEST(-1.0,
                cos(radians(cl.store_lat)) * cos(radians(cl.customer_lat)) * 
                cos(radians(cl.customer_lon) - radians(cl.store_lon)) + 
                sin(radians(cl.store_lat)) * sin(radians(cl.customer_lat))
            ))
        ) <= 10 THEN '5-10 miles'
        ELSE '10+ miles'
    END as distance_category
FROM customer_locations cl;

-- Create indexes
CREATE INDEX idx_customer_distance_v3_store ON customer_distance_analysis_v3(storeid);
CREATE INDEX idx_customer_distance_v3_state ON customer_distance_analysis_v3(state_abbr);
CREATE INDEX idx_customer_distance_v3_distance ON customer_distance_analysis_v3(distance_miles);
CREATE INDEX idx_customer_distance_v3_category ON customer_distance_analysis_v3(distance_category);

-- =====================================================
-- 4. DELIVERY METRICS V3
-- =====================================================
CREATE MATERIALIZED VIEW delivery_metrics_v3 AS
WITH daily_deliveries AS (
    SELECT 
        cd.storeid,
        cd.state_abbr,
        DATE(o.orderdate) as delivery_date,
        EXTRACT(YEAR FROM o.orderdate) as year,
        EXTRACT(MONTH FROM o.orderdate) as month,
        COUNT(DISTINCT o.orderid) as delivery_count,
        -- Round trip distance (to customer and back)
        SUM(cd.distance_miles * 2) as total_miles_driven,
        -- Assuming average speed of 25 mph in city
        SUM(cd.distance_miles * 2 / 25.0 * 60) as total_minutes_driven,
        AVG(cd.distance_miles) as avg_delivery_distance,
        MAX(cd.distance_miles) as max_delivery_distance
    FROM customer_distance_analysis_v3 cd
    JOIN orders o ON cd.customerid = o.customerid AND cd.storeid = o.storeid
    GROUP BY cd.storeid, cd.state_abbr, DATE(o.orderdate), 
             EXTRACT(YEAR FROM o.orderdate), EXTRACT(MONTH FROM o.orderdate)
)
SELECT 
    storeid,
    state_abbr,
    delivery_date,
    year,
    month,
    delivery_count,
    total_miles_driven,
    total_minutes_driven,
    ROUND(total_minutes_driven::NUMERIC / 60.0, 2) as total_hours_driven,
    avg_delivery_distance,
    max_delivery_distance,
    ROUND(total_miles_driven::NUMERIC / NULLIF(delivery_count, 0)::NUMERIC, 2) as miles_per_delivery,
    -- Assuming $0.65 per mile for delivery cost
    ROUND(total_miles_driven::NUMERIC * 0.65, 2) as estimated_delivery_cost
FROM daily_deliveries;

-- Create indexes
CREATE INDEX idx_delivery_metrics_v3_store ON delivery_metrics_v3(storeid);
CREATE INDEX idx_delivery_metrics_v3_state ON delivery_metrics_v3(state_abbr);
CREATE INDEX idx_delivery_metrics_v3_date ON delivery_metrics_v3(delivery_date);
CREATE INDEX idx_delivery_metrics_v3_time ON delivery_metrics_v3(year, month);

-- =====================================================
-- 5. STORE CAPACITY SUMMARY V3
-- =====================================================
CREATE MATERIALIZED VIEW store_capacity_summary_v3 AS
WITH utilization_stats AS (
    SELECT 
        storeid,
        state_abbr,
        AVG(utilization_percentage)::NUMERIC as avg_utilization,
        MAX(utilization_percentage)::NUMERIC as peak_utilization,
        COUNT(CASE WHEN utilization_status = 'Over Capacity' THEN 1 END) as over_capacity_hours,
        COUNT(CASE WHEN utilization_status = 'High Utilization' THEN 1 END) as high_utilization_hours
    FROM store_capacity_metrics_v3
    GROUP BY storeid, state_abbr
),
distance_stats AS (
    SELECT 
        storeid,
        COUNT(DISTINCT customerid) as total_customers,
        AVG(distance_miles)::NUMERIC as avg_customer_distance,
        COUNT(CASE WHEN distance_category = '0-2 miles' THEN 1 END) as customers_0_2_miles,
        COUNT(CASE WHEN distance_category = '2-5 miles' THEN 1 END) as customers_2_5_miles,
        COUNT(CASE WHEN distance_category = '5-10 miles' THEN 1 END) as customers_5_10_miles,
        COUNT(CASE WHEN distance_category = '10+ miles' THEN 1 END) as customers_10_plus_miles
    FROM customer_distance_analysis_v3
    GROUP BY storeid
),
delivery_stats AS (
    SELECT 
        storeid,
        AVG(total_miles_driven)::NUMERIC as avg_daily_miles,
        AVG(total_hours_driven)::NUMERIC as avg_daily_hours,
        AVG(miles_per_delivery)::NUMERIC as avg_miles_per_delivery,
        SUM(estimated_delivery_cost)::NUMERIC as total_delivery_cost
    FROM delivery_metrics_v3
    GROUP BY storeid
)
SELECT 
    s.storeid,
    s.city,
    s.state_abbr,
    s.latitude,
    s.longitude,
    COALESCE(us.avg_utilization, 0) as avg_utilization,
    COALESCE(us.peak_utilization, 0) as peak_utilization,
    COALESCE(us.over_capacity_hours, 0) as over_capacity_hours,
    COALESCE(us.high_utilization_hours, 0) as high_utilization_hours,
    COALESCE(ds.total_customers, 0) as total_customers,
    COALESCE(ds.avg_customer_distance, 0) as avg_customer_distance,
    COALESCE(ds.customers_0_2_miles, 0) as customers_0_2_miles,
    COALESCE(ds.customers_2_5_miles, 0) as customers_2_5_miles,
    COALESCE(ds.customers_5_10_miles, 0) as customers_5_10_miles,
    COALESCE(ds.customers_10_plus_miles, 0) as customers_10_plus_miles,
    COALESCE(del.avg_daily_miles, 0) as avg_daily_miles,
    COALESCE(del.avg_daily_hours, 0) as avg_daily_hours,
    COALESCE(del.avg_miles_per_delivery, 0) as avg_miles_per_delivery,
    COALESCE(del.total_delivery_cost, 0) as total_delivery_cost
FROM stores s
LEFT JOIN utilization_stats us ON s.storeid = us.storeid
LEFT JOIN distance_stats ds ON s.storeid = ds.storeid
LEFT JOIN delivery_stats del ON s.storeid = del.storeid;

-- Create indexes
CREATE INDEX idx_capacity_summary_v3_store ON store_capacity_summary_v3(storeid);
CREATE INDEX idx_capacity_summary_v3_state ON store_capacity_summary_v3(state_abbr);
CREATE INDEX idx_capacity_summary_v3_utilization ON store_capacity_summary_v3(avg_utilization);

-- =====================================================
-- REFRESH ALL VIEWS (Run this periodically)
-- =====================================================
-- REFRESH MATERIALIZED VIEW CONCURRENTLY store_capacity_metrics_v3;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY store_peak_hours_v3;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY customer_distance_analysis_v3;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY delivery_metrics_v3;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY store_capacity_summary_v3; 