package pizzaworld.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import pizzaworld.model.Order;
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
            default -> throw new AccessDeniedException("Unknown role");
        };
    }

    public Map<String, Object> getStoreKPIs(String storeId, User user) {
        String role = user.getRole();
        if (role.equals("HQ_ADMIN") ||
                (role.equals("STATE_MANAGER") && user.getStateAbbr().equals(pizzaRepo.getStoreState(storeId))) ||
                (role.equals("STORE_MANAGER") && user.getStoreId().equals(storeId))) {
            return pizzaRepo.fetchStoreKPIs(storeId);
        }
        ;
        throw new AccessDeniedException("Unauthorized");
    }

    public Map<String, Object> getSalesKPIs(LocalDate from, LocalDate to, User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> pizzaRepo.fetchSalesKPIs(from, to);
            case "STATE_MANAGER" -> pizzaRepo.fetchSalesKPIsByState(user.getStateAbbr(), from, to);
            case "STORE_MANAGER" -> pizzaRepo.fetchSalesKPIsByStore(user.getStoreId(), from, to);
            default -> throw new AccessDeniedException("Unknown role");
        };
    }

    public List<Order> filterOrders(Map<String, String> params) {
        String customerId = params.getOrDefault("customerId", null);
        String storeId = params.getOrDefault("storeId", null);
        return pizzaRepo.dynamicOrderFilter(customerId, storeId);
    }
}
