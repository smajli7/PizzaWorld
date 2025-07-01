package pizzaworld.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pizzaworld.model.User;

@Repository
public interface OptimizedPizzaRepo extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    // =================================================================
    // DASHBOARD KPI QUERIES - Using Materialized Views
    // =================================================================

    @Query(value = "SELECT * FROM kpis_global_hq", nativeQuery = true)
    Map<String, Object> getHQKPIs();

    @Query(value = "SELECT * FROM kpis_global_state WHERE state = :state", nativeQuery = true)
    Map<String, Object> getStateKPIs(@Param("state") String state);

    @Query(value = "SELECT * FROM kpis_global_store WHERE store_id = :storeId", nativeQuery = true)
    Map<String, Object> getStoreKPIs(@Param("storeId") String storeId);

    @Query(value = "SELECT * FROM kpis_global_store ORDER BY state, store_id", nativeQuery = true)
    List<Map<String, Object>> getAllStoreKPIs();

    @Query(value = "SELECT * FROM kpis_global_store WHERE state = :state ORDER BY store_id", nativeQuery = true)
    List<Map<String, Object>> getStoreKPIsByState(@Param("state") String state);

    // =================================================================
    // REVENUE ANALYTICS - Using Materialized Views
    // =================================================================

    // Revenue by Year
    @Query(value = "SELECT * FROM revenue_by_year_hq ORDER BY year DESC", nativeQuery = true)
    List<Map<String, Object>> getRevenueByYearHQ();

    @Query(value = "SELECT * FROM revenue_by_year_state WHERE state = :state ORDER BY year DESC", nativeQuery = true)
    List<Map<String, Object>> getRevenueByYearState(@Param("state") String state);

    @Query(value = "SELECT * FROM revenue_by_year_store WHERE store_id = :storeId ORDER BY year DESC", nativeQuery = true)
    List<Map<String, Object>> getRevenueByYearStore(@Param("storeId") String storeId);

    // Revenue by Month
    @Query(value = "SELECT * FROM revenue_by_month_hq ORDER BY year DESC, month DESC LIMIT 12", nativeQuery = true)
    List<Map<String, Object>> getRevenueByMonthHQ();

    @Query(value = "SELECT * FROM revenue_by_month_state WHERE state = :state ORDER BY year DESC, month DESC LIMIT 12", nativeQuery = true)
    List<Map<String, Object>> getRevenueByMonthState(@Param("state") String state);

    @Query(value = "SELECT * FROM revenue_by_month_store WHERE store_id = :storeId ORDER BY year DESC, month DESC LIMIT 12", nativeQuery = true)
    List<Map<String, Object>> getRevenueByMonthStore(@Param("storeId") String storeId);

    // Revenue by Week
    @Query(value = "SELECT * FROM revenue_by_week_hq ORDER BY year_week DESC LIMIT 12", nativeQuery = true)
    List<Map<String, Object>> getRevenueByWeekHQ();

    @Query(value = "SELECT * FROM revenue_by_week_state WHERE state = :state ORDER BY year_week DESC LIMIT 12", nativeQuery = true)
    List<Map<String, Object>> getRevenueByWeekState(@Param("state") String state);

    @Query(value = "SELECT * FROM revenue_by_week_store WHERE store_id = :storeId ORDER BY year_week DESC LIMIT 12", nativeQuery = true)
    List<Map<String, Object>> getRevenueByWeekStore(@Param("storeId") String storeId);

    // =================================================================
    // ORDERS ANALYTICS - Using Materialized Views
    // =================================================================

    // Orders by Month
    @Query(value = "SELECT * FROM orders_by_month_hq ORDER BY year DESC, month DESC LIMIT 12", nativeQuery = true)
    List<Map<String, Object>> getOrdersByMonthHQ();

    @Query(value = "SELECT * FROM orders_by_month_state WHERE state = :state ORDER BY year DESC, month DESC LIMIT 12", nativeQuery = true)
    List<Map<String, Object>> getOrdersByMonthState(@Param("state") String state);

    @Query(value = "SELECT * FROM orders_by_month_store WHERE store_id = :storeId ORDER BY year DESC, month DESC LIMIT 12", nativeQuery = true)
    List<Map<String, Object>> getOrdersByMonthStore(@Param("storeId") String storeId);

    // =================================================================
    // RECENT ORDERS - Using Materialized Views
    // =================================================================

    @Query(value = "SELECT * FROM recent_orders_hq ORDER BY orderdate DESC LIMIT :maxRows", nativeQuery = true)
    List<Map<String, Object>> getRecentOrdersHQ(@Param("maxRows") int limit);

    @Query(value = "SELECT * FROM recent_orders_state WHERE state = :state ORDER BY orderdate DESC LIMIT :maxRows", nativeQuery = true)
    List<Map<String, Object>> getRecentOrdersState(@Param("state") String state, @Param("maxRows") int limit);

    @Query(value = "SELECT * FROM recent_orders_store WHERE store_id = :storeId ORDER BY orderdate DESC LIMIT :maxRows", nativeQuery = true)
    List<Map<String, Object>> getRecentOrdersStore(@Param("storeId") String storeId, @Param("maxRows") int limit);

    // =================================================================
    // ENRICHED DATA QUERIES - Using Helper Views
    // =================================================================

    // Using orders_flat for complex filters
    @Query(value = """
        SELECT * FROM orders_flat
        WHERE (:storeId IS NULL OR store_id = :storeId)
          AND (:state IS NULL OR state = :state)
          AND (:customerId IS NULL OR customerid = :customerId)
          AND (:fromDate IS NULL OR orderdate >= CAST(:fromDate AS DATE))
          AND (:toDate IS NULL OR orderdate <= CAST(:toDate AS DATE))
          AND (:orderId IS NULL OR orderid = :orderId)
          AND (:nitems IS NULL OR nitems = :nitems)
        ORDER BY orderdate DESC
        LIMIT :maxRows OFFSET :startRow
        """, nativeQuery = true)
    List<Map<String, Object>> getFilteredOrders(
        @Param("storeId") String storeId,
        @Param("state") String state,
        @Param("customerId") String customerId,
        @Param("fromDate") String fromDate,
        @Param("toDate") String toDate,
        @Param("orderId") Integer orderId,
        @Param("nitems") Integer nitems,
        @Param("maxRows") int limit,
        @Param("startRow") int offset);

    @Query(value = """
        SELECT COUNT(*) FROM orders_flat
        WHERE (:storeId IS NULL OR store_id = :storeId)
          AND (:state IS NULL OR state = :state)
          AND (:customerId IS NULL OR customerid = :customerId)
          AND (:fromDate IS NULL OR orderdate >= CAST(:fromDate AS DATE))
          AND (:toDate IS NULL OR orderdate <= CAST(:toDate AS DATE))
          AND (:orderId IS NULL OR orderid = :orderId)
          AND (:nitems IS NULL OR nitems = :nitems)
        """, nativeQuery = true)
    Long countFilteredOrders(
        @Param("storeId") String storeId,
        @Param("state") String state,
        @Param("customerId") String customerId,
        @Param("fromDate") String fromDate,
        @Param("toDate") String toDate,
        @Param("orderId") Integer orderId,
        @Param("nitems") Integer nitems);

    // =================================================================
    // PRODUCT ANALYTICS - Using order_items_enriched
    // =================================================================

    @Query(value = """
        SELECT 
            sku, name, category, size,
            SUM(quantity) as total_quantity,
            SUM(line_revenue) as total_revenue,
            COUNT(DISTINCT orderid) as total_orders
        FROM order_items_enriched
        WHERE (:storeId IS NULL OR store_id = :storeId)
          AND (:state IS NULL OR state = :state)
          AND (:category IS NULL OR category = :category)
        GROUP BY sku, name, category, size
        ORDER BY total_revenue DESC
        LIMIT :maxRows
        """, nativeQuery = true)
    List<Map<String, Object>> getTopProducts(
        @Param("storeId") String storeId,
        @Param("state") String state,
        @Param("category") String category,
        @Param("maxRows") int limit);

    // =================================================================
    // STORE UTILITIES
    // =================================================================

    @Query(value = "SELECT state_abbr FROM stores WHERE storeid = :storeId", nativeQuery = true)
    String getStoreState(@Param("storeId") String storeId);

    @Query(value = """
        SELECT storeid, city, state, zipcode, latitude, longitude
        FROM stores
        WHERE (:state IS NULL OR state_abbr = :state)
          AND (:storeId IS NULL OR storeid = :storeId)
        ORDER BY city
        """, nativeQuery = true)
    List<Map<String, Object>> getStores(
        @Param("state") String state,
        @Param("storeId") String storeId);

    // =================================================================
    // SALES DATE RANGE QUERIES (For specific date filtering)
    // =================================================================

    @Query(value = """
        SELECT 
            SUM(o.total) as revenue,
            COUNT(*) as total_orders,
            COUNT(DISTINCT o.customerid) as unique_customers,
            AVG(o.total) as avg_order
        FROM orders o
        JOIN stores s ON o.storeid = s.storeid
        WHERE o.orderdate BETWEEN :from AND :to
          AND (:state IS NULL OR s.state = :state)
          AND (:storeId IS NULL OR o.storeid = :storeId)
        """, nativeQuery = true)
    Map<String, Object> getSalesKPIsForDateRange(
        @Param("from") LocalDate from,
        @Param("to") LocalDate to,
        @Param("state") String state,
        @Param("storeId") String storeId);

    @Query(value = """
        SELECT 
            DATE(o.orderdate) as day,
            SUM(o.total) as revenue,
            COUNT(*) as orders,
            COUNT(DISTINCT o.customerid) as customers
        FROM orders o
        JOIN stores s ON o.storeid = s.storeid
        WHERE o.orderdate BETWEEN :from AND :to
          AND (:state IS NULL OR s.state = :state)
          AND (:storeId IS NULL OR o.storeid = :storeId)
        GROUP BY DATE(o.orderdate)
        ORDER BY day DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getSalesTrendForDateRange(
        @Param("from") LocalDate from,
        @Param("to") LocalDate to,
        @Param("state") String state,
        @Param("storeId") String storeId);

    // =================================================================
    // NEW MATERIALIZED VIEW QUERIES - Enhanced Analytics
    // =================================================================

    // Store Performance Views (using existing tables as fallback)
    @Query(value = """
        SELECT s.storeid, s.city, s.state as state_name, s.state_abbr,
               COALESCE(SUM(o.total), 0) as total_revenue,
               COALESCE(COUNT(o.orderid), 0) as total_orders,
               COALESCE(COUNT(DISTINCT o.customerid), 0) as unique_customers,
               COALESCE(AVG(o.total), 0) as avg_order_value
        FROM stores s
        LEFT JOIN orders o ON s.storeid = o.storeid
        GROUP BY s.storeid, s.city, s.state, s.state_abbr
        ORDER BY total_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getStorePerformanceHQ();

    @Query(value = """
        SELECT s.storeid, s.city, s.state as state_name, s.state_abbr,
               COALESCE(SUM(o.total), 0) as total_revenue,
               COALESCE(COUNT(o.orderid), 0) as total_orders,
               COALESCE(COUNT(DISTINCT o.customerid), 0) as unique_customers,
               COALESCE(AVG(o.total), 0) as avg_order_value
        FROM stores s
        LEFT JOIN orders o ON s.storeid = o.storeid
        WHERE s.state_abbr = :state
        GROUP BY s.storeid, s.city, s.state, s.state_abbr
        ORDER BY total_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getStorePerformanceState(@Param("state") String state);

    @Query(value = """
        SELECT s.storeid, s.city, s.state as state_name, s.state_abbr,
               COALESCE(SUM(o.total), 0) as total_revenue,
               COALESCE(COUNT(o.orderid), 0) as total_orders,
               COALESCE(COUNT(DISTINCT o.customerid), 0) as unique_customers,
               COALESCE(AVG(o.total), 0) as avg_order_value
        FROM stores s
        LEFT JOIN orders o ON s.storeid = o.storeid
        WHERE s.storeid = :storeId
        GROUP BY s.storeid, s.city, s.state, s.state_abbr
        """, nativeQuery = true)
    List<Map<String, Object>> getStorePerformance(@Param("storeId") String storeId);

    // Top Products Views (using existing tables as fallback)
    @Query(value = """
        SELECT p.sku, p.name, p.category, p.size, p.price,
               SUM(oi.quantity) as total_quantity,
               SUM(oi.quantity * p.price) as total_revenue,
               COUNT(DISTINCT oi.orderid) as total_orders,
               COUNT(DISTINCT o.customerid) as unique_customers
        FROM products p
        JOIN order_items oi ON p.sku = oi.sku
        JOIN orders o ON oi.orderid = o.orderid
        GROUP BY p.sku, p.name, p.category, p.size, p.price
        ORDER BY total_revenue DESC
        LIMIT :maxRows
        """, nativeQuery = true)
    List<Map<String, Object>> getTopProductsHQ(@Param("maxRows") int limit);

    @Query(value = """
        SELECT p.sku, p.name, p.category, p.size, p.price,
               SUM(oi.quantity) as total_quantity,
               SUM(oi.quantity * p.price) as total_revenue,
               COUNT(DISTINCT oi.orderid) as total_orders,
               COUNT(DISTINCT o.customerid) as unique_customers
        FROM products p
        JOIN order_items oi ON p.sku = oi.sku
        JOIN orders o ON oi.orderid = o.orderid
        JOIN stores s ON o.storeid = s.storeid
        WHERE s.state_abbr = :state
        GROUP BY p.sku, p.name, p.category, p.size, p.price
        ORDER BY total_revenue DESC
        LIMIT :maxRows
        """, nativeQuery = true)
    List<Map<String, Object>> getTopProductsState(@Param("state") String state, @Param("maxRows") int limit);

    @Query(value = """
        SELECT p.sku, p.name, p.category, p.size, p.price,
               SUM(oi.quantity) as total_quantity,
               SUM(oi.quantity * p.price) as total_revenue,
               COUNT(DISTINCT oi.orderid) as total_orders,
               COUNT(DISTINCT o.customerid) as unique_customers
        FROM products p
        JOIN order_items oi ON p.sku = oi.sku
        JOIN orders o ON oi.orderid = o.orderid
        WHERE o.storeid = :storeId
        GROUP BY p.sku, p.name, p.category, p.size, p.price
        ORDER BY total_revenue DESC
        LIMIT :maxRows
        """, nativeQuery = true)
    List<Map<String, Object>> getTopProductsStore(@Param("storeId") String storeId, @Param("maxRows") int limit);

    // Customer Acquisition Views (using existing tables as fallback)
    @Query(value = """
        SELECT EXTRACT(YEAR FROM first_order.orderdate) as year,
               EXTRACT(MONTH FROM first_order.orderdate) as month,
               TO_CHAR(first_order.orderdate, 'Month') as month_name,
               COUNT(DISTINCT first_order.customerid) as new_customers,
               SUM(first_order.total) as revenue_from_new_customers
        FROM (
            SELECT customerid, MIN(orderdate) as orderdate, total
            FROM orders
            GROUP BY customerid, total
        ) first_order
        GROUP BY EXTRACT(YEAR FROM first_order.orderdate), EXTRACT(MONTH FROM first_order.orderdate), TO_CHAR(first_order.orderdate, 'Month')
        ORDER BY year DESC, month DESC
        LIMIT 12
        """, nativeQuery = true)
    List<Map<String, Object>> getCustomerAcquisitionHQ();

    @Query(value = """
        SELECT s.state_abbr as state,
               EXTRACT(YEAR FROM first_order.orderdate) as year,
               EXTRACT(MONTH FROM first_order.orderdate) as month,
               TO_CHAR(first_order.orderdate, 'Month') as month_name,
               COUNT(DISTINCT first_order.customerid) as new_customers,
               SUM(first_order.total) as revenue_from_new_customers
        FROM (
            SELECT o.customerid, MIN(o.orderdate) as orderdate, o.total, o.storeid
            FROM orders o
            GROUP BY o.customerid, o.total, o.storeid
        ) first_order
        JOIN stores s ON first_order.storeid = s.storeid
        WHERE s.state_abbr = :state
        GROUP BY s.state_abbr, EXTRACT(YEAR FROM first_order.orderdate), EXTRACT(MONTH FROM first_order.orderdate), TO_CHAR(first_order.orderdate, 'Month')
        ORDER BY year DESC, month DESC
        LIMIT 12
        """, nativeQuery = true)
    List<Map<String, Object>> getCustomerAcquisitionState(@Param("state") String state);

    // Category Performance Views (using existing tables as fallback)
    @Query(value = """
        SELECT p.category,
               SUM(oi.quantity * p.price) as total_revenue,
               SUM(oi.quantity) as units_sold,
               COUNT(DISTINCT oi.orderid) as total_orders,
               COUNT(DISTINCT o.customerid) as unique_customers,
               AVG(oi.quantity * p.price) as avg_order_value
        FROM order_items oi
        JOIN orders o ON oi.orderid = o.orderid
        JOIN products p ON oi.sku = p.sku
        GROUP BY p.category
        ORDER BY total_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getCategoryPerformanceHQ();

    @Query(value = """
        SELECT p.category,
               SUM(oi.quantity * p.price) as total_revenue,
               SUM(oi.quantity) as units_sold,
               COUNT(DISTINCT oi.orderid) as total_orders,
               COUNT(DISTINCT o.customerid) as unique_customers,
               AVG(oi.quantity * p.price) as avg_order_value
        FROM order_items oi
        JOIN orders o ON oi.orderid = o.orderid
        JOIN products p ON oi.sku = p.sku
        JOIN stores s ON o.storeid = s.storeid
        WHERE s.state_abbr = :state
        GROUP BY p.category
        ORDER BY total_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getCategoryPerformanceState(@Param("state") String state);

    @Query(value = """
        SELECT p.category,
               SUM(oi.quantity * p.price) as total_revenue,
               SUM(oi.quantity) as units_sold,
               COUNT(DISTINCT oi.orderid) as total_orders,
               COUNT(DISTINCT o.customerid) as unique_customers,
               AVG(oi.quantity * p.price) as avg_order_value
        FROM order_items oi
        JOIN orders o ON oi.orderid = o.orderid
        JOIN products p ON oi.sku = p.sku
        WHERE o.storeid = :storeId
        GROUP BY p.category
        ORDER BY total_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getCategoryPerformanceStore(@Param("storeId") String storeId);

    // =================================================================
    // STORE REVENUE BY TIME PERIODS - New Dynamic Chart API
    // =================================================================

    // All Time Revenue (default view)
    @Query(value = "SELECT * FROM store_revenue_all_time ORDER BY total_revenue DESC", nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueAllTimeHQ();

    @Query(value = "SELECT * FROM store_revenue_all_time WHERE state_abbr = :state ORDER BY total_revenue DESC", nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueAllTimeState(@Param("state") String state);

    @Query(value = "SELECT * FROM store_revenue_all_time WHERE storeid = :storeId", nativeQuery = true)
    Map<String, Object> getStoreRevenueAllTimeStore(@Param("storeId") String storeId);

    // Monthly Revenue (for month-specific filtering) - using store_revenue_by_time_periods
    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, year, month, month_label, month_name_label,
               SUM(total_revenue) as monthly_revenue,
               SUM(order_count) as monthly_orders,
               AVG(avg_order_value) as monthly_avg_order_value,
               SUM(unique_customers) as monthly_unique_customers
        FROM store_revenue_by_time_periods 
        WHERE year = :year AND month = :month 
        GROUP BY storeid, city, state_name, state_abbr, year, month, month_label, month_name_label
        ORDER BY monthly_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueByMonthHQ(@Param("year") Integer year, @Param("month") Integer month);

    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, year, month, month_label, month_name_label,
               SUM(total_revenue) as monthly_revenue,
               SUM(order_count) as monthly_orders,
               AVG(avg_order_value) as monthly_avg_order_value,
               SUM(unique_customers) as monthly_unique_customers
        FROM store_revenue_by_time_periods 
        WHERE state_abbr = :state AND year = :year AND month = :month 
        GROUP BY storeid, city, state_name, state_abbr, year, month, month_label, month_name_label
        ORDER BY monthly_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueByMonthState(@Param("state") String state, @Param("year") Integer year, @Param("month") Integer month);

    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, year, month, month_label, month_name_label,
               SUM(total_revenue) as monthly_revenue,
               SUM(order_count) as monthly_orders,
               AVG(avg_order_value) as monthly_avg_order_value,
               SUM(unique_customers) as monthly_unique_customers
        FROM store_revenue_by_time_periods 
        WHERE storeid = :storeId AND year = :year AND month = :month 
        GROUP BY storeid, city, state_name, state_abbr, year, month, month_label, month_name_label
        """, nativeQuery = true)
    Map<String, Object> getStoreRevenueByMonthStore(@Param("storeId") String storeId, @Param("year") Integer year, @Param("month") Integer month);

    // Yearly Revenue (for year-specific filtering) - using store_revenue_by_time_periods
    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, year,
               SUM(total_revenue) as yearly_revenue,
               SUM(order_count) as yearly_orders,
               AVG(avg_order_value) as yearly_avg_order_value,
               SUM(unique_customers) as yearly_unique_customers
        FROM store_revenue_by_time_periods 
        WHERE year = :year 
        GROUP BY storeid, city, state_name, state_abbr, year
        ORDER BY yearly_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueByYearHQ(@Param("year") Integer year);

    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, year,
               SUM(total_revenue) as yearly_revenue,
               SUM(order_count) as yearly_orders,
               AVG(avg_order_value) as yearly_avg_order_value,
               SUM(unique_customers) as yearly_unique_customers
        FROM store_revenue_by_time_periods 
        WHERE state_abbr = :state AND year = :year 
        GROUP BY storeid, city, state_name, state_abbr, year
        ORDER BY yearly_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueByYearState(@Param("state") String state, @Param("year") Integer year);

    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, year,
               SUM(total_revenue) as yearly_revenue,
               SUM(order_count) as yearly_orders,
               AVG(avg_order_value) as yearly_avg_order_value,
               SUM(unique_customers) as yearly_unique_customers
        FROM store_revenue_by_time_periods 
        WHERE storeid = :storeId AND year = :year 
        GROUP BY storeid, city, state_name, state_abbr, year
        """, nativeQuery = true)
    Map<String, Object> getStoreRevenueByYearStore(@Param("storeId") String storeId, @Param("year") Integer year);

    // Quarter Revenue (for quarter-specific filtering)
    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, year, quarter, quarter_label,
               SUM(total_revenue) as quarterly_revenue,
               SUM(order_count) as quarterly_orders,
               AVG(avg_order_value) as quarterly_avg_order_value,
               SUM(unique_customers) as quarterly_unique_customers
        FROM store_revenue_by_time_periods 
        WHERE year = :year AND quarter = :quarter 
        GROUP BY storeid, city, state_name, state_abbr, year, quarter, quarter_label
        ORDER BY quarterly_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueByQuarterHQ(@Param("year") Integer year, @Param("quarter") Integer quarter);

    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, year, quarter, quarter_label,
               SUM(total_revenue) as quarterly_revenue,
               SUM(order_count) as quarterly_orders,
               AVG(avg_order_value) as quarterly_avg_order_value,
               SUM(unique_customers) as quarterly_unique_customers
        FROM store_revenue_by_time_periods 
        WHERE state_abbr = :state AND year = :year AND quarter = :quarter 
        GROUP BY storeid, city, state_name, state_abbr, year, quarter, quarter_label
        ORDER BY quarterly_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueByQuarterState(@Param("state") String state, @Param("year") Integer year, @Param("quarter") Integer quarter);

    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, year, quarter, quarter_label,
               SUM(total_revenue) as quarterly_revenue,
               SUM(order_count) as quarterly_orders,
               AVG(avg_order_value) as quarterly_avg_order_value,
               SUM(unique_customers) as quarterly_unique_customers
        FROM store_revenue_by_time_periods 
        WHERE storeid = :storeId AND year = :year AND quarter = :quarter 
        GROUP BY storeid, city, state_name, state_abbr, year, quarter, quarter_label
        """, nativeQuery = true)
    Map<String, Object> getStoreRevenueByQuarterStore(@Param("storeId") String storeId, @Param("year") Integer year, @Param("quarter") Integer quarter);

    // Date Range Revenue (for custom date range filtering)
    @Query(value = """
        SELECT storeid, city, state_name, state_abbr,
               SUM(total_revenue) as total_revenue,
               SUM(order_count) as total_orders,
               AVG(avg_order_value) as avg_order_value,
               SUM(unique_customers) as total_unique_customers
        FROM store_revenue_by_time_periods 
        WHERE (year > EXTRACT(YEAR FROM CAST(:startDate AS DATE)) 
               OR (year = EXTRACT(YEAR FROM CAST(:startDate AS DATE)) AND month >= EXTRACT(MONTH FROM CAST(:startDate AS DATE))))
          AND (year < EXTRACT(YEAR FROM CAST(:endDate AS DATE)) 
               OR (year = EXTRACT(YEAR FROM CAST(:endDate AS DATE)) AND month <= EXTRACT(MONTH FROM CAST(:endDate AS DATE))))
        GROUP BY storeid, city, state_name, state_abbr
        ORDER BY total_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueByDateRangeHQ(@Param("startDate") String startDate, @Param("endDate") String endDate);

    @Query(value = """
        SELECT storeid, city, state_name, state_abbr,
               SUM(total_revenue) as total_revenue,
               SUM(order_count) as total_orders,
               AVG(avg_order_value) as avg_order_value,
               SUM(unique_customers) as total_unique_customers
        FROM store_revenue_by_time_periods 
        WHERE state_abbr = :state 
          AND (year > EXTRACT(YEAR FROM CAST(:startDate AS DATE)) 
               OR (year = EXTRACT(YEAR FROM CAST(:startDate AS DATE)) AND month >= EXTRACT(MONTH FROM CAST(:startDate AS DATE))))
          AND (year < EXTRACT(YEAR FROM CAST(:endDate AS DATE)) 
               OR (year = EXTRACT(YEAR FROM CAST(:endDate AS DATE)) AND month <= EXTRACT(MONTH FROM CAST(:endDate AS DATE))))
        GROUP BY storeid, city, state_name, state_abbr
        ORDER BY total_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueByDateRangeState(@Param("state") String state, @Param("startDate") String startDate, @Param("endDate") String endDate);

    @Query(value = """
        SELECT storeid, city, state_name, state_abbr,
               SUM(total_revenue) as total_revenue,
               SUM(order_count) as total_orders,
               AVG(avg_order_value) as avg_order_value,
               SUM(unique_customers) as total_unique_customers
        FROM store_revenue_by_time_periods 
        WHERE storeid = :storeId 
          AND (year > EXTRACT(YEAR FROM CAST(:startDate AS DATE)) 
               OR (year = EXTRACT(YEAR FROM CAST(:startDate AS DATE)) AND month >= EXTRACT(MONTH FROM CAST(:startDate AS DATE))))
          AND (year < EXTRACT(YEAR FROM CAST(:endDate AS DATE)) 
               OR (year = EXTRACT(YEAR FROM CAST(:endDate AS DATE)) AND month <= EXTRACT(MONTH FROM CAST(:endDate AS DATE))))
        GROUP BY storeid, city, state_name, state_abbr
        """, nativeQuery = true)
    Map<String, Object> getStoreRevenueByDateRangeStore(@Param("storeId") String storeId, @Param("startDate") String startDate, @Param("endDate") String endDate);

    // Utility methods for time period options
    @Query(value = "SELECT DISTINCT year, CONCAT('Year ', year) as year_label FROM store_revenue_by_time_periods WHERE year IS NOT NULL ORDER BY year DESC", nativeQuery = true)
    List<Map<String, Object>> getAvailableYears();

    @Query(value = "SELECT DISTINCT year, month, month_label, month_name_label FROM store_revenue_by_time_periods WHERE year = :year AND month IS NOT NULL ORDER BY month", nativeQuery = true)
    List<Map<String, Object>> getAvailableMonthsForYear(@Param("year") Integer year);

    @Query(value = "SELECT DISTINCT year, CEIL(month/3.0) as quarter, CONCAT('Q', CEIL(month/3.0), ' ', year) as quarter_label FROM store_revenue_by_time_periods WHERE year = :year AND month IS NOT NULL ORDER BY quarter", nativeQuery = true)
    List<Map<String, Object>> getAvailableQuartersForYear(@Param("year") Integer year);

    // =================================================================
    // FINAL STORE REVENUE CHART API - Using Actual Tables
    // =================================================================

    // All Time Revenue - using the actual materialized views you created
    @Query(value = "SELECT storeid, city, state_name, state_abbr, total_revenue, total_orders, avg_order_value, total_unique_customers FROM store_revenue_all_time ORDER BY total_revenue DESC", nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueChartAllTimeHQ();

    @Query(value = "SELECT storeid, city, state_name, state_abbr, total_revenue, total_orders, avg_order_value, total_unique_customers FROM store_revenue_all_time WHERE state_abbr = :state ORDER BY total_revenue DESC", nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueChartAllTimeState(@Param("state") String state);

    @Query(value = "SELECT storeid, city, state_name, state_abbr, total_revenue, total_orders, avg_order_value, total_unique_customers FROM store_revenue_all_time WHERE storeid = :storeId", nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueChartAllTimeStore(@Param("storeId") String storeId);

    // Monthly Revenue - using store_revenue_by_time_periods
    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, year, month, month_label, month_name_label,
               SUM(total_revenue) as monthly_revenue,
               SUM(order_count) as monthly_orders,
               AVG(avg_order_value) as monthly_avg_order_value,
               SUM(unique_customers) as monthly_unique_customers
        FROM store_revenue_by_time_periods 
        WHERE year = :year AND month = :month 
        GROUP BY storeid, city, state_name, state_abbr, year, month, month_label, month_name_label
        ORDER BY monthly_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueChartMonthHQ(@Param("year") Integer year, @Param("month") Integer month);

    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, year, month, month_label, month_name_label,
               SUM(total_revenue) as monthly_revenue,
               SUM(order_count) as monthly_orders,
               AVG(avg_order_value) as monthly_avg_order_value,
               SUM(unique_customers) as monthly_unique_customers
        FROM store_revenue_by_time_periods 
        WHERE state_abbr = :state AND year = :year AND month = :month 
        GROUP BY storeid, city, state_name, state_abbr, year, month, month_label, month_name_label
        ORDER BY monthly_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueChartMonthState(@Param("state") String state, @Param("year") Integer year, @Param("month") Integer month);

    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, year, month, month_label, month_name_label,
               SUM(total_revenue) as monthly_revenue,
               SUM(order_count) as monthly_orders,
               AVG(avg_order_value) as monthly_avg_order_value,
               SUM(unique_customers) as monthly_unique_customers
        FROM store_revenue_by_time_periods 
        WHERE storeid = :storeId AND year = :year AND month = :month 
        GROUP BY storeid, city, state_name, state_abbr, year, month, month_label, month_name_label
        """, nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueChartMonthStore(@Param("storeId") String storeId, @Param("year") Integer year, @Param("month") Integer month);

    // Yearly Revenue
    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, year, 
               SUM(total_revenue) as yearly_revenue, 
               SUM(order_count) as yearly_orders, 
               AVG(avg_order_value) as yearly_avg_order_value, 
               SUM(unique_customers) as yearly_unique_customers 
        FROM store_revenue_by_time_periods 
        WHERE year = :year 
        GROUP BY storeid, city, state_name, state_abbr, year 
        ORDER BY yearly_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueChartYearHQ(@Param("year") Integer year);

    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, year, 
               SUM(total_revenue) as yearly_revenue, 
               SUM(order_count) as yearly_orders, 
               AVG(avg_order_value) as yearly_avg_order_value, 
               SUM(unique_customers) as yearly_unique_customers 
        FROM store_revenue_by_time_periods 
        WHERE state_abbr = :state AND year = :year 
        GROUP BY storeid, city, state_name, state_abbr, year 
        ORDER BY yearly_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueChartYearState(@Param("state") String state, @Param("year") Integer year);

    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, year, 
               SUM(total_revenue) as yearly_revenue, 
               SUM(order_count) as yearly_orders, 
               AVG(avg_order_value) as yearly_avg_order_value, 
               SUM(unique_customers) as yearly_unique_customers 
        FROM store_revenue_by_time_periods 
        WHERE storeid = :storeId AND year = :year 
        GROUP BY storeid, city, state_name, state_abbr, year
        """, nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueChartYearStore(@Param("storeId") String storeId, @Param("year") Integer year);

    // Time period options
    @Query(value = "SELECT DISTINCT year, CONCAT('Year ', year) as year_label FROM store_revenue_by_time_periods WHERE year IS NOT NULL ORDER BY year DESC", nativeQuery = true)
    List<Map<String, Object>> getChartAvailableYears();

    @Query(value = "SELECT DISTINCT year, month, month_label, month_name_label FROM store_revenue_by_time_periods WHERE year = :year AND month IS NOT NULL ORDER BY month", nativeQuery = true)
    List<Map<String, Object>> getChartAvailableMonths(@Param("year") Integer year);

    // =================================================================
    // FALLBACK QUERIES - Using existing store_performance views
    // =================================================================
    // These queries use the existing store_performance views as fallback
    // when the new store_revenue_all_time view is not available

    @Query(value = "SELECT storeid, city, state_name, state_abbr, total_revenue, total_orders, avg_order_value, unique_customers as total_unique_customers FROM store_performance_hq ORDER BY total_revenue DESC", nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueChartAllTimeHQFallback();

    @Query(value = "SELECT storeid, city, state_name, state_abbr, total_revenue, total_orders, avg_order_value, unique_customers as total_unique_customers FROM store_performance_state WHERE state_abbr = :state ORDER BY total_revenue DESC", nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueChartAllTimeStateFallback(@Param("state") String state);

    @Query(value = "SELECT storeid, city, state_name, state_abbr, total_revenue, total_orders, avg_order_value, unique_customers as total_unique_customers FROM store_performance_hq WHERE storeid = :storeId", nativeQuery = true)
    List<Map<String, Object>> getStoreRevenueChartAllTimeStoreFallback(@Param("storeId") String storeId);

    // =================================================================
    // COMPREHENSIVE ANALYTICS - Using Correct Materialized Views
    // =================================================================

    // Hourly Performance Analytics - Role-based using hourly materialized views
    @Query(value = """
        SELECT r.hour, r.revenue, o.orders
        FROM revenue_by_hour_hq r
        LEFT JOIN orders_by_hour_hq o ON r.hour = o.hour
        ORDER BY r.hour ASC
        """, nativeQuery = true)
    List<Map<String, Object>> getHourlyPerformanceAnalyticsHQ();

    @Query(value = """
        SELECT r.hour, r.revenue, o.orders, r.state
        FROM revenue_by_hour_state r
        LEFT JOIN orders_by_hour_state o ON r.hour = o.hour AND r.state = o.state
        WHERE r.state = :state
        ORDER BY r.hour ASC
        """, nativeQuery = true)
    List<Map<String, Object>> getHourlyPerformanceAnalyticsState(@Param("state") String state);

    @Query(value = """
        SELECT r.hour, r.revenue, o.orders, r.state, r.store_id
        FROM revenue_by_hour_store r
        LEFT JOIN orders_by_hour_store o ON r.hour = o.hour AND r.store_id = o.store_id
        WHERE r.store_id = :storeId
        ORDER BY r.hour ASC
        """, nativeQuery = true)
    List<Map<String, Object>> getHourlyPerformanceAnalyticsStore(@Param("storeId") String storeId);

    // Product Performance Analytics - Role-based using top_products materialized views
    @Query(value = """
        SELECT sku, name as product_name, category, size, price,
               total_quantity, total_revenue, total_orders, unique_customers
        FROM top_products_hq
        WHERE (:category IS NULL OR category = :category)
        ORDER BY total_revenue DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Map<String, Object>> getProductPerformanceAnalyticsHQ(
        @Param("category") String category,
        @Param("limit") Integer limit);

    @Query(value = """
        SELECT sku, name as product_name, category, size, price,
               total_quantity, total_revenue, total_orders, unique_customers, state
        FROM top_products_state
        WHERE state = :state
          AND (:category IS NULL OR category = :category)
        ORDER BY total_revenue DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Map<String, Object>> getProductPerformanceAnalyticsState(
        @Param("state") String state,
        @Param("category") String category,
        @Param("limit") Integer limit);

    @Query(value = """
        SELECT sku, name as product_name, category, size, price,
               total_quantity, total_revenue, total_orders, unique_customers, state, store_id
        FROM top_products_store
        WHERE store_id = :storeId
          AND (:category IS NULL OR category = :category)
        ORDER BY total_revenue DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Map<String, Object>> getProductPerformanceAnalyticsStore(
        @Param("storeId") String storeId,
        @Param("category") String category,
        @Param("limit") Integer limit);

    // Category Performance Analytics - Role-based using category_performance views
    @Query(value = """
        SELECT category, total_revenue, units_sold, total_orders, unique_customers, avg_order_value
        FROM category_performance_hq
        ORDER BY total_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getCategoryPerformanceAnalyticsHQ();

    @Query(value = """
        SELECT category, total_revenue, units_sold, total_orders, unique_customers, avg_order_value, state
        FROM category_performance_state
        WHERE state = :state
        ORDER BY total_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getCategoryPerformanceAnalyticsState(@Param("state") String state);

    @Query(value = """
        SELECT category, total_revenue, units_sold, total_orders, unique_customers, avg_order_value, state, store_id
        FROM category_performance_store
        WHERE store_id = :storeId
        ORDER BY total_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getCategoryPerformanceAnalyticsStore(@Param("storeId") String storeId);

    // Customer Acquisition Analytics - Role-based using customer_acquisition views
    @Query(value = """
        SELECT year, month, month_name, new_customers, revenue_from_new_customers
        FROM customer_acquisition_hq
        ORDER BY year DESC, month DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getCustomerAcquisitionAnalyticsHQ();

    @Query(value = """
        SELECT year, month, month_name, new_customers, revenue_from_new_customers, state
        FROM customer_acquisition_state
        WHERE state = :state
        ORDER BY year DESC, month DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getCustomerAcquisitionAnalyticsState(@Param("state") String state);

    // Daily Revenue Trends - Using revenue_by_day_hq (only available for HQ)
    @Query(value = """
        SELECT day, revenue, orders, customers
        FROM revenue_by_day_hq
        ORDER BY day DESC
        LIMIT 30
        """, nativeQuery = true)
    List<Map<String, Object>> getDailyRevenueTrendsHQ();

    // Monthly Revenue Trends - Role-based using revenue_by_month views
    @Query(value = """
        SELECT month, revenue
        FROM revenue_by_month_hq
        ORDER BY month
        """, nativeQuery = true)
    List<Map<String, Object>> getMonthlyRevenueTrendsHQ();

    @Query(value = """
        SELECT month, revenue, state
        FROM revenue_by_month_state
        WHERE state = :state
        ORDER BY month
        """, nativeQuery = true)
    List<Map<String, Object>> getMonthlyRevenueTrendsState(@Param("state") String state);

    @Query(value = """
        SELECT month, revenue, state, store_id
        FROM revenue_by_month_store
        WHERE store_id = :storeId
        ORDER BY month
        """, nativeQuery = true)
    List<Map<String, Object>> getMonthlyRevenueTrendsStore(@Param("storeId") String storeId);

    // Store Performance Comparison - Role-based using store_performance views
    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, total_revenue, total_orders, unique_customers, avg_order_value
        FROM store_performance_hq
        ORDER BY total_revenue DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Map<String, Object>> getStorePerformanceComparisonHQ(@Param("limit") Integer limit);

    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, total_revenue, total_orders, unique_customers, avg_order_value
        FROM store_performance_state
        WHERE state_abbr = :state
        ORDER BY total_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getStorePerformanceComparisonState(@Param("state") String state);

    @Query(value = """
        SELECT storeid, city, state_name, state_abbr, total_revenue, total_orders, unique_customers, avg_order_value
        FROM store_performance_state
        WHERE storeid = :storeId
        """, nativeQuery = true)
    List<Map<String, Object>> getStorePerformanceComparisonStore(@Param("storeId") String storeId);

    // Comprehensive analytics using the correct materialized views - fast and accurate!

    // Store Performance Comparison
    @Query(value = """
        SELECT storeid, city, state_abbr,
               COUNT(DISTINCT orderid) as total_orders,
               SUM(product_revenue) as total_revenue,
               COUNT(DISTINCT customerid) as total_customers,
               AVG(order_total) as avg_order_value,
               COUNT(DISTINCT sku) as products_sold,
               COUNT(DISTINCT date_key) as active_days,
               SUM(product_revenue) / COUNT(DISTINCT date_key) as avg_daily_revenue,
               COUNT(DISTINCT orderid) / COUNT(DISTINCT date_key) as avg_daily_orders
        FROM store_analytics_comprehensive 
        WHERE (:state IS NULL OR state_abbr = :state)
          AND (:year IS NULL OR year = :year)
          AND (:month IS NULL OR month = :month)
        GROUP BY storeid, city, state_abbr
        ORDER BY total_revenue DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getStorePerformanceComparison(
        @Param("state") String state,
        @Param("year") Integer year,
        @Param("month") Integer month);

    // =================================================================
    // FIXED HOURLY PERFORMANCE - Combined Revenue and Orders
    // =================================================================
    
    @Query(value = """
        SELECT r.hour, r.revenue, COALESCE(o.orders, 0) as orders
        FROM revenue_by_hour_hq r
        LEFT JOIN orders_by_hour_hq o ON r.hour = o.hour
        ORDER BY r.hour ASC
        """, nativeQuery = true)
    List<Map<String, Object>> getHourlyPerformanceAnalyticsHQ();

    @Query(value = """
        SELECT r.hour, r.revenue, COALESCE(o.orders, 0) as orders
        FROM revenue_by_hour_state r
        LEFT JOIN orders_by_hour_state o ON r.state = o.state AND r.hour = o.hour
        WHERE r.state = :state
        ORDER BY r.hour ASC
        """, nativeQuery = true)
    List<Map<String, Object>> getHourlyPerformanceAnalyticsState(@Param("state") String state);

    @Query(value = """
        SELECT r.hour, r.revenue, COALESCE(o.orders, 0) as orders
        FROM revenue_by_hour_store r
        LEFT JOIN orders_by_hour_store o ON r.store_id = o.store_id AND r.hour = o.hour
        WHERE r.store_id = :storeId
        ORDER BY r.hour ASC
        """, nativeQuery = true)
    List<Map<String, Object>> getHourlyPerformanceAnalyticsStore(@Param("storeId") String storeId);

    // =================================================================
    // IMPROVED PRODUCT PERFORMANCE - Using Materialized Views
    // =================================================================
    
    @Query(value = "SELECT * FROM top_products_hq WHERE (:category IS NULL OR category = :category) ORDER BY total_revenue DESC", nativeQuery = true)
    List<Map<String, Object>> getProductPerformanceAnalyticsHQ(@Param("category") String category, @Param("limit") Integer limit);

    @Query(value = "SELECT * FROM top_products_state WHERE (:category IS NULL OR category = :category) AND state = :state ORDER BY total_revenue DESC", nativeQuery = true)
    List<Map<String, Object>> getProductPerformanceAnalyticsState(@Param("state") String state, @Param("category") String category, @Param("limit") Integer limit);

    @Query(value = "SELECT * FROM top_products_store WHERE (:category IS NULL OR category = :category) AND store_id = :storeId ORDER BY total_revenue DESC", nativeQuery = true)
    List<Map<String, Object>> getProductPerformanceAnalyticsStore(@Param("storeId") String storeId, @Param("category") String category, @Param("limit") Integer limit);

    // =================================================================
    // FIXED CATEGORY PERFORMANCE - Using Materialized Views
    // =================================================================
    
    @Query(value = "SELECT * FROM category_performance_hq ORDER BY total_revenue DESC", nativeQuery = true)
    List<Map<String, Object>> getCategoryPerformanceAnalyticsHQ();

    @Query(value = "SELECT * FROM category_performance_state WHERE state = :state ORDER BY total_revenue DESC", nativeQuery = true)
    List<Map<String, Object>> getCategoryPerformanceAnalyticsState(@Param("state") String state);

    @Query(value = "SELECT * FROM category_performance_store WHERE store_id = :storeId ORDER BY total_revenue DESC", nativeQuery = true)
    List<Map<String, Object>> getCategoryPerformanceAnalyticsStore(@Param("storeId") String storeId);

    // =================================================================
    // CUSTOMER ACQUISITION - Using Materialized Views
    // =================================================================
    
    @Query(value = "SELECT * FROM customer_acquisition_hq ORDER BY year DESC, month DESC", nativeQuery = true)
    List<Map<String, Object>> getCustomerAcquisitionAnalyticsHQ();

    @Query(value = "SELECT * FROM customer_acquisition_state WHERE state = :state ORDER BY year DESC, month DESC", nativeQuery = true)
    List<Map<String, Object>> getCustomerAcquisitionAnalyticsState(@Param("state") String state);

    // =================================================================
    // DAILY AND MONTHLY TRENDS - Using Materialized Views
    // =================================================================
    
    @Query(value = "SELECT * FROM revenue_by_day_hq ORDER BY day DESC LIMIT 30", nativeQuery = true)
    List<Map<String, Object>> getDailyRevenueTrendsHQ();

    @Query(value = "SELECT * FROM revenue_by_month_hq ORDER BY month DESC LIMIT 12", nativeQuery = true)
    List<Map<String, Object>> getMonthlyRevenueTrendsHQ();

    @Query(value = "SELECT * FROM revenue_by_month_state WHERE state = :state ORDER BY month DESC LIMIT 12", nativeQuery = true)
    List<Map<String, Object>> getMonthlyRevenueTrendsState(@Param("state") String state);

    @Query(value = "SELECT * FROM revenue_by_month_store WHERE store_id = :storeId ORDER BY month DESC LIMIT 12", nativeQuery = true)
    List<Map<String, Object>> getMonthlyRevenueTrendsStore(@Param("storeId") String storeId);

    // =================================================================
    // STORE COMPARISON - Using Materialized Views
    // =================================================================
    
    @Query(value = "SELECT * FROM store_performance_hq ORDER BY total_revenue DESC LIMIT 20", nativeQuery = true)
    List<Map<String, Object>> getStorePerformanceComparisonHQ();

    @Query(value = "SELECT * FROM store_performance_state WHERE state_abbr = :state ORDER BY total_revenue DESC", nativeQuery = true)
    List<Map<String, Object>> getStorePerformanceComparisonState(@Param("state") String state);

    @Query(value = "SELECT * FROM store_performance_hq WHERE storeid = :storeId", nativeQuery = true)
    List<Map<String, Object>> getStorePerformanceComparisonStore(@Param("storeId") String storeId);

    // =================================================================
    // STATE REVENUE TRENDS - New for State Comparison Chart
    // =================================================================
    
    @Query(value = """
        SELECT r.state, r.month, r.revenue,
               EXTRACT(YEAR FROM TO_DATE(r.month, 'YYYY-MM')) as year,
               EXTRACT(MONTH FROM TO_DATE(r.month, 'YYYY-MM')) as month_num
        FROM revenue_by_month_state r
        WHERE r.state IN (
            SELECT state FROM (
                SELECT state, SUM(revenue) as total_revenue
                FROM revenue_by_month_state
                GROUP BY state
                ORDER BY total_revenue DESC
                LIMIT 4
            ) top_states
        )
        ORDER BY r.state, r.month
        """, nativeQuery = true)
    List<Map<String, Object>> getStateRevenueTrendsHQ();

    @Query(value = """
        SELECT r.state, r.month, r.revenue,
               EXTRACT(YEAR FROM TO_DATE(r.month, 'YYYY-MM')) as year,
               EXTRACT(MONTH FROM TO_DATE(r.month, 'YYYY-MM')) as month_num
        FROM revenue_by_month_state r
        WHERE r.state = :state
        ORDER BY r.month
        """, nativeQuery = true)
    List<Map<String, Object>> getStateRevenueTrendsState(@Param("state") String state);
}