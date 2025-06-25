package pizzaworld.service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import pizzaworld.dto.DashboardKpiDto;
import pizzaworld.dto.SalesKpiDto;
import pizzaworld.model.CustomUserDetails;
import pizzaworld.model.User;
import pizzaworld.repository.PizzaRepo;

@Service
public class PizzaService {

    private final PizzaRepo repo;

    public PizzaService(PizzaRepo repo) {
        this.repo = repo;
    }

    /* ───────────────────────── Dashboard KPIs ───────────────────────── */
    public DashboardKpiDto getDashboardKPIs(User user) {
        Map<String, Object> m = switch (user.getRole()) {
            case "HQ_ADMIN"      -> repo.fetchGlobalKPIs();
            case "STATE_MANAGER" -> repo.fetchStateKPIs(user.getStateAbbr());
            case "STORE_MANAGER" -> repo.fetchStoreKPIs(user.getStoreId());
            default -> throw new AccessDeniedException("Unbekannte Rolle");
        };

        return new DashboardKpiDto(
            dbl(m, "revenue"),
            lng(m, "orders"),
            dbl(m, "avg_order"),
            lng(m, "customers"),
            lng(m, "products")
        );
    }

<<<<<<< Updated upstream
    /* ───────────────────────── Store KPIs ───────────────────────── */
    public DashboardKpiDto getStoreKPIs(String storeId, CustomUserDetails principal) {
        User u = principal.getUser();
        String role = u.getRole();
        String storeState = repo.getStoreState(storeId);

        boolean allowed =
               role.equals("HQ_ADMIN")
            || (role.equals("STATE_MANAGER") && u.getStateAbbr().equals(storeState))
            || (role.equals("STORE_MANAGER") && u.getStoreId().equals(storeId));

        if (!allowed) {
            throw new AccessDeniedException("Keine Berechtigung für diesen Store");
=======
        if (isHQ || isStateManagerOfStore || isOwnStore) {
            Map<String, Object> kpis = pizzaRepo.fetchStoreKPIs(storeId);
            Map<String, Object> best = pizzaRepo.fetchTopProductByStore(storeId);
            Map<String, Object> worst = pizzaRepo.fetchWorstProductByStore(storeId);

            return Map.of(
                    "kpis", kpis,
                    "best", best,
                    "worst", worst);
>>>>>>> Stashed changes
        }

        Map<String, Object> m = repo.fetchStoreKPIs(storeId);
        return new DashboardKpiDto(
            dbl(m, "revenue"),
            lng(m, "orders"),
            dbl(m, "avg_order"),
            lng(m, "customers"),
            lng(m, "products")
        );
    }

    /* ───────────────────────── Sales KPIs (Zeitintervall) ───────────────────────── */
    public SalesKpiDto getSalesKPIs(LocalDate from, LocalDate to, User user) {
        Map<String, Object> m = switch (user.getRole()) {
            case "HQ_ADMIN"      -> repo.fetchSalesKPIs(from, to);
            case "STATE_MANAGER" -> repo.fetchSalesKPIsByState(user.getStateAbbr(), from, to);
            case "STORE_MANAGER" -> repo.fetchSalesKPIsByStore(user.getStoreId(), from, to);
            default -> throw new AccessDeniedException("Unbekannte Rolle");
        };

        return new SalesKpiDto(
            dbl(m, "revenue"),
            lng(m, "total_orders"),
            lng(m, "unique_customers"),
            dbl(m, "avg_order")
        );
    }

    /* ───────────────────────── Orders Filter ───────────────────────── */
    public List<Map<String, Object>> filterOrders(Map<String, String> params, User user) {
        String requestedStoreId = params.get("storeId");
        String customerId       = params.get("customerId");

        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.dynamicOrderFilter(customerId, requestedStoreId);

            case "STATE_MANAGER" -> {
                if (requestedStoreId == null) {
                    yield repo.dynamicOrderFilterByState(user.getStateAbbr(), customerId);
                }
                String storeState = repo.getStoreState(requestedStoreId);
                if (!user.getStateAbbr().equals(storeState)) {
                    throw new AccessDeniedException("Keine Berechtigung für diesen Store");
                }
                yield repo.dynamicOrderFilter(customerId, requestedStoreId);
            }

            case "STORE_MANAGER" -> {
                if (requestedStoreId != null && !user.getStoreId().equals(requestedStoreId)) {
                    throw new AccessDeniedException("Du darfst nur deine eigene Filiale sehen");
                }
                yield repo.dynamicOrderFilter(customerId, user.getStoreId());
            }

            default -> throw new AccessDeniedException("Unbekannte Rolle");
        };
    }

<<<<<<< Updated upstream
    /* ───────────────────────── Hilfs-Caster ───────────────────────── */
    private static long   lng(Map<String,Object> m, String k) { return ((Number) m.get(k)).longValue(); }
    private static double dbl(Map<String,Object> m, String k) { return ((Number) m.get(k)).doubleValue(); }
=======
    public List<Map<String, Object>> filterProducts(Map<String, String> params, User user) {
        String requestedStoreId = params.get("storeId");
        String category = params.get("category");

        System.out.println("🧾 USER: " + user.getUsername());
        System.out.println("🎭 ROLLE: " + user.getRole());
        System.out.println("📦 PARAMS: " + params);

        switch (user.getRole()) {
            case "HQ_ADMIN":
                return pizzaRepo.dynamicProductFilter(requestedStoreId, category);

            case "STATE_MANAGER":
                if (requestedStoreId != null) {
                    String storeState = pizzaRepo.getStoreState(requestedStoreId);
                    if (!user.getStateAbbr().equals(storeState)) {
                        throw new AccessDeniedException("Keine Berechtigung für diesen Store");
                    }
                }
                return pizzaRepo.dynamicProductFilterByState(user.getStateAbbr(), requestedStoreId, category);

            case "STORE_MANAGER":
                if (requestedStoreId != null && !user.getStoreId().equals(requestedStoreId)) {
                    throw new AccessDeniedException("Du darfst nur deine eigene Filiale sehen");
                }
                return pizzaRepo.dynamicProductFilter(user.getStoreId(), category);

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

>>>>>>> Stashed changes
}
