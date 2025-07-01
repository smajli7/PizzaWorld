package pizzaworld.controller;

import java.time.LocalDate;
import java.util.Map;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletResponse;
import pizzaworld.service.OptimizedPizzaService;
import pizzaworld.service.UserService;
import pizzaworld.model.CustomUserDetails;
import pizzaworld.model.User;
import pizzaworld.util.CsvExportUtil;
import pizzaworld.dto.DashboardKpiDto;

@RestController
@RequestMapping("/api/v2")
public class OptimizedPizzaController {

    @Autowired
    private OptimizedPizzaService pizzaService;

    @Autowired
    private UserService userService;

    // =================================================================
    // DASHBOARD KPIs - Fast materialized view queries
    // =================================================================

    @GetMapping("/dashboard/kpis") //works, all time data for HQ_ADMIN
    public ResponseEntity<DashboardKpiDto> getDashboardKPIs(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getDashboardKPIs(user));
    }

   // =================================================================
    // GLOBAL STORE KPIs - Materialized View Access
    // =================================================================

    @GetMapping("/kpis/global-store")
    public ResponseEntity<List<Map<String, Object>>> getGlobalStoreKPIs(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getGlobalStoreKPIs(user));
    }

    @GetMapping("/kpis/global-store/export")
    public void exportGlobalStoreKPIs(@AuthenticationPrincipal CustomUserDetails userDetails,
            HttpServletResponse response) {
        User user = userDetails.getUser();
        List<Map<String, Object>> data = pizzaService.getGlobalStoreKPIs(user);
        
        if (data.isEmpty()) {
            CsvExportUtil.writeCsv(response, List.of("No Data"), List.of(), "global-store-kpis.csv");
            return;
        }

        List<String> headers = List.copyOf(data.get(0).keySet());
        List<List<String>> rows = data.stream()
                .map(row -> headers.stream().map(h -> String.valueOf(row.get(h))).toList())
                .toList();

        CsvExportUtil.writeCsv(response, headers, rows, "global-store-kpis.csv");
    }

    // =================================================================
    // STORE REVENUE CHART - Dynamic Time Period Filtering
    // =================================================================

    @GetMapping("/chart/store-revenue")
    public ResponseEntity<List<Map<String, Object>>> getStoreRevenueChart(
            @RequestParam(defaultValue = "all-time") String timePeriod,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer quarter,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getStoreRevenueByTimePeriod(user, timePeriod, year, month, quarter));
    }

    @GetMapping("/chart/store-revenue/date-range")
    public ResponseEntity<List<Map<String, Object>>> getStoreRevenueByDateRange(
            @RequestParam String startDate,
            @RequestParam String endDate,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getStoreRevenueByDateRange(user, startDate, endDate));
    }

    @GetMapping("/chart/store-revenue/export")
    public void exportStoreRevenueChart(
            @RequestParam(defaultValue = "all-time") String timePeriod,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer quarter,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            HttpServletResponse response) {
        User user = userDetails.getUser();
        List<Map<String, Object>> data = pizzaService.getStoreRevenueByTimePeriod(user, timePeriod, year, month, quarter);
        
        if (data.isEmpty()) {
            CsvExportUtil.writeCsv(response, List.of("No Data"), List.of(), "store-revenue-chart.csv");
            return;
        }

        List<String> headers = List.copyOf(data.get(0).keySet());
        List<List<String>> rows = data.stream()
                .map(row -> headers.stream().map(h -> String.valueOf(row.get(h))).toList())
                .toList();

        CsvExportUtil.writeCsv(response, headers, rows, "store-revenue-chart.csv");
    }

    // Time period utility endpoints
    @GetMapping("/chart/time-periods/years")
    public ResponseEntity<List<Map<String, Object>>> getAvailableYears() {
        return ResponseEntity.ok(pizzaService.getAvailableYears());
    }

    @GetMapping("/chart/time-periods/months")
    public ResponseEntity<List<Map<String, Object>>> getAvailableMonthsForYear(@RequestParam Integer year) {
        return ResponseEntity.ok(pizzaService.getAvailableMonthsForYear(year));
    }

    @GetMapping("/chart/time-periods/quarters")
    public ResponseEntity<List<Map<String, Object>>> getAvailableQuartersForYear(@RequestParam Integer year) {
        return ResponseEntity.ok(pizzaService.getAvailableQuartersForYear(year));
    }

    // =================================================================
    // FINAL STORE REVENUE CHART API - Production Ready
    // =================================================================

    @GetMapping("/store-revenue-chart")
    public ResponseEntity<List<Map<String, Object>>> getStoreRevenueChart(
            @RequestParam(defaultValue = "all-time") String timePeriod,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getStoreRevenueChart(user, timePeriod, year, month));
    }

    @GetMapping("/store-revenue-chart/export")
    public void exportStoreRevenueChart(
            @RequestParam(defaultValue = "all-time") String timePeriod,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            HttpServletResponse response) {
        User user = userDetails.getUser();
        List<Map<String, Object>> data = pizzaService.getStoreRevenueChart(user, timePeriod, year, month);
        
        if (data.isEmpty()) {
            CsvExportUtil.writeCsv(response, List.of("No Data"), List.of(), "store-revenue-chart.csv");
            return;
        }

        List<String> headers = List.copyOf(data.get(0).keySet());
        List<List<String>> rows = data.stream()
                .map(row -> headers.stream().map(h -> String.valueOf(row.get(h))).toList())
                .toList();

        CsvExportUtil.writeCsv(response, headers, rows, "store-revenue-chart.csv");
    }

    @GetMapping("/store-revenue-chart/years")
    public ResponseEntity<List<Map<String, Object>>> getChartAvailableYears() {
        return ResponseEntity.ok(pizzaService.getChartAvailableYears());
    }

    @GetMapping("/store-revenue-chart/months")
    public ResponseEntity<List<Map<String, Object>>> getChartAvailableMonths(@RequestParam Integer year) {
        return ResponseEntity.ok(pizzaService.getChartAvailableMonths(year));
    }


    @GetMapping("/dashboard/kpis/export") //works, all time data for HQ_ADMIN - in csv
    public void exportDashboardKPIs(@AuthenticationPrincipal CustomUserDetails userDetails,
            HttpServletResponse response) {
        DashboardKpiDto data = pizzaService.getDashboardKPIs(userDetails.getUser());
        List<String> headers = List.of("Revenue", "Orders", "AvgOrder", "Customers");
        List<List<String>> rows = List.of(List.of(
                String.valueOf(data.revenue),
                String.valueOf(data.orders),
                String.valueOf(data.avgOrder),
                String.valueOf(data.customers)));
        CsvExportUtil.writeCsv(response, headers, rows, "dashboard-kpis.csv");
    }

    // =================================================================
    // REVENUE ANALYTICS - Role-based materialized views
    // =================================================================

    @GetMapping("/analytics/revenue/by-year") //- works, gives out revenue by year for hq
    public ResponseEntity<List<Map<String, Object>>> getRevenueByYear(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getRevenueByYear(user));
    }

    @GetMapping("/analytics/revenue/by-month")
    public ResponseEntity<List<Map<String, Object>>> getRevenueByMonth(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getRevenueByMonth(user));
    }

    @GetMapping("/analytics/revenue/by-week")
    public ResponseEntity<List<Map<String, Object>>> getRevenueByWeek(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getRevenueByWeek(user));
    }

    // =================================================================
    // ORDER ANALYTICS - Role-based materialized views
    // =================================================================


    @GetMapping("/orders/recent") //works
    public ResponseEntity<List<Map<String, Object>>> getRecentOrders(
            @RequestParam(defaultValue = "50") int limit,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getRecentOrders(user, limit));
    }

    // =================================================================
    // FILTERED ORDERS - Enhanced with pagination
    // =================================================================


    // =================================================================
    // PRODUCT ANALYTICS - Role-based
    // =================================================================

    @GetMapping("/products/top") //work - 3.29ms -all stores
    public ResponseEntity<List<Map<String, Object>>> getTopProducts(
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getTopProducts(user, category, limit));
    }

    @GetMapping("/products/top/export") //works, all stores
    public void exportTopProducts(
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "100") int limit,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            HttpServletResponse response) {
        User user = userDetails.getUser();
        List<Map<String, Object>> products = pizzaService.getTopProducts(user, category, limit);
        
        if (products.isEmpty()) {
            CsvExportUtil.writeCsv(response, List.of("No Data"), List.of(), "top-products.csv");
            return;
        }

        List<String> headers = List.copyOf(products.get(0).keySet());
        List<List<String>> rows = products.stream()
                .map(row -> headers.stream().map(h -> String.valueOf(row.get(h))).toList())
                .toList();

        CsvExportUtil.writeCsv(response, headers, rows, "top-products.csv");
    }

    // =================================================================
    // STORES - Role-based
    // =================================================================

    @GetMapping("/stores") //works, all stores
    public ResponseEntity<List<Map<String, Object>>> getStores(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getStores(user));
    }

    @GetMapping("/stores/export") //works, exports all stores to csv
    public void exportStores(@AuthenticationPrincipal CustomUserDetails userDetails,
            HttpServletResponse response) {
        User user = userDetails.getUser();
        List<Map<String, Object>> stores = pizzaService.getStores(user);
        
        if (stores.isEmpty()) {
            CsvExportUtil.writeCsv(response, List.of("No Data"), List.of(), "stores.csv");
            return;
        }

        List<String> headers = List.copyOf(stores.get(0).keySet());
        List<List<String>> rows = stores.stream()
                .map(row -> headers.stream().map(h -> String.valueOf(row.get(h))).toList())
                .toList();

        CsvExportUtil.writeCsv(response, headers, rows, "stores.csv");
    }


    @GetMapping("/profile") //works, gives out user profile
    public ResponseEntity<Map<String, Object>> getUserProfile(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(Map.of(
                "username", user.getUsername(),
                "role", user.getRole(),
                "storeId", user.getStoreId() != null ? user.getStoreId() : "",
                "state", user.getStateAbbr() != null ? user.getStateAbbr() : ""));
    }

    // =================================================================
    // ADDITIONAL DASHBOARD ANALYTICS - Enhanced Data
    // =================================================================

    @GetMapping("/analytics/revenue/by-store") //works
    public ResponseEntity<List<Map<String, Object>>> getRevenueByStore(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getRevenueByStore(user));
    }

    @GetMapping("/analytics/store-performance") //works but same as above
    public ResponseEntity<List<Map<String, Object>>> getStorePerformance(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getStorePerformance(user));
    }

    // =================================================================
    // COMPREHENSIVE ANALYTICS - Advanced Business Intelligence
    // =================================================================

    @GetMapping("/analytics/hourly-performance")
    public ResponseEntity<List<Map<String, Object>>> getHourlyPerformanceAnalytics(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getHourlyPerformanceAnalytics(user));
    }

    @GetMapping("/analytics/product-performance")
    public ResponseEntity<List<Map<String, Object>>> getProductPerformanceAnalytics(
            @RequestParam(required = false) String category,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getProductPerformanceAnalytics(user, category, null));
    }

    @GetMapping("/analytics/category-performance")
    public ResponseEntity<List<Map<String, Object>>> getCategoryPerformanceAnalytics(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getCategoryPerformanceAnalytics(user));
    }

    @GetMapping("/analytics/customer-acquisition")
    public ResponseEntity<List<Map<String, Object>>> getCustomerAcquisitionAnalytics(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getCustomerAcquisitionAnalytics(user));
    }

    @GetMapping("/analytics/daily-trends")
    public ResponseEntity<List<Map<String, Object>>> getDailyRevenueTrends(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getDailyRevenueTrends(user));
    }

    @GetMapping("/analytics/monthly-trends")
    public ResponseEntity<List<Map<String, Object>>> getMonthlyRevenueTrends(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getMonthlyRevenueTrends(user));
    }

    @GetMapping("/analytics/store-comparison")
    public ResponseEntity<List<Map<String, Object>>> getStorePerformanceComparison(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getStorePerformanceComparison(user));
    }
    
    @GetMapping("/analytics/state-comparison")
    public ResponseEntity<List<Map<String, Object>>> getStateRevenueTrends(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getStateRevenueTrends(user));
    }

    // Export endpoints for comprehensive analytics
    @GetMapping("/analytics/hourly-performance/export")
    public void exportHourlyPerformanceAnalytics(
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            HttpServletResponse response) {
        User user = userDetails.getUser();
        List<Map<String, Object>> data = pizzaService.getHourlyPerformanceAnalytics(user, year, month);
        
        if (data.isEmpty()) {
            CsvExportUtil.writeCsv(response, List.of("No Data"), List.of(), "hourly-performance.csv");
            return;
        }

        List<String> headers = List.copyOf(data.get(0).keySet());
        List<List<String>> rows = data.stream()
                .map(row -> headers.stream().map(h -> String.valueOf(row.get(h))).toList())
                .toList();

        CsvExportUtil.writeCsv(response, headers, rows, "hourly-performance.csv");
    }

    @GetMapping("/analytics/product-performance/export")
    public void exportProductPerformanceAnalytics(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(defaultValue = "100") Integer limit,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            HttpServletResponse response) {
        User user = userDetails.getUser();
        List<Map<String, Object>> data = pizzaService.getProductPerformanceAnalytics(user, category, year, month, limit);
        
        if (data.isEmpty()) {
            CsvExportUtil.writeCsv(response, List.of("No Data"), List.of(), "product-performance.csv");
            return;
        }

        List<String> headers = List.copyOf(data.get(0).keySet());
        List<List<String>> rows = data.stream()
                .map(row -> headers.stream().map(h -> String.valueOf(row.get(h))).toList())
                .toList();

        CsvExportUtil.writeCsv(response, headers, rows, "product-performance.csv");
    }

    // =================================================================
    // HEALTH CHECK
    // =================================================================

    @GetMapping("/health") //works
    public ResponseEntity<Map<String, Object>> healthCheck() {
        return ResponseEntity.ok(Map.of(
                "status", "OK",
                "service", "Optimized Pizza API v2",
                "timestamp", java.time.LocalDateTime.now().toString()));
    }
}