package pizzaworld.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import pizzaworld.model.CustomUserDetails;
import pizzaworld.model.User;
import pizzaworld.repository.PizzaRepo;
import pizzaworld.dto.DashboardKpiDto;

@Service
public class PizzaService {

    @Autowired
    private PizzaRepo pizzaRepo;

    @Cacheable(value = "dashboardKPIs", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr")
    public DashboardKpiDto getDashboardKPIs(User user) {
        Map<String, Object> raw;
        if ("STORE_MANAGER".equals(user.getRole())) {
            Map<String, Object> arr = pizzaRepo.fetchStoreKPIs(user.getStoreId());
            raw = new HashMap<>();
            if (arr != null && !arr.isEmpty()) {
                raw.put("revenue", arr.get("revenue"));
                raw.put("orders", arr.get("orders"));
                raw.put("avg_order", arr.get("avg_order"));
                raw.put("customers", arr.get("customers"));
                raw.put("products", arr.get("products"));
            } else {
                raw.put("revenue", 0);
                raw.put("orders", 0);
                raw.put("avg_order", 0);
                raw.put("customers", 0);
                raw.put("products", 0);
            }
        } else if ("HQ_ADMIN".equals(user.getRole())) {
            raw = pizzaRepo.fetchGlobalKPIs();
        } else if ("STATE_MANAGER".equals(user.getRole())) {
            raw = pizzaRepo.fetchStateKPIs(user.getStateAbbr());
        } else {
            throw new AccessDeniedException("Unbekannte Rolle: Zugriff verweigert");
        }
        return new DashboardKpiDto(
            ((Number) raw.getOrDefault("revenue", 0)).doubleValue(),
            ((Number) raw.getOrDefault("orders", 0)).intValue(),
            ((Number) raw.getOrDefault("avg_order", 0)).doubleValue(),
            ((Number) raw.getOrDefault("customers", 0)).intValue(),
            ((Number) raw.getOrDefault("products", 0)).intValue()
        );
    }

    public Map<String, Object> getStoreKPIs(String storeId, CustomUserDetails user) {
        User realUser = user.getUser();
        String role = realUser.getRole();
        String storeState = pizzaRepo.getStoreState(storeId);

        if (storeState == null) {
            throw new IllegalArgumentException("Store with ID '" + storeId + "' does not exist.");
        }

        boolean isHQ = role.equals("HQ_ADMIN");
        boolean isStateManagerOfStore = role.equals("STATE_MANAGER") && realUser.getStateAbbr().equals(storeState);
        boolean isOwnStore = role.equals("STORE_MANAGER") && realUser.getStoreId().equals(storeId);

        if (!(isHQ || isStateManagerOfStore || isOwnStore)) {
            throw new AccessDeniedException("Zugriff auf diese Filiale nicht erlaubt");
        }

        System.out.println("🔍 DEBUG: Querying store KPIs for storeId: '" + storeId + "'");
        System.out.println("🔍 DEBUG: Store state: " + storeState);
        System.out.println("🔍 DEBUG: User role: " + role);
        System.out.println("🔍 DEBUG: User storeId: " + realUser.getStoreId());
        
        // Test query to see if there are any orders at all
        try {
            Integer totalOrders = pizzaRepo.countOrdersByStore(storeId);
            System.out.println("🔍 DEBUG: Total orders for store " + storeId + ": " + totalOrders);
            
            // Check if there are any orders at all in the database
            List<Map<String, Object>> allStores = pizzaRepo.findAllStores();
            System.out.println("🔍 DEBUG: Total stores in database: " + allStores.size());
            
            // Check if the store exists in the stores table
            boolean storeExists = allStores.stream().anyMatch(s -> s.get("storeid").equals(storeId));
            System.out.println("🔍 DEBUG: Store exists in stores table: " + storeExists);
            
            // Check a few sample orders to see the data structure
            List<Map<String, Object>> sampleOrders = pizzaRepo.dynamicOrderFilter(storeId, null, null, null, null, null, null);
            System.out.println("🔍 DEBUG: Sample orders for store " + storeId + ": " + sampleOrders.size());
            if (!sampleOrders.isEmpty()) {
                System.out.println("🔍 DEBUG: First order sample: " + sampleOrders.get(0));
            }
            
            // Debug query to check actual orders data
            Map<String, Object> debugOrders = pizzaRepo.debugStoreOrders(storeId);
            System.out.println("🔍 DEBUG: Debug orders data: " + debugOrders);
            
            // Direct check of the KPI query components
            System.out.println("🔍 DEBUG: About to execute fetchStoreKPIs with storeId: '" + storeId + "'");
            
            // Simple test query
            Long simpleCount = pizzaRepo.simpleOrderCount(storeId);
            System.out.println("🔍 DEBUG: Simple order count: " + simpleCount);
            
        } catch (Exception e) {
            System.err.println("🔍 DEBUG: Error in debug queries: " + e.getMessage());
            e.printStackTrace();
        }
        
        Map<String, Object> rawKpis = pizzaRepo.fetchStoreKPIs(storeId);
        System.out.println("🔍 DEBUG: Raw KPI result: " + rawKpis);
        
        Map<String, Object> kpis = new HashMap<>();
        if (rawKpis != null && !rawKpis.isEmpty()) {
            kpis.put("revenue", ((Number) rawKpis.get("revenue")).doubleValue());
            kpis.put("orders", ((Number) rawKpis.get("orders")).intValue());
            kpis.put("avg_order", ((Number) rawKpis.get("avg_order")).doubleValue());
            kpis.put("customers", ((Number) rawKpis.get("customers")).intValue());
            kpis.put("products", ((Number) rawKpis.get("products")).intValue());
        } else {
            kpis.put("revenue", 0);
            kpis.put("orders", 0);
            kpis.put("avg_order", 0);
            kpis.put("customers", 0);
            kpis.put("products", 0);
        }
        
        System.out.println("🔍 DEBUG: Final KPIs map: " + kpis);

        Map<String, Object> best = null;
        Map<String, Object> worst = null;
        List<Map<String, Object>> topProductList = new ArrayList<>();
        List<Map<String, Object>> worstProductList = new ArrayList<>();

        // Try to fetch product stats, but bypass errors
        try {
            best = pizzaRepo.fetchTopProductByStore(storeId);
            if (best == null) best = Map.of("sku", "", "name", "No data", "size", "", "total_sold", 0);
            else best = Map.of(
                "sku", best.get("sku"),
                "name", best.get("name"),
                "size", best.get("size"),
                "total_sold", best.get("total_sold")
            );
            worst = pizzaRepo.fetchWorstProductByStore(storeId);
            if (worst == null) worst = Map.of("sku", "", "name", "No data", "size", "", "total_sold", 0);
            else worst = Map.of(
                "sku", worst.get("sku"),
                "name", worst.get("name"),
                "size", worst.get("size"),
                "total_sold", worst.get("total_sold")
            );

            // Check if store has any orders first
            Integer orderCount = pizzaRepo.countOrdersByStore(storeId);
            System.out.println("\uD83D\uDCE6 Store " + storeId + " has " + orderCount + " orders");

            if (orderCount != null && orderCount > 0) {
                // Get all products by revenue for this store
                List<Map<String, Object>> allProducts = pizzaRepo.fetchRevenuePerProductByStore(storeId);
                if (allProducts != null && !allProducts.isEmpty()) {
                    topProductList = allProducts.stream()
                            .limit(3)
                            .map(product -> Map.of(
                                "sku", product.getOrDefault("sku", ""),
                                "name", product.getOrDefault("name", "No data available"),
                                "size", product.getOrDefault("size", "")
                            ))
                            .toList();
                } else {
                    topProductList = List.of(Map.of("sku", "", "name", "No data available", "size", ""));
                }
                // Get products by quantity sold to determine worst performers
                List<Map<String, Object>> productsByQuantity = pizzaRepo.fetchProductsByQuantitySold(storeId);
                if (productsByQuantity != null && !productsByQuantity.isEmpty()) {
                    worstProductList = productsByQuantity.stream()
                            .skip(Math.max(0, productsByQuantity.size() - 3))
                            .map(product -> Map.of(
                                "sku", product.getOrDefault("sku", ""),
                                "name", product.getOrDefault("name", "No data available"),
                                "size", product.getOrDefault("size", "")
                            ))
                            .toList();
                } else {
                    worstProductList = List.of(Map.of("sku", "", "name", "No data available", "size", ""));
                }
            } else {
                topProductList = List.of(Map.of("sku", "", "name", "No data available", "size", ""));
                worstProductList = List.of(Map.of("sku", "", "name", "No data available", "size", ""));
            }
        } catch (Exception e) {
            System.err.println("[WARN] Could not fetch product stats for store " + storeId + ": " + e.getMessage());
            best = Map.of("sku", "", "name", "No data", "size", "", "total_sold", 0);
            worst = Map.of("sku", "", "name", "No data", "size", "", "total_sold", 0);
            topProductList = List.of();
            worstProductList = List.of();
        }

        Map<String, Object> result = new HashMap<>();
        result.put("kpis", kpis);
        result.put("best", best);
        result.put("worst", worst);
        result.put("topProducts", topProductList);
        result.put("worstProducts", worstProductList);

        return result;
    }

    public Map<String, Object> getSalesKPIs(LocalDate from, LocalDate to, User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> pizzaRepo.fetchSalesKPIs(from, to);
            case "STATE_MANAGER" -> pizzaRepo.fetchSalesKPIsByState(user.getStateAbbr(), from, to);
            case "STORE_MANAGER" -> pizzaRepo.fetchSalesKPIsByStore(user.getStoreId(), from, to);
            default -> throw new AccessDeniedException("Unbekannte Rolle: Zugriff verweigert");
        };
    }

