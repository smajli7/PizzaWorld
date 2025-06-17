package pizzaworld.service;

import java.time.LocalDate;
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

        if (isHQ || isStateManagerOfStore || isOwnStore) {
            return pizzaRepo.fetchStoreKPIs(storeId);
        }

        throw new AccessDeniedException("Zugriff auf diese Filiale nicht erlaubt");
    }

    public Map<String, Object> getSalesKPIs(LocalDate from, LocalDate to, User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> pizzaRepo.fetchSalesKPIs(from, to);
            case "STATE_MANAGER" -> pizzaRepo.fetchSalesKPIsByState(user.getStateAbbr(), from, to);
            case "STORE_MANAGER" -> pizzaRepo.fetchSalesKPIsByStore(user.getStoreId(), from, to);
            default -> throw new AccessDeniedException("Unbekannte Rolle: Zugriff verweigert");
        };
    }

    public List<Map<String, Object>> filterOrders(Map<String, String> params, User user) {
        String requestedStoreId = params.get("storeId");
        String customerId = params.get("customerId");

        switch (user.getRole()) {
            case "HQ_ADMIN":
                return pizzaRepo.dynamicOrderFilter(customerId, requestedStoreId);

            case "STATE_MANAGER":
                if (requestedStoreId == null) {
                    return pizzaRepo.dynamicOrderFilterByState(user.getStateAbbr(), customerId);
                }

                String storeState = pizzaRepo.getStoreState(requestedStoreId);
                if (!user.getStateAbbr().equals(storeState)) {
                    throw new AccessDeniedException("Keine Berechtigung für diesen Store");
                }

                return pizzaRepo.dynamicOrderFilter(customerId, requestedStoreId);

            case "STORE_MANAGER":
                if (requestedStoreId != null && !user.getStoreId().equals(requestedStoreId)) {
                    throw new AccessDeniedException("Du darfst nur deine eigene Filiale sehen");
                }

                return pizzaRepo.dynamicOrderFilter(customerId, user.getStoreId());

            default:
                throw new AccessDeniedException("Unbekannte Rolle");
        }
    }
}
