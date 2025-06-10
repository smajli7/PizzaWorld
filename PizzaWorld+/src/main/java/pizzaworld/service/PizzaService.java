package pizzaworld.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import pizzaworld.model.User;
import pizzaworld.repository.PizzaRepo;

@Service
public class PizzaService {

    @Autowired
    private PizzaRepo pizzaRepo;

    /**
     * Gibt Dashboard-KPIs je nach Benutzerrolle zurück:
     * - HQ_ADMIN → global
     * - STATE_MANAGER → bundeslandspezifisch
     * - STORE_MANAGER → filialbezogen
     */
    public Map<String, Object> getDashboardKPIs(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> pizzaRepo.fetchGlobalKPIs();
            case "STATE_MANAGER" -> pizzaRepo.fetchStateKPIs(user.getStateAbbr());
            case "STORE_MANAGER" -> pizzaRepo.fetchStoreKPIs(user.getStoreId());
            default -> throw new AccessDeniedException("Unbekannte Rolle: Zugriff verweigert");
        };
    }

    /**
     * Gibt KPIs für eine bestimmte Filiale zurück, wenn:
     * - HQ_ADMIN
     * - STATE_MANAGER zuständig für das Bundesland der Filiale
     * - STORE_MANAGER für die eigene Filiale
     */
    public Map<String, Object> getStoreKPIs(String storeId, User user) {
        String role = user.getRole();
        String storeState = pizzaRepo.getStoreState(storeId);

        boolean isHQ = role.equals("HQ_ADMIN");
        boolean isStateManagerOfStore = role.equals("STATE_MANAGER") && user.getStateAbbr().equals(storeState);
        boolean isOwnStore = role.equals("STORE_MANAGER") && user.getStoreId().equals(storeId);

        if (isHQ || isStateManagerOfStore || isOwnStore) {
            return pizzaRepo.fetchStoreKPIs(storeId);
        }

        throw new AccessDeniedException("Zugriff auf diese Filiale nicht erlaubt");
    }

    /**
     * Gibt Umsatz-/Verkaufs-KPIs für einen Zeitraum zurück, je nach Rolle:
     * - HQ_ADMIN → alle Verkäufe
     * - STATE_MANAGER → Verkäufe im Bundesland
     * - STORE_MANAGER → Verkäufe der eigenen Filiale
     */
    public Map<String, Object> getSalesKPIs(LocalDate from, LocalDate to, User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> pizzaRepo.fetchSalesKPIs(from, to);
            case "STATE_MANAGER" -> pizzaRepo.fetchSalesKPIsByState(user.getStateAbbr(), from, to);
            case "STORE_MANAGER" -> pizzaRepo.fetchSalesKPIsByStore(user.getStoreId(), from, to);
            default -> throw new AccessDeniedException("Unbekannte Rolle: Zugriff verweigert");
        };
    }

    public List<Map<String, Object>> filterOrders(Map<String, String> params) {
        String customerId = params.get("customerId");
        String storeId = params.get("storeId");
        return pizzaRepo.dynamicOrderFilter(customerId, storeId);
    }

}
