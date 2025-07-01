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
    // GLOBAL STORE KPIs - Materialized View Access
    // =================================================================

    @GetMapping("/kpis/global-store") //works but is the same as above somewehere
    public ResponseEntity<List<Map<String, Object>>> getGlobalStoreKPIs(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getGlobalStoreKPIs(user));
    }

    @GetMapping("/kpis/global-store/export") //also works
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