    public List<Map<String, Object>> dynamicOrderFilter(Map<String, String> params, User user) {
        String storeId = params.get("storeId");
        String customerId = params.get("customerId");
        String state = params.get("state"); // Optional manuell überschreibbar
        String orderId = params.get("orderId");
        String nitems = params.get("nitems");
        String from = params.get("from");
        String to = params.get("to");

        String userRole = user.getRole();
        String userState = user.getStateAbbr();
        String userStoreId = user.getStoreId();

        // Rollenbasierte Zugriffskontrolle
        switch (userRole) {
            case "HQ_ADMIN":
                // HQ sieht alles
                break;

            case "STATE_MANAGER":
                if (storeId != null) {
                    String storeState = pizzaRepo.getStoreState(storeId);
                    if (!userState.equals(storeState)) {
                        throw new AccessDeniedException("Kein Zugriff auf diesen Store");
                    }
                }
                // Zugriff auf kompletten Staat
                state = userState;
                break;

            case "STORE_MANAGER":
                if (storeId != null && !userStoreId.equals(storeId)) {
                    throw new AccessDeniedException("Zugriff nur auf deinen eigenen Store erlaubt");
                }
                storeId = userStoreId;
                state = null; // wird nicht benötigt
                break;

            default:
                throw new AccessDeniedException("Unbekannte Rolle");
        }

        // Typensicherheit für Integers
        Integer orderIdInt = parseIntSafe(orderId);
        Integer nitemsInt = parseIntSafe(nitems);

        // Query an Repository weiterreichen
        return pizzaRepo.dynamicOrderFilter(
                storeId,
                customerId,
                state,
                from,
                to,
                orderIdInt,
                nitemsInt);
    }

