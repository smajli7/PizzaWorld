package pizzaworld.service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import pizzaworld.model.CustomUserDetails;
import pizzaworld.model.User;
import pizzaworld.repository.PizzaRepo;

@Service
public class PizzaService {

    @Autowired
    private PizzaRepo pizzaRepo;

    public Map<String, Object> getDashboardKPIs(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> pizzaRepo.fetchGlobalKPIs();
            case "STATE_MANAGER" -> pizzaRepo.fetchStateKPIs(user.getStateAbbr());
            case "STORE_MANAGER" -> pizzaRepo.fetchStoreKPIs(user.getStoreId());
            default -> throw new AccessDeniedException("Unbekannte Rolle: Zugriff verweigert");
        };
    }

    public Map<String, Object> getStoreKPIs(String storeId, CustomUserDetails user) {
        User realUser = user.getUser();
        String role = realUser.getRole();
        String storeState = pizzaRepo.getStoreState(storeId);

        boolean isHQ = role.equals("HQ_ADMIN");
        boolean isStateManagerOfStore = role.equals("STATE_MANAGER") && realUser.getStateAbbr().equals(storeState);
        boolean isOwnStore = role.equals("STORE_MANAGER") && realUser.getStoreId().equals(storeId);

        if (!(isHQ || isStateManagerOfStore || isOwnStore)) {
            throw new AccessDeniedException("Zugriff auf diese Filiale nicht erlaubt");
        }

        Map<String, Object> kpis = pizzaRepo.fetchStoreKPIs(storeId);
        Map<String, Object> best = pizzaRepo.fetchTopProductByStore(storeId);
        Map<String, Object> worst = pizzaRepo.fetchWorstProductByStore(storeId);

        Map<String, Object> result = new HashMap<>();
        result.put("kpis", kpis);
        result.put("best", best);
        result.put("worst", worst);

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

    public List<Map<String, Object>> getAllStores() {
        return pizzaRepo.findAllStores();
    }
}