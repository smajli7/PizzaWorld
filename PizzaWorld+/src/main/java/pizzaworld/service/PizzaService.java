package pizzaworld.service;

import java.time.LocalDate;
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

    /* ───────────────────────── Hilfs-Caster ───────────────────────── */
    private static long   lng(Map<String,Object> m, String k) { return ((Number) m.get(k)).longValue(); }
    private static double dbl(Map<String,Object> m, String k) { return ((Number) m.get(k)).doubleValue(); }
}