    private Integer parseIntSafe(String value) {
        try {
            return value != null ? Integer.parseInt(value) : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public List<Map<String, Object>> filterProducts(Map<String, String> params, User user) {
        String requestedStoreId = params.get("storeId");
        String category = params.get("category");

        System.out.println("🧾 USER: " + user.getUsername());
        System.out.println("🎭 ROLLE: " + user.getRole());
        System.out.println("📦 PARAMS: " + params);

        switch (user.getRole()) {
            case "HQ_ADMIN":
                // HQ sieht alles – keine Einschränkung
                return pizzaRepo.dynamicProductFilter(null, null, category);

            case "STATE_MANAGER":
                // Wenn Store angegeben, prüfen ob er im eigenen Bundesland liegt
                if (requestedStoreId != null) {
                    String storeState = pizzaRepo.getStoreState(requestedStoreId);
                    if (!user.getStateAbbr().equals(storeState)) {
                        throw new AccessDeniedException("Keine Berechtigung für diesen Store");
                    }
                }
                // Zugriff auf State-bezogene Produkte, ggf. eingeschränkt auf Store
                return pizzaRepo.dynamicProductFilter(requestedStoreId, user.getStateAbbr(), category);

            case "STORE_MANAGER":
                // Zugriff nur auf eigene Filiale
                if (requestedStoreId != null && !user.getStoreId().equals(requestedStoreId)) {
                    throw new AccessDeniedException("Du darfst nur deine eigene Filiale sehen");
                }
                return pizzaRepo.dynamicProductFilter(user.getStoreId(), null, category);

            default:
                throw new AccessDeniedException("Unbekannte Rolle");
        }
    }

    public Map<String, Object> getProductDetails(String sku) {
        return pizzaRepo.fetchProductDetails(sku);
    }

    public List<Map<String, Object>> getRevenuePerProduct(String storeId) {
        return pizzaRepo.fetchRevenuePerProductByStore(storeId);
    }

    public Map<String, Object> getTopProductsByStore(String storeId) {
        Map<String, Object> best = pizzaRepo.fetchTopProductByStore(storeId);
        Map<String, Object> worst = pizzaRepo.fetchWorstProductByStore(storeId);
        return Map.of("best", best, "worst", worst);
    }

    public List<Map<String, Object>> getAllStores(User user) {
    String role = user.getRole();
    String storeId = user.getStoreId();
    String state = user.getStateAbbr();

    return switch (role) {
        case "HQ_ADMIN" -> pizzaRepo.findAllStores();
        case "STATE_MANAGER" -> pizzaRepo.findStoresByState(state);
        case "STORE_MANAGER" -> List.of(pizzaRepo.findStoreById(storeId));
        default -> throw new AccessDeniedException("Unbekannte Rolle: " + role);
    };
}



    public List<Map<String, Object>> fetchWeeklyOrderTrend(LocalDate from, LocalDate to, User user) {
    String role = user.getRole();
    String storeId = null;
    String state = null;

    switch (role) {
        case "HQ_ADMIN":
            break;
        case "STATE_MANAGER":
            state = user.getStateAbbr();
            break;
        case "STORE_MANAGER":
            storeId = user.getStoreId();
            break;
        default:
            throw new AccessDeniedException("Unbekannte Rolle");
    }

    return pizzaRepo.fetchWeeklyOrderTrend(from, to, state, storeId);
}

    public List<Map<String, Object>> getRevenueByStore(User user) {
        switch (user.getRole()) {
            case "HQ_ADMIN":
            case "STATE_MANAGER":
                return pizzaRepo.fetchRevenueByStore();
            case "STORE_MANAGER":
                // Only return revenue for the manager's own store
                String storeId = user.getStoreId();
                List<Map<String, Object>> all = pizzaRepo.fetchRevenueByStore();
                return all.stream().filter(m -> m.get("name") != null && m.get("name").equals(user.getStoreId())).toList();
            default:
                throw new AccessDeniedException("Unbekannte Rolle: Zugriff verweigert");
        }
    }

    // 📈 KPI Methods for Charts
    public List<Map<String, Object>> getStoresPerDay() {
        return pizzaRepo.fetchStoresPerDay();
    }

    public List<Map<String, Object>> getSalesPerDay() {
        return pizzaRepo.fetchSalesPerDay();
    }

    public List<Map<String, Object>> getOrdersPerDay() {
        return pizzaRepo.fetchOrdersPerDay();
    }

}