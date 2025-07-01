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
public interface PizzaRepo extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    // -----------------------------------------------------------------
    // Materialized-view-based KPI queries
    // -----------------------------------------------------------------

    /**
     * Global KPI snapshot – single row in view <code>kpis_global_hq</code>.
     * Adds product count in a sub-select so the existing DTO still receives the
     * same field set as before.
     */
    @Query(value = """
            SELECT
                revenue,
                orders,
                avg_order_value   AS avg_order,
                customers,
                (SELECT COUNT(*) FROM products) AS products
            FROM   kpis_global_hq
            """, nativeQuery = true)
    Map<String, Object> fetchGlobalKPIs();

    /**
     * State-level KPI snapshot – rows are keyed by <code>state</code>.
     */
    @Query(value = """
            SELECT
                revenue,
                orders,
                avg_order_value   AS avg_order,
                customers,
                (SELECT COUNT(*) FROM products) AS products
            FROM   kpis_global_state
            WHERE  state = :state
            """, nativeQuery = true)
    Map<String, Object> fetchStateKPIs(@Param("state") String state);

    /**
     * Store-level KPI snapshot – rows are keyed by <code>store_id</code>.
     */
    @Query(value = """
            SELECT
                revenue,
                orders,
                avg_order_value   AS avg_order,
                customers,
                (SELECT COUNT(*) FROM products) AS products
            FROM   kpis_global_store
            WHERE  store_id = :storeId
            """, nativeQuery = true)
    Map<String, Object> fetchStoreKPIs(@Param("storeId") String storeId);

    // The helper to look up a store's state is still required elsewhere.
    @Query(value = "SELECT state_abbr FROM stores WHERE storeid = :storeId", nativeQuery = true)
    String getStoreState(@Param("storeId") String storeId);

    @Query(value = """
            SELECT COALESCE(SUM(o.total), 0) AS revenue,
                   COALESCE(COUNT(*), 0) AS total_orders,
                   COALESCE(COUNT(DISTINCT o.customerid), 0) AS unique_customers,
                   COALESCE(AVG(o.total), 0) AS avg_order
            FROM orders o
            WHERE o.orderdate BETWEEN :from AND :to
            """, nativeQuery = true)
    Map<String, Object> fetchSalesKPIs(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query(value = """
            SELECT COALESCE(SUM(o.total), 0) AS revenue,
                   COALESCE(COUNT(*), 0) AS total_orders,
                   COALESCE(COUNT(DISTINCT o.customerid), 0) AS unique_customers,
                   COALESCE(AVG(o.total), 0) AS avg_order
            FROM orders o
            JOIN stores s ON o.storeid = s.storeid
            WHERE s.state_abbr = :state
              AND o.orderdate BETWEEN :from AND :to
            GROUP BY s.state_abbr
            """, nativeQuery = true)
    Map<String, Object> fetchSalesKPIsByState(@Param("state") String state,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query(value = """
            SELECT COALESCE(SUM(o.total), 0) AS revenue,
                   COALESCE(COUNT(*), 0) AS total_orders,
                   COALESCE(COUNT(DISTINCT o.customerid), 0) AS unique_customers,
                   COALESCE(AVG(o.total), 0) AS avg_order
            FROM orders o
            WHERE o.storeid = :storeId
              AND o.orderdate BETWEEN :from AND :to
            """, nativeQuery = true)
    Map<String, Object> fetchSalesKPIsByStore(@Param("storeId") String storeId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query(value = """
            SELECT
                storeid,
                zipcode,
                state_abbr,
                latitude,
                longitude,
                city,
                state,
                distance
            FROM stores
            WHERE (:storeId IS NULL OR storeid = :storeId)
              AND (:zipcode IS NULL OR zipcode = :zipcode)
              AND (:stateAbbr IS NULL OR state_abbr = :stateAbbr)
              AND (:city IS NULL OR city = :city)
              AND (:state IS NULL OR state = :state)
              AND (:minDistance IS NULL OR distance >= CAST(:minDistance AS DOUBLE PRECISION))
              AND (:maxDistance IS NULL OR distance <= CAST(:maxDistance AS DOUBLE PRECISION))
            """, nativeQuery = true)
    List<Map<String, Object>> dynamicStoreFilter(
            @Param("storeId") String storeId,
            @Param("zipcode") String zipcode,
            @Param("stateAbbr") String stateAbbr,
            @Param("city") String city,
            @Param("state") String state,
            @Param("minDistance") String minDistance,
            @Param("maxDistance") String maxDistance);

    @Query(value = """
            SELECT o.* FROM orders o
            JOIN stores s ON o.storeid = s.storeid
            WHERE (:storeId IS NULL OR o.storeid = :storeId)
              AND (:customerId IS NULL OR o.customerid = :customerId)
              AND (:state IS NULL OR s.state_abbr = :state)
              AND (:fromDate IS NULL OR o.orderdate >= CAST(:fromDate AS DATE))
              AND (:toDate IS NULL OR o.orderdate <= CAST(:toDate AS DATE))
              AND (:orderId IS NULL OR o.orderid = :orderId)
              AND (:nitems IS NULL OR o.nitems = :nitems)
            """, nativeQuery = true)
    List<Map<String, Object>> dynamicOrderFilter(
            @Param("storeId") String storeId,
            @Param("customerId") String customerId,
            @Param("state") String state,
            @Param("fromDate") String fromDate,
            @Param("toDate") String toDate,
            @Param("orderId") Integer orderId,
            @Param("nitems") Integer nitems);

    @Query(value = """
            SELECT COUNT(*) FROM orders o
            JOIN stores s ON o.storeid = s.storeid
            WHERE (:storeId IS NULL OR o.storeid = :storeId)
              AND (:customerId IS NULL OR o.customerid = :customerId)
              AND (:state IS NULL OR s.state_abbr = :state)
              AND (:fromDate IS NULL OR o.orderdate >= CAST(:fromDate AS DATE))
              AND (:toDate IS NULL OR o.orderdate <= CAST(:toDate AS DATE))
              AND (:orderId IS NULL OR o.orderid = :orderId)
              AND (:nitems IS NULL OR o.nitems = :nitems)
            """, nativeQuery = true)
    Long countFilteredOrders(
            @Param("storeId") String storeId,
            @Param("customerId") String customerId,
            @Param("state") String state,
            @Param("fromDate") String fromDate,
            @Param("toDate") String toDate,
            @Param("orderId") Integer orderId,
            @Param("nitems") Integer nitems);

    @Query(value = """
            SELECT
                p.sku,
                p.name,
                p.category,
                p.price,
                p.size,
                p.ingredients,
                p.launch,
                COUNT(*) AS total_orders,
                COUNT(DISTINCT o.customerid) AS unique_customers,
                SUM(o.total) AS revenue,
                AVG(o.total) AS avg_order
            FROM products p
            JOIN order_items oi ON p.sku = oi.sku
            JOIN orders o ON o.orderid = oi.orderid
            WHERE p.sku = :sku
            GROUP BY p.sku, p.name, p.category, p.price, p.size, p.ingredients, p.launch
            """, nativeQuery = true)
    Map<String, Object> fetchProductDetails(@Param("sku") String sku);

    @Query(value = """
            SELECT p.sku, p.name, p.size, SUM(o.total) AS revenue
            FROM order_items oi
            JOIN orders o ON o.orderid = oi.orderid
            JOIN products p ON p.sku = oi.sku
            WHERE o.storeid = :storeId
            GROUP BY p.sku, p.name, p.size
            ORDER BY revenue DESC
            """, nativeQuery = true)
    List<Map<String, Object>> fetchRevenuePerProductByStore(@Param("storeId") String storeId);

    // --------- STORE: Best & Worst Product ---------
    @Query(value = """
            SELECT p.sku, p.name, p.size, SUM(oi.quantity) AS total_sold
            FROM order_items oi
            JOIN orders o ON o.orderid = oi.orderid
            JOIN products p ON p.sku = oi.sku
            WHERE o.storeid = :storeId
            GROUP BY p.sku, p.name, p.size
            ORDER BY total_sold DESC
            LIMIT 1
            """, nativeQuery = true)
    Map<String, Object> fetchTopProductByStore(@Param("storeId") String storeId);

    @Query(value = """
            SELECT p.sku, p.name, p.size, SUM(oi.quantity) AS total_sold
            FROM order_items oi
            JOIN orders o ON o.orderid = oi.orderid
            JOIN products p ON p.sku = oi.sku
            WHERE o.storeid = :storeId
            GROUP BY p.sku, p.name, p.size
            ORDER BY total_sold ASC
            LIMIT 1
            """, nativeQuery = true)
    Map<String, Object> fetchWorstProductByStore(@Param("storeId") String storeId);

    @Query(value = """
            SELECT p.sku, p.name, p.size, SUM(oi.quantity) AS total_sold
            FROM order_items oi
            JOIN orders o ON o.orderid = oi.orderid
            JOIN products p ON p.sku = oi.sku
            WHERE o.storeid = :storeId
            GROUP BY p.sku, p.name, p.size
            ORDER BY total_sold DESC
            """, nativeQuery = true)
    List<Map<String, Object>> fetchProductsByQuantitySold(@Param("storeId") String storeId);

    @Query(value = """
            SELECT
                p.sku,
                p.name,
                p.price,
                p.category,
                p.size,
                p.ingredients,
                p.launch,
                COALESCE(COUNT(o.orderid), 0) AS total_orders,
                COALESCE(COUNT(DISTINCT o.customerid), 0) AS customers,
                COALESCE(SUM(o.total), 0) AS revenue
            FROM products p
            LEFT JOIN order_items oi ON p.sku = oi.sku
            LEFT JOIN orders o ON o.orderid = oi.orderid
            LEFT JOIN stores s ON o.storeid = s.storeid
            WHERE (:storeId IS NULL OR o.storeid = :storeId)
              AND (:state IS NULL OR s.state_abbr = :state)
              AND (:category IS NULL OR p.category = :category)
            GROUP BY p.sku, p.name, p.price, p.category, p.size, p.ingredients, p.launch
            ORDER BY revenue DESC
            """, nativeQuery = true)
    List<Map<String, Object>> dynamicProductFilter(
            @Param("storeId") String storeId,
            @Param("state") String state,
            @Param("category") String category);

    // Get all products without requiring orders
    @Query(value = """
            SELECT
                p.sku,
                p.name,
                p.price,
                p.category,
                p.size,
                p.ingredients,
                p.launch,
                COALESCE(COUNT(o.orderid), 0) AS total_orders,
                COALESCE(COUNT(DISTINCT o.customerid), 0) AS customers,
                COALESCE(SUM(o.total), 0) AS revenue
            FROM products p
            LEFT JOIN order_items oi ON p.sku = oi.sku
            LEFT JOIN orders o ON o.orderid = oi.orderid
            GROUP BY p.sku, p.name, p.price, p.category, p.size, p.ingredients, p.launch
            ORDER BY revenue DESC
            """, nativeQuery = true)
    List<Map<String, Object>> getAllProducts();

    @Query(value = """
                SELECT
                    DATE_TRUNC('week', o.orderdate) AS week_start,
                    SUM(o.total) AS revenue,
                    COUNT(*) AS orders
                FROM orders o
                JOIN stores s ON o.storeid = s.storeid
                WHERE o.orderdate BETWEEN :from AND :to
                  AND (:state IS NULL OR s.state_abbr = :state)
                  AND (:storeId IS NULL OR o.storeid = :storeId)
                GROUP BY week_start
                ORDER BY week_start
            """, nativeQuery = true)
    List<Map<String, Object>> fetchWeeklyOrderTrend(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("state") String state,
            @Param("storeId") String storeId);

    @Query(value = """
                SELECT s.city AS name, SUM(o.total) AS revenue
                FROM orders o
                JOIN stores s ON o.storeid = s.storeid
                GROUP BY s.city
                ORDER BY revenue DESC
            """, nativeQuery = true)
    List<Map<String, Object>> fetchRevenueByStore();

    @Query(value = "SELECT COUNT(*) FROM orders WHERE storeid = :storeId", nativeQuery = true)
    Integer countOrdersByStore(@Param("storeId") String storeId);

    // Debug query to check orders table structure
    @Query(value = """
            SELECT storeid, COUNT(*) as order_count, SUM(total) as total_revenue
            FROM orders
            WHERE storeid = :storeId
            GROUP BY storeid
            """, nativeQuery = true)
    Map<String, Object> debugStoreOrders(@Param("storeId") String storeId);

    // Simple test query to check if the basic SQL works
    @Query(value = "SELECT COUNT(*) FROM orders WHERE storeid = :storeId", nativeQuery = true)
    Long simpleOrderCount(@Param("storeId") String storeId);

    // 📈 KPI Repository Methods for Charts
    @Query(value = """
            SELECT DATE(o.orderdate) AS day, COUNT(DISTINCT o.storeid) AS count
            FROM orders o
            GROUP BY DATE(o.orderdate)
            ORDER BY day
            """, nativeQuery = true)
    List<Map<String, Object>> fetchStoresPerDay();

    @Query(value = """
            SELECT DATE(o.orderdate) AS day, SUM(o.total) AS sales
            FROM orders o
            GROUP BY DATE(o.orderdate)
            ORDER BY day
            """, nativeQuery = true)
    List<Map<String, Object>> fetchSalesPerDay();

    @Query(value = """
            SELECT DATE(o.orderdate) AS day, COUNT(*) AS orders
            FROM orders o
            GROUP BY DATE(o.orderdate)
            ORDER BY day
            """, nativeQuery = true)
    List<Map<String, Object>> fetchOrdersPerDay();

    @Query(value = "SELECT * FROM stores WHERE state_abbr = :state", nativeQuery = true)
    List<Map<String, Object>> findStoresByState(@Param("state") String state);

    @Query(value = "SELECT * FROM stores WHERE storeid = :storeId", nativeQuery = true)
    Map<String, Object> findStoreById(@Param("storeId") String storeId);

    // 🚀 Optimized query to fetch all store KPIs in a single database call
    @Query(value = """
            SELECT
                o.storeid,
                COALESCE(SUM(o.total), 0) AS revenue,
                COALESCE(COUNT(*), 0) AS orders,
                COALESCE(AVG(o.total), 0) AS avg_order,
                COALESCE(COUNT(DISTINCT o.customerid), 0) AS customers
            FROM orders o
            WHERE o.storeid IN (:storeIds)
            GROUP BY o.storeid
            """, nativeQuery = true)
    List<Map<String, Object>> fetchAllStoreKPIs(@Param("storeIds") List<String> storeIds);

    // 🚀 Optimized query to fetch all store KPIs for a specific state
    @Query(value = """
            SELECT
                o.storeid,
                COALESCE(SUM(o.total), 0) AS revenue,
                COALESCE(COUNT(*), 0) AS orders,
                COALESCE(AVG(o.total), 0) AS avg_order,
                COALESCE(COUNT(DISTINCT o.customerid), 0) AS customers
            FROM orders o
            JOIN stores s ON o.storeid = s.storeid
            WHERE s.state_abbr = :state
            GROUP BY o.storeid
            """, nativeQuery = true)
    List<Map<String, Object>> fetchAllStoreKPIsByState(@Param("state") String state);

    // 🚀 Optimized query to fetch all store KPIs for HQ admin (all stores)
    @Query(value = """
            SELECT
                o.storeid,
                COALESCE(SUM(o.total), 0) AS revenue,
                COALESCE(COUNT(*), 0) AS orders,
                COALESCE(AVG(o.total), 0) AS avg_order,
                COALESCE(COUNT(DISTINCT o.customerid), 0) AS customers
            FROM orders o
            GROUP BY o.storeid
            """, nativeQuery = true)
    List<Map<String, Object>> fetchAllStoreKPIsForHQ();

    // --------- SALES: Best Selling Products (Global) ---------
    @Query(value = """
            SELECT p.sku, p.name, p.size, SUM(o.total) AS revenue, SUM(oi.quantity) AS total_sold
            FROM order_items oi
            JOIN orders o ON o.orderid = oi.orderid
            JOIN products p ON p.sku = oi.sku
            WHERE o.orderdate BETWEEN :from AND :to
            GROUP BY p.sku, p.name, p.size
            ORDER BY revenue DESC
            """, nativeQuery = true)
    List<Map<String, Object>> fetchBestSellingProducts(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query(value = """
            SELECT p.sku, p.name, p.size, SUM(o.total) AS revenue, SUM(oi.quantity) AS total_sold
            FROM order_items oi
            JOIN orders o ON o.orderid = oi.orderid
            JOIN products p ON p.sku = oi.sku
            JOIN stores s ON o.storeid = s.storeid
            WHERE s.state_abbr = :state
              AND o.orderdate BETWEEN :from AND :to
            GROUP BY p.sku, p.name, p.size
            ORDER BY revenue DESC
            """, nativeQuery = true)
    List<Map<String, Object>> fetchBestSellingProductsByState(@Param("state") String state,
            @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query(value = """
            SELECT p.sku, p.name, p.size, SUM(o.total) AS revenue, SUM(oi.quantity) AS total_sold
            FROM order_items oi
            JOIN orders o ON o.orderid = oi.orderid
            JOIN products p ON p.sku = oi.sku
            WHERE o.storeid = :storeId
              AND o.orderdate BETWEEN :from AND :to
            GROUP BY p.sku, p.name, p.size
            ORDER BY revenue DESC
            """, nativeQuery = true)
    List<Map<String, Object>> fetchBestSellingProductsByStore(@Param("storeId") String storeId,
            @Param("from") LocalDate from, @Param("to") LocalDate to);

    // --------- SALES: Best/Worst Stores by Revenue ---------
    @Query(value = """
            SELECT s.storeid, s.city, s.state_abbr, SUM(o.total) AS revenue, COUNT(*) AS orders
            FROM orders o
            JOIN stores s ON o.storeid = s.storeid
            WHERE o.orderdate BETWEEN :from AND :to
            GROUP BY s.storeid, s.city, s.state_abbr
            ORDER BY revenue DESC
            """, nativeQuery = true)
    List<Map<String, Object>> fetchStoresByRevenue(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query(value = """
            SELECT s.storeid, s.city, s.state_abbr, SUM(o.total) AS revenue, COUNT(*) AS orders
            FROM orders o
            JOIN stores s ON o.storeid = s.storeid
            WHERE s.state_abbr = :state
              AND o.orderdate BETWEEN :from AND :to
            GROUP BY s.storeid, s.city, s.state_abbr
            ORDER BY revenue DESC
            """, nativeQuery = true)
    List<Map<String, Object>> fetchStoresByRevenueByState(@Param("state") String state,
            @Param("from") LocalDate from, @Param("to") LocalDate to);

    // --------- SALES: Sales Trends by Time Period ---------
    @Query(value = """
            SELECT DATE(o.orderdate) AS day, SUM(o.total) AS revenue, COUNT(*) AS orders
            FROM orders o
            WHERE o.orderdate BETWEEN :from AND :to
            GROUP BY DATE(o.orderdate)
            ORDER BY day
            """, nativeQuery = true)
    List<Map<String, Object>> fetchSalesTrendByDay(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query(value = """
            SELECT DATE(o.orderdate) AS day, SUM(o.total) AS revenue, COUNT(*) AS orders
            FROM orders o
            JOIN stores s ON o.storeid = s.storeid
            WHERE s.state_abbr = :state
              AND o.orderdate BETWEEN :from AND :to
            GROUP BY DATE(o.orderdate)
            ORDER BY day
            """, nativeQuery = true)
    List<Map<String, Object>> fetchSalesTrendByDayByState(@Param("state") String state,
            @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query(value = """
            SELECT DATE(o.orderdate) AS day, SUM(o.total) AS revenue, COUNT(*) AS orders
            FROM orders o
            WHERE o.storeid = :storeId
              AND o.orderdate BETWEEN :from AND :to
            GROUP BY DATE(o.orderdate)
            ORDER BY day
            """, nativeQuery = true)
    List<Map<String, Object>> fetchSalesTrendByDayByStore(@Param("storeId") String storeId,
            @Param("from") LocalDate from, @Param("to") LocalDate to);

    // --------- SALES: Revenue by Category ---------
    @Query(value = """
            SELECT p.category, SUM(o.total) AS revenue, COUNT(*) AS orders
            FROM order_items oi
            JOIN orders o ON o.orderid = oi.orderid
            JOIN products p ON p.sku = oi.sku
            WHERE o.orderdate BETWEEN :from AND :to
            GROUP BY p.category
            ORDER BY revenue DESC
            """, nativeQuery = true)
    List<Map<String, Object>> fetchRevenueByCategory(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query(value = """
            SELECT p.category, SUM(o.total) AS revenue, COUNT(*) AS orders
            FROM order_items oi
            JOIN orders o ON o.orderid = oi.orderid
            JOIN products p ON p.sku = oi.sku
            JOIN stores s ON o.storeid = s.storeid
            WHERE s.state_abbr = :state
              AND o.orderdate BETWEEN :from AND :to
            GROUP BY p.category
            ORDER BY revenue DESC
            """, nativeQuery = true)
    List<Map<String, Object>> fetchRevenueByCategoryByState(@Param("state") String state,
            @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query(value = """
            SELECT p.category, SUM(o.total) AS revenue, COUNT(*) AS orders
            FROM order_items oi
            JOIN orders o ON o.orderid = oi.orderid
            JOIN products p ON p.sku = oi.sku
            WHERE o.storeid = :storeId
              AND o.orderdate BETWEEN :from AND :to
            GROUP BY p.category
            ORDER BY revenue DESC
            """, nativeQuery = true)
    List<Map<String, Object>> fetchRevenueByCategoryByStore(@Param("storeId") String storeId,
            @Param("from") LocalDate from, @Param("to") LocalDate to);

    // Debug methods to check orders table
    @Query(value = "SELECT * FROM orders LIMIT 5", nativeQuery = true)
    List<Map<String, Object>> findSampleOrders();

    @Query(value = "SELECT COUNT(*) FROM orders", nativeQuery = true)
    Long countTotalOrders();

    @Query(value = "SELECT MIN(orderdate) FROM orders", nativeQuery = true)
    String findEarliestOrderDate();

    // Get recent orders for caching (first 100 orders)
    @Query(value = """
            SELECT o.*, s.city as store_city, s.state_abbr as store_state
            FROM orders o
            JOIN stores s ON o.storeid = s.storeid
            ORDER BY o.orderdate DESC
            LIMIT 100
            """, nativeQuery = true)
    List<Map<String, Object>> getRecentOrdersForCache();

    // 🚀 NEW DASHBOARD ENDPOINTS

    // Get revenue by year
    @Query(value = """
            SELECT
                EXTRACT(YEAR FROM o.orderdate) AS year,
                SUM(o.total) AS revenue,
                COUNT(*) AS orders,
                COUNT(DISTINCT o.customerid) AS customers
            FROM orders o
            GROUP BY EXTRACT(YEAR FROM o.orderdate)
            ORDER BY year DESC
            """, nativeQuery = true)
    List<Map<String, Object>> getRevenueByYear();

    // Get revenue by year and month
    @Query(value = """
            SELECT
                EXTRACT(YEAR FROM o.orderdate) AS year,
                EXTRACT(MONTH FROM o.orderdate) AS month,
                TO_CHAR(o.orderdate, 'Month') AS month_name,
                SUM(o.total) AS revenue,
                COUNT(*) AS orders,
                COUNT(DISTINCT o.customerid) AS customers
            FROM orders o
            GROUP BY EXTRACT(YEAR FROM o.orderdate), EXTRACT(MONTH FROM o.orderdate), TO_CHAR(o.orderdate, 'Month')
            ORDER BY year DESC, month DESC
            """, nativeQuery = true)
    List<Map<String, Object>> getRevenueByYearMonth();

    // Get top 10 stores by revenue
    @Query(value = """
            SELECT
                s.storeid,
                s.city,
                s.state_abbr,
                SUM(o.total) AS revenue,
                COUNT(*) AS orders,
                COUNT(DISTINCT o.customerid) AS customers,
                AVG(o.total) AS avg_order
            FROM orders o
            JOIN stores s ON o.storeid = s.storeid
            GROUP BY s.storeid, s.city, s.state_abbr
            ORDER BY revenue DESC
            LIMIT 10
            """, nativeQuery = true)
    List<Map<String, Object>> getTopStoresByRevenue();

    // Get revenue trend by day for last 30 days
    @Query(value = """
            SELECT
                DATE(o.orderdate) AS day,
                SUM(o.total) AS revenue,
                COUNT(*) AS orders,
                COUNT(DISTINCT o.customerid) AS customers
            FROM orders o
            WHERE o.orderdate >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE(o.orderdate)
            ORDER BY day DESC
            """, nativeQuery = true)
    List<Map<String, Object>> getRevenueTrendLast30Days();

    // Get product category performance
    @Query(value = """
            SELECT
                p.category,
                SUM(o.total) AS revenue,
                SUM(oi.quantity) AS units_sold,
                COUNT(DISTINCT o.orderid) AS orders,
                COUNT(DISTINCT o.customerid) AS customers
            FROM order_items oi
            JOIN orders o ON oi.orderid = o.orderid
            JOIN products p ON oi.sku = p.sku
            GROUP BY p.category
            ORDER BY revenue DESC
            """, nativeQuery = true)
    List<Map<String, Object>> getProductCategoryPerformance();

    // Get customer acquisition by month
    @Query(value = """
            SELECT
                EXTRACT(YEAR FROM o.orderdate) AS year,
                EXTRACT(MONTH FROM o.orderdate) AS month,
                TO_CHAR(o.orderdate, 'Month') AS month_name,
                COUNT(DISTINCT o.customerid) AS new_customers
            FROM orders o
            WHERE o.customerid NOT IN (
                SELECT DISTINCT customerid
                FROM orders
                WHERE orderdate < DATE_TRUNC('month', o.orderdate)
            )
            GROUP BY EXTRACT(YEAR FROM o.orderdate), EXTRACT(MONTH FROM o.orderdate), TO_CHAR(o.orderdate, 'Month')
            ORDER BY year DESC, month DESC
            """, nativeQuery = true)
    List<Map<String, Object>> getCustomerAcquisitionByMonth();

    // Get average order value trend
    @Query(value = """
            SELECT
                DATE(o.orderdate) AS day,
                AVG(o.total) AS avg_order_value,
                COUNT(*) AS orders
            FROM orders o
            WHERE o.orderdate >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE(o.orderdate)
            ORDER BY day DESC
            """, nativeQuery = true)
    List<Map<String, Object>> getAverageOrderValueTrend();

    // Get store performance comparison
    @Query(value = """
            SELECT
                s.storeid,
                s.city,
                s.state_abbr,
                SUM(o.total) AS total_revenue,
                COUNT(*) AS total_orders,
                COUNT(DISTINCT o.customerid) AS unique_customers,
                AVG(o.total) AS avg_order_value,
                MAX(o.orderdate) AS last_order_date
            FROM stores s
            LEFT JOIN orders o ON s.storeid = o.storeid
            GROUP BY s.storeid, s.city, s.state_abbr
            ORDER BY total_revenue DESC
            """, nativeQuery = true)
    List<Map<String, Object>> getStorePerformanceComparison();

}
