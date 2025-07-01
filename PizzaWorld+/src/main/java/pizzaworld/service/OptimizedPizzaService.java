package pizzaworld.service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import pizzaworld.model.User;
import pizzaworld.repository.OptimizedPizzaRepo;
import pizzaworld.dto.DashboardKpiDto;

@Service
public class OptimizedPizzaService {

    @Autowired
    private OptimizedPizzaRepo repo;

    // =================================================================
    // DASHBOARD KPIs - Role-based using Materialized Views
    // =================================================================

    @Cacheable(value = "dashboardKPIs", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr")
    public DashboardKpiDto getDashboardKPIs(User user) {
        Map<String, Object> kpis = switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getHQKPIs();
            case "STATE_MANAGER" -> repo.getStateKPIs(user.getStateAbbr());
            case "STORE_MANAGER" -> repo.getStoreKPIs(user.getStoreId());
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };

        if (kpis == null || kpis.isEmpty()) {
            return new DashboardKpiDto(0.0, 0, 0.0, 0, 0);
        }

        return new DashboardKpiDto(
            ((Number) kpis.getOrDefault("revenue", 0)).doubleValue(),
            ((Number) kpis.getOrDefault("orders", 0)).intValue(),
            ((Number) kpis.getOrDefault("avg_order_value", 0)).doubleValue(),
            ((Number) kpis.getOrDefault("customers", 0)).intValue(),
            0 // Products count can be added to views if needed
        );
    }

    // =================================================================
    // REVENUE ANALYTICS - Role-based
    // =================================================================

