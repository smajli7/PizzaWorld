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

    @GetMapping("/dashboard/kpis")
    public ResponseEntity<DashboardKpiDto> getDashboardKPIs(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getDashboardKPIs(user));
    }

    @GetMapping("/dashboard/kpis/export")
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

    @GetMapping("/analytics/revenue/by-year")
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

    @GetMapping("/analytics/orders/by-month")
    public ResponseEntity<List<Map<String, Object>>> getOrdersByMonth(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getOrdersByMonth(user));
    }

    @GetMapping("/orders/recent")
    public ResponseEntity<List<Map<String, Object>>> getRecentOrders(
            @RequestParam(defaultValue = "50") int limit,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getRecentOrders(user, limit));
    }

    // =================================================================
    // FILTERED ORDERS - Enhanced with pagination
    // =================================================================

    @GetMapping("/orders")
    public ResponseEntity<Map<String, Object>> getFilteredOrders(
            @RequestParam Map<String, String> params,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getFilteredOrders(params, user, page, size));
    }

    @GetMapping("/orders/export")
    public void exportFilteredOrders(
            @RequestParam Map<String, String> params,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            HttpServletResponse response) {
        User user = userDetails.getUser();
        Map<String, Object> result = pizzaService.getFilteredOrders(params, user, 0, 10000);
        
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> orders = (List<Map<String, Object>>) result.get("orders");
        
        if (orders.isEmpty()) {
            CsvExportUtil.writeCsv(response, List.of("No Data"), List.of(), "orders.csv");
            return;
        }

        List<String> headers = List.copyOf(orders.get(0).keySet());
        List<List<String>> rows = orders.stream()
                .map(row -> headers.stream().map(h -> String.valueOf(row.get(h))).toList())
                .toList();

        CsvExportUtil.writeCsv(response, headers, rows, "orders.csv");
    }

    // =================================================================
    // PRODUCT ANALYTICS - Role-based
    // =================================================================

    @GetMapping("/products/top")
    public ResponseEntity<List<Map<String, Object>>> getTopProducts(
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getTopProducts(user, category, limit));
    }

    @GetMapping("/products/top/export")
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

    @GetMapping("/stores")
    public ResponseEntity<List<Map<String, Object>>> getStores(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getStores(user));
    }

    @GetMapping("/stores/export")
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

    // =================================================================
    // SALES KPIs for Date Range - Role-based
    // =================================================================

    @GetMapping("/sales/kpis")
    public ResponseEntity<Map<String, Object>> getSalesKPIs(
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getSalesKPIsForDateRange(from, to, user));
    }

    @GetMapping("/sales/trend")
    public ResponseEntity<List<Map<String, Object>>> getSalesTrend(
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getSalesTrendForDateRange(from, to, user));
    }

    @GetMapping("/sales/kpis/export")
    public void exportSalesKPIs(
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            HttpServletResponse response) {
        User user = userDetails.getUser();
        Map<String, Object> data = pizzaService.getSalesKPIsForDateRange(from, to, user);
        
        List<String> headers = List.of("Revenue", "Total Orders", "Unique Customers", "Avg Order");
        List<List<String>> rows = List.of(List.of(
                String.valueOf(data.get("revenue")),
                String.valueOf(data.get("total_orders")),
                String.valueOf(data.get("unique_customers")),
                String.valueOf(data.get("avg_order"))));
        
        CsvExportUtil.writeCsv(response, headers, rows, "sales-kpis.csv");
    }

    // =================================================================
    // USER PROFILE
    // =================================================================

    @GetMapping("/profile")
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

    @GetMapping("/analytics/revenue/by-store")
    public ResponseEntity<List<Map<String, Object>>> getRevenueByStore(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getRevenueByStore(user));
    }

    @GetMapping("/analytics/store-performance")
    public ResponseEntity<List<Map<String, Object>>> getStorePerformance(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getStorePerformance(user));
    }

    @GetMapping("/analytics/customer-acquisition")
    public ResponseEntity<List<Map<String, Object>>> getCustomerAcquisition(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getCustomerAcquisition(user));
    }

    @GetMapping("/analytics/category-performance")
    public ResponseEntity<List<Map<String, Object>>> getCategoryPerformance(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getCategoryPerformance(user));
    }

    @GetMapping("/analytics/best-selling-products")
    public ResponseEntity<List<Map<String, Object>>> getBestSellingProducts(
            @RequestParam String from,
            @RequestParam String to,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getBestSellingProducts(user, from, to));
    }

    @GetMapping("/analytics/stores-by-revenue")
    public ResponseEntity<List<Map<String, Object>>> getStoresByRevenue(
            @RequestParam String from,
            @RequestParam String to,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getStoresByRevenue(user, from, to));
    }

    @GetMapping("/analytics/sales-trend-by-day")
    public ResponseEntity<List<Map<String, Object>>> getSalesTrendByDay(
            @RequestParam String from,
            @RequestParam String to,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getSalesTrendByDay(user, from, to));
    }

    @GetMapping("/analytics/revenue-by-category")
    public ResponseEntity<List<Map<String, Object>>> getRevenueByCategory(
            @RequestParam String from,
            @RequestParam String to,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getRevenueByCategory(user, from, to));
    }

    // =================================================================
    // CONSOLIDATED HQ DASHBOARD ENDPOINT
    // =================================================================
    @GetMapping("/analytics/hq/consolidated")
    public ResponseEntity<pizzaworld.dto.ConsolidatedDto> getConsolidatedDashboard(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getConsolidatedPayload(user));
    }

    // =================================================================
    // HEALTH CHECK
    // =================================================================

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        return ResponseEntity.ok(Map.of(
                "status", "OK",
                "service", "Optimized Pizza API v2",
                "timestamp", java.time.LocalDateTime.now().toString()));
    }
}