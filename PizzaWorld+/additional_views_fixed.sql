-- ============================================================
-- ADDITIONAL MATERIALIZED VIEWS FOR PIZZAWORLD OPTIMIZATION
-- ============================================================
-- FIXED VERSION - All ambiguous column references resolved

-- ============================================================
-- 1. STORE PERFORMANCE COMPARISON VIEWS
-- ============================================================

-- HQ Admin: All store performance metrics
CREATE MATERIALIZED VIEW store_performance_hq AS
SELECT 
    s.storeid,
    s.city,
    s.state as state_name,
    s.state_abbr,
    COALESCE(SUM(o.total), 0) as total_revenue,
    COALESCE(COUNT(o.orderid), 0) as total_orders,
    COALESCE(COUNT(DISTINCT o.customerid), 0) as unique_customers,
    COALESCE(AVG(o.total), 0) as avg_order_value,
    COALESCE(MAX(o.orderdate), '1900-01-01'::date) as last_order_date
FROM stores s
LEFT JOIN orders o ON s.storeid = o.storeid
GROUP BY s.storeid, s.city, s.state, s.state_abbr
ORDER BY total_revenue DESC;

-- State Manager: Performance for stores in their state
CREATE MATERIALIZED VIEW store_performance_state AS
SELECT 
    s.state_abbr,
    s.storeid,
    s.city,
    s.state as state_name,
    COALESCE(SUM(o.total), 0) as total_revenue,
    COALESCE(COUNT(o.orderid), 0) as total_orders,
    COALESCE(COUNT(DISTINCT o.customerid), 0) as unique_customers,
    COALESCE(AVG(o.total), 0) as avg_order_value,
    COALESCE(MAX(o.orderdate), '1900-01-01'::date) as last_order_date
FROM stores s
LEFT JOIN orders o ON s.storeid = o.storeid
GROUP BY s.state_abbr, s.storeid, s.city, s.state
ORDER BY s.state_abbr, total_revenue DESC;

-- ============================================================
-- 2. PRODUCT PERFORMANCE VIEWS  
-- ============================================================

-- HQ Admin: Top products across all stores
CREATE MATERIALIZED VIEW top_products_hq AS
SELECT 
    p.sku,
    p.name,
    p.category,
    p.size,
    p.price,
    SUM(oi.quantity) as total_quantity,
    SUM(oi.quantity * p.price) as total_revenue,
    COUNT(DISTINCT oi.orderid) as total_orders,
    COUNT(DISTINCT o.customerid) as unique_customers
FROM products p
JOIN order_items oi ON p.sku = oi.sku
JOIN orders o ON oi.orderid = o.orderid
GROUP BY p.sku, p.name, p.category, p.size, p.price
ORDER BY total_revenue DESC;

-- State Manager: Top products in their state
CREATE MATERIALIZED VIEW top_products_state AS
SELECT 
    s.state_abbr as state,
    p.sku,
    p.name,
    p.category,
    p.size,
    p.price,
    SUM(oi.quantity) as total_quantity,
    SUM(oi.quantity * p.price) as total_revenue,
    COUNT(DISTINCT oi.orderid) as total_orders,
    COUNT(DISTINCT o.customerid) as unique_customers
FROM products p
JOIN order_items oi ON p.sku = oi.sku
JOIN orders o ON oi.orderid = o.orderid
JOIN stores s ON o.storeid = s.storeid
GROUP BY s.state_abbr, p.sku, p.name, p.category, p.size, p.price
ORDER BY s.state_abbr, total_revenue DESC;

-- Store Manager: Top products in their store
CREATE MATERIALIZED VIEW top_products_store AS
SELECT 
    s.state_abbr as state,
    s.storeid as store_id,
    p.sku,
    p.name,
    p.category,
    p.size,
    p.price,
    SUM(oi.quantity) as total_quantity,
    SUM(oi.quantity * p.price) as total_revenue,
    COUNT(DISTINCT oi.orderid) as total_orders,
    COUNT(DISTINCT o.customerid) as unique_customers
FROM products p
JOIN order_items oi ON p.sku = oi.sku
JOIN orders o ON oi.orderid = o.orderid
JOIN stores s ON o.storeid = s.storeid
GROUP BY s.state_abbr, s.storeid, p.sku, p.name, p.category, p.size, p.price
ORDER BY s.state_abbr, s.storeid, total_revenue DESC;

-- ============================================================
-- 3. CUSTOMER ANALYTICS VIEWS
-- ============================================================

-- HQ Admin: Customer acquisition trends
CREATE MATERIALIZED VIEW customer_acquisition_hq AS
SELECT 
    EXTRACT(YEAR FROM first_order.orderdate) as year,
    EXTRACT(MONTH FROM first_order.orderdate) as month,
    TO_CHAR(first_order.orderdate, 'Month') as month_name,
    COUNT(DISTINCT first_order.customerid) as new_customers,
    SUM(first_order.total) as revenue_from_new_customers
FROM (
    SELECT 
        customerid,
        MIN(orderdate) as orderdate,
        total
    FROM orders
    GROUP BY customerid, total
) first_order
GROUP BY EXTRACT(YEAR FROM first_order.orderdate), EXTRACT(MONTH FROM first_order.orderdate), TO_CHAR(first_order.orderdate, 'Month')
ORDER BY year DESC, month DESC;

-- State Manager: Customer acquisition by state
CREATE MATERIALIZED VIEW customer_acquisition_state AS
SELECT 
    s.state_abbr as state,
    EXTRACT(YEAR FROM first_order.orderdate) as year,
    EXTRACT(MONTH FROM first_order.orderdate) as month,
    TO_CHAR(first_order.orderdate, 'Month') as month_name,
    COUNT(DISTINCT first_order.customerid) as new_customers,
    SUM(first_order.total) as revenue_from_new_customers
FROM (
    SELECT 
        o.customerid,
        MIN(o.orderdate) as orderdate,
        o.total,
        o.storeid
    FROM orders o
    GROUP BY o.customerid, o.total, o.storeid
) first_order
JOIN stores s ON first_order.storeid = s.storeid
GROUP BY s.state_abbr, EXTRACT(YEAR FROM first_order.orderdate), EXTRACT(MONTH FROM first_order.orderdate), TO_CHAR(first_order.orderdate, 'Month')
ORDER BY s.state_abbr, year DESC, month DESC;

-- ============================================================
-- 4. CATEGORY PERFORMANCE VIEWS
-- ============================================================

-- HQ Admin: Category performance across all stores
CREATE MATERIALIZED VIEW category_performance_hq AS
SELECT 
    p.category,
    SUM(oi.quantity * p.price) as total_revenue,
    SUM(oi.quantity) as units_sold,
    COUNT(DISTINCT oi.orderid) as total_orders,
    COUNT(DISTINCT o.customerid) as unique_customers,
    AVG(oi.quantity * p.price) as avg_order_value
FROM order_items oi
JOIN orders o ON oi.orderid = o.orderid
JOIN products p ON oi.sku = p.sku
GROUP BY p.category
ORDER BY total_revenue DESC;

-- State Manager: Category performance by state
CREATE MATERIALIZED VIEW category_performance_state AS
SELECT 
    s.state_abbr as state,
    p.category,
    SUM(oi.quantity * p.price) as total_revenue,
    SUM(oi.quantity) as units_sold,
    COUNT(DISTINCT oi.orderid) as total_orders,
    COUNT(DISTINCT o.customerid) as unique_customers,
    AVG(oi.quantity * p.price) as avg_order_value
FROM order_items oi
JOIN orders o ON oi.orderid = o.orderid
JOIN products p ON oi.sku = p.sku
JOIN stores s ON o.storeid = s.storeid
GROUP BY s.state_abbr, p.category
ORDER BY s.state_abbr, total_revenue DESC;

-- Store Manager: Category performance by store
CREATE MATERIALIZED VIEW category_performance_store AS
SELECT 
    s.state_abbr as state,
    s.storeid as store_id,
    p.category,
    SUM(oi.quantity * p.price) as total_revenue,
    SUM(oi.quantity) as units_sold,
    COUNT(DISTINCT oi.orderid) as total_orders,
    COUNT(DISTINCT o.customerid) as unique_customers,
    AVG(oi.quantity * p.price) as avg_order_value
FROM order_items oi
JOIN orders o ON oi.orderid = o.orderid
JOIN products p ON oi.sku = p.sku
JOIN stores s ON o.storeid = s.storeid
GROUP BY s.state_abbr, s.storeid, p.category
ORDER BY s.state_abbr, s.storeid, total_revenue DESC;

-- ============================================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================================

-- Indexes for the new materialized views
CREATE UNIQUE INDEX idx_store_performance_hq_storeid ON store_performance_hq(storeid);
CREATE UNIQUE INDEX idx_store_performance_state_key ON store_performance_state(state_abbr, storeid);

CREATE UNIQUE INDEX idx_top_products_hq_sku ON top_products_hq(sku);
CREATE UNIQUE INDEX idx_top_products_state_key ON top_products_state(state, sku);
CREATE UNIQUE INDEX idx_top_products_store_key ON top_products_store(state, store_id, sku);

CREATE UNIQUE INDEX idx_customer_acq_hq_key ON customer_acquisition_hq(year, month);
CREATE UNIQUE INDEX idx_customer_acq_state_key ON customer_acquisition_state(state, year, month);

CREATE UNIQUE INDEX idx_category_perf_hq_category ON category_performance_hq(category);
CREATE UNIQUE INDEX idx_category_perf_state_key ON category_performance_state(state, category);
CREATE UNIQUE INDEX idx_category_perf_store_key ON category_performance_store(state, store_id, category);

-- ============================================================
-- 6. REFRESH SCRIPT FOR ALL VIEWS
-- ============================================================

-- Run this script hourly via Supabase scheduled functions
/*
REFRESH MATERIALIZED VIEW CONCURRENTLY kpis_global_hq;
REFRESH MATERIALIZED VIEW CONCURRENTLY kpis_global_state;
REFRESH MATERIALIZED VIEW CONCURRENTLY kpis_global_store;

REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_by_year_hq;
REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_by_year_state;
REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_by_year_store;

REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_by_month_hq;
REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_by_month_state;
REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_by_month_store;

REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_by_week_hq;
REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_by_week_state;
REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_by_week_store;

REFRESH MATERIALIZED VIEW CONCURRENTLY orders_by_month_hq;
REFRESH MATERIALIZED VIEW CONCURRENTLY orders_by_month_state;
REFRESH MATERIALIZED VIEW CONCURRENTLY orders_by_month_store;

REFRESH MATERIALIZED VIEW CONCURRENTLY recent_orders_hq;
REFRESH MATERIALIZED VIEW CONCURRENTLY recent_orders_state;
REFRESH MATERIALIZED VIEW CONCURRENTLY recent_orders_store;

REFRESH MATERIALIZED VIEW CONCURRENTLY store_performance_hq;
REFRESH MATERIALIZED VIEW CONCURRENTLY store_performance_state;

REFRESH MATERIALIZED VIEW CONCURRENTLY top_products_hq;
REFRESH MATERIALIZED VIEW CONCURRENTLY top_products_state;
REFRESH MATERIALIZED VIEW CONCURRENTLY top_products_store;

REFRESH MATERIALIZED VIEW CONCURRENTLY customer_acquisition_hq;
REFRESH MATERIALIZED VIEW CONCURRENTLY customer_acquisition_state;

REFRESH MATERIALIZED VIEW CONCURRENTLY category_performance_hq;
REFRESH MATERIALIZED VIEW CONCURRENTLY category_performance_state;
REFRESH MATERIALIZED VIEW CONCURRENTLY category_performance_store;
*/