    public List<Map<String, Object>> getRevenueByYear(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getRevenueByYearHQ();
            case "STATE_MANAGER" -> repo.getRevenueByYearState(user.getStateAbbr());
            case "STORE_MANAGER" -> repo.getRevenueByYearStore(user.getStoreId());
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    public List<Map<String, Object>> getRevenueByMonth(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getRevenueByMonthHQ();
            case "STATE_MANAGER" -> repo.getRevenueByMonthState(user.getStateAbbr());
            case "STORE_MANAGER" -> repo.getRevenueByMonthStore(user.getStoreId());
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    public List<Map<String, Object>> getRevenueByWeek(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getRevenueByWeekHQ();
            case "STATE_MANAGER" -> repo.getRevenueByWeekState(user.getStateAbbr());
            case "STORE_MANAGER" -> repo.getRevenueByWeekStore(user.getStoreId());
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    // =================================================================
    // ORDER ANALYTICS - Role-based
    // =================================================================

    public List<Map<String, Object>> getOrdersByMonth(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getOrdersByMonthHQ();
            case "STATE_MANAGER" -> repo.getOrdersByMonthState(user.getStateAbbr());
            case "STORE_MANAGER" -> repo.getOrdersByMonthStore(user.getStoreId());
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    // =================================================================
    // RECENT ORDERS - Role-based using Materialized Views
    // =================================================================

    @Cacheable(value = "recentOrders", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr + '_' + #limit")
    public List<Map<String, Object>> getRecentOrders(User user, int limit) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getRecentOrdersHQ(limit);
            case "STATE_MANAGER" -> repo.getRecentOrdersState(user.getStateAbbr(), limit);
            case "STORE_MANAGER" -> repo.getRecentOrdersStore(user.getStoreId(), limit);
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    // =================================================================
    // FILTERED ORDERS - Role-based with Pagination
    // =================================================================

    public Map<String, Object> getFilteredOrders(Map<String, String> params, User user, int page, int size) {
        String storeId = params.get("storeId");
        String customerId = params.get("customerId");
        String orderId = params.get("orderId");
        String nitems = params.get("nitems");
        String from = params.get("from");
        String to = params.get("to");
        String state = null;

        // Apply role-based access control
        switch (user.getRole()) {
            case "HQ_ADMIN":
                // HQ sees everything - no restrictions
                state = params.get("state");
                break;

            case "STATE_MANAGER":
                // State manager only sees their state
                if (storeId != null) {
                    String storeState = repo.getStoreState(storeId);
                    if (!user.getStateAbbr().equals(storeState)) {
                        throw new AccessDeniedException("No access to this store");
                    }
                }
                state = user.getStateAbbr();
                break;

            case "STORE_MANAGER":
                // Store manager only sees their store
                if (storeId != null && !user.getStoreId().equals(storeId)) {
                    throw new AccessDeniedException("Access only to your own store");
                }
                storeId = user.getStoreId();
                break;

            default:
                throw new AccessDeniedException("Unknown role: " + user.getRole());
        }

        // Parse integers safely
        Integer orderIdInt = parseIntSafe(orderId);
        Integer nitemsInt = parseIntSafe(nitems);

        // Calculate pagination
        int offset = page * size;

        // Get filtered results
        List<Map<String, Object>> orders = repo.getFilteredOrders(
            storeId, state, customerId, from, to, orderIdInt, nitemsInt, size, offset);

        // Get total count
        Long totalCount = repo.countFilteredOrders(
            storeId, state, customerId, from, to, orderIdInt, nitemsInt);

        // Return paginated result
        Map<String, Object> result = new HashMap<>();
        result.put("orders", orders);
        result.put("totalCount", totalCount);
        result.put("totalPages", (int) Math.ceil((double) totalCount / size));
        result.put("currentPage", page);
        result.put("pageSize", size);
        result.put("hasNext", page < Math.ceil((double) totalCount / size) - 1);
        result.put("hasPrevious", page > 0);

        return result;
    }

    // =================================================================
    // PRODUCT ANALYTICS - Role-based
    // =================================================================

    public List<Map<String, Object>> getTopProducts(User user, String category, int limit) {
        String storeId = null;
        String state = null;

        switch (user.getRole()) {
            case "HQ_ADMIN":
                // No restrictions
                break;
            case "STATE_MANAGER":
                state = user.getStateAbbr();
                break;
            case "STORE_MANAGER":
                storeId = user.getStoreId();
                break;
            default:
                throw new AccessDeniedException("Unknown role: " + user.getRole());
        }

        return repo.getTopProducts(storeId, state, category, limit);
    }

    // =================================================================
    // STORES - Role-based
    // =================================================================

    public List<Map<String, Object>> getStores(User user) {
        String state = null;
        String storeId = null;

        switch (user.getRole()) {
            case "HQ_ADMIN":
                // No restrictions
                break;
            case "STATE_MANAGER":
                state = user.getStateAbbr();
                break;
            case "STORE_MANAGER":
                storeId = user.getStoreId();
                break;
            default:
                throw new AccessDeniedException("Unknown role: " + user.getRole());
        }

        return repo.getStores(state, storeId);
    }

    // =================================================================
    // SALES KPIs for Date Range - Role-based
    // =================================================================

    public Map<String, Object> getSalesKPIsForDateRange(LocalDate from, LocalDate to, User user) {
        String state = null;
        String storeId = null;

        switch (user.getRole()) {
            case "HQ_ADMIN":
                // No restrictions
                break;
            case "STATE_MANAGER":
                state = user.getStateAbbr();
                break;
            case "STORE_MANAGER":
                storeId = user.getStoreId();
                break;
            default:
                throw new AccessDeniedException("Unknown role: " + user.getRole());
        }

        return repo.getSalesKPIsForDateRange(from, to, state, storeId);
    }

    public List<Map<String, Object>> getSalesTrendForDateRange(LocalDate from, LocalDate to, User user) {
        String state = null;
        String storeId = null;

        switch (user.getRole()) {
            case "HQ_ADMIN":
                // No restrictions
                break;
            case "STATE_MANAGER":
                state = user.getStateAbbr();
                break;
            case "STORE_MANAGER":
                storeId = user.getStoreId();
                break;
            default:
                throw new AccessDeniedException("Unknown role: " + user.getRole());
        }

        return repo.getSalesTrendForDateRange(from, to, state, storeId);
    }

    // =================================================================
    // ADDITIONAL ANALYTICS - Enhanced Dashboard Data
    // =================================================================

    @Cacheable(value = "revenueByStore", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr")
    public List<Map<String, Object>> getRevenueByStore(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getStorePerformanceHQ();
            case "STATE_MANAGER" -> repo.getStorePerformanceState(user.getStateAbbr());
            case "STORE_MANAGER" -> {
                // For store manager, return just their store's performance
                List<Map<String, Object>> result = repo.getStorePerformance(user.getStoreId());
                yield result;
            }
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    @Cacheable(value = "storePerformance", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr")
    public List<Map<String, Object>> getStorePerformance(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getStorePerformanceHQ();
            case "STATE_MANAGER" -> repo.getStorePerformanceState(user.getStateAbbr());
            case "STORE_MANAGER" -> repo.getStorePerformance(user.getStoreId());
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    @Cacheable(value = "customerAcquisition", key = "#user.role + '_' + #user.stateAbbr")
    public List<Map<String, Object>> getCustomerAcquisition(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getCustomerAcquisitionHQ();
            case "STATE_MANAGER" -> repo.getCustomerAcquisitionState(user.getStateAbbr());
            case "STORE_MANAGER" -> {
                // Store managers see state-level data (can't track acquisition by store effectively)
                String storeState = repo.getStoreState(user.getStoreId());
                yield repo.getCustomerAcquisitionState(storeState);
            }
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    @Cacheable(value = "categoryPerformance", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr")
    public List<Map<String, Object>> getCategoryPerformance(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getCategoryPerformanceHQ();
            case "STATE_MANAGER" -> repo.getCategoryPerformanceState(user.getStateAbbr());
            case "STORE_MANAGER" -> repo.getCategoryPerformanceStore(user.getStoreId());
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    // =================================================================
    // SALES ANALYTICS WITH DATE RANGES - Enhanced Legacy Compatibility
    // =================================================================

    public List<Map<String, Object>> getBestSellingProducts(User user, String from, String to) {
        // For now, use the existing product analytics but could be enhanced with date filtering
        return getTopProducts(user, null, 20);
    }

    public List<Map<String, Object>> getStoresByRevenue(User user, String from, String to) {
        // Return store performance data (already includes revenue ranking)
        return getStorePerformance(user);
    }

    public List<Map<String, Object>> getSalesTrendByDay(User user, String from, String to) {
        // Convert string dates to LocalDate and use existing method
        try {
            LocalDate fromDate = LocalDate.parse(from);
            LocalDate toDate = LocalDate.parse(to);
            return getSalesTrendForDateRange(fromDate, toDate, user);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid date format. Use YYYY-MM-DD");
        }
    }

    public List<Map<String, Object>> getRevenueByCategory(User user, String from, String to) {
        // For now, return category performance (could be enhanced with date filtering)
        return getCategoryPerformance(user);
    }

    // =================================================================
    // CONSOLIDATED DASHBOARD PAYLOAD
    // =================================================================
    public pizzaworld.dto.ConsolidatedDto getConsolidatedPayload(User user) {
        // Fetch required slices via existing role-aware helpers
        pizzaworld.dto.DashboardKpiDto global = getDashboardKPIs(user);
        List<Map<String, Object>> revMonth = getRevenueByMonth(user);
        List<Map<String, Object>> ordMonth = getOrdersByMonth(user);
        List<Map<String, Object>> revStore = getRevenueByStore(user);
        List<Map<String, Object>> topProds = getTopProducts(user, null, 10);

        return new pizzaworld.dto.ConsolidatedDto(global, revMonth, ordMonth, revStore, topProds);
    }

    // =================================================================
    // UTILITY METHODS
    // =================================================================

    private Integer parseIntSafe(String value) {
        try {
            return value != null && !value.trim().isEmpty() ? Integer.parseInt(value) : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}