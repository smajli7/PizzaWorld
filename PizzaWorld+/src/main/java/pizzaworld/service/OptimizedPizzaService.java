package pizzaworld.service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;

import pizzaworld.model.User;
import pizzaworld.repository.OptimizedPizzaRepo;
import pizzaworld.dto.DashboardKpiDto;
import pizzaworld.dto.KpisGlobalStoreDto;

@Service
public class OptimizedPizzaService {

    @Autowired
    private OptimizedPizzaRepo repo;

    @Autowired
    private JdbcTemplate jdbcTemplate;

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
    // GLOBAL STORE KPIs - Role-based access to kpis_global_store
    // =================================================================

    @Cacheable(value = "globalStoreKPIs", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr")
    public List<Map<String, Object>> getGlobalStoreKPIs(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getAllStoreKPIs();
            case "STATE_MANAGER" -> repo.getStoreKPIsByState(user.getStateAbbr());
            case "STORE_MANAGER" -> {
                Map<String, Object> storeKPI = repo.getStoreKPIs(user.getStoreId());
                yield storeKPI != null ? List.of(storeKPI) : List.of();
            }
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    // =================================================================
    // STORE REVENUE BY TIME PERIODS - Dynamic Chart API
    // =================================================================

    @Cacheable(value = "storeRevenueChart", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr + '_' + #timePeriod + '_' + #year + '_' + #month + '_' + #quarter")
    public List<Map<String, Object>> getStoreRevenueByTimePeriod(User user, String timePeriod, Integer year, Integer month, Integer quarter) {
        
        return switch (timePeriod.toLowerCase()) {
            case "all-time", "alltime" -> getStoreRevenueAllTime(user);
            case "year", "yearly" -> getStoreRevenueByYear(user, year);
            case "month", "monthly" -> getStoreRevenueByMonth(user, year, month);
            case "quarter", "quarterly" -> getStoreRevenueByQuarter(user, year, quarter);
            default -> throw new IllegalArgumentException("Invalid time period: " + timePeriod);
        };
    }

    private List<Map<String, Object>> getStoreRevenueAllTime(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getStoreRevenueAllTimeHQ();
            case "STATE_MANAGER" -> repo.getStoreRevenueAllTimeState(user.getStateAbbr());
            case "STORE_MANAGER" -> {
                Map<String, Object> storeData = repo.getStoreRevenueAllTimeStore(user.getStoreId());
                yield storeData != null ? List.of(storeData) : List.of();
            }
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    private List<Map<String, Object>> getStoreRevenueByYear(User user, Integer year) {
        if (year == null) {
            throw new IllegalArgumentException("Year is required for yearly revenue data");
        }
        
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getStoreRevenueByYearHQ(year);
            case "STATE_MANAGER" -> repo.getStoreRevenueByYearState(user.getStateAbbr(), year);
            case "STORE_MANAGER" -> {
                Map<String, Object> storeData = repo.getStoreRevenueByYearStore(user.getStoreId(), year);
                yield storeData != null ? List.of(storeData) : List.of();
            }
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    private List<Map<String, Object>> getStoreRevenueByMonth(User user, Integer year, Integer month) {
        if (year == null || month == null) {
            throw new IllegalArgumentException("Year and month are required for monthly revenue data");
        }
        
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getStoreRevenueByMonthHQ(year, month);
            case "STATE_MANAGER" -> repo.getStoreRevenueByMonthState(user.getStateAbbr(), year, month);
            case "STORE_MANAGER" -> {
                Map<String, Object> storeData = repo.getStoreRevenueByMonthStore(user.getStoreId(), year, month);
                yield storeData != null ? List.of(storeData) : List.of();
            }
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    private List<Map<String, Object>> getStoreRevenueByQuarter(User user, Integer year, Integer quarter) {
        if (year == null || quarter == null) {
            throw new IllegalArgumentException("Year and quarter are required for quarterly revenue data");
        }
        
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getStoreRevenueByQuarterHQ(year, quarter);
            case "STATE_MANAGER" -> repo.getStoreRevenueByQuarterState(user.getStateAbbr(), year, quarter);
            case "STORE_MANAGER" -> {
                Map<String, Object> storeData = repo.getStoreRevenueByQuarterStore(user.getStoreId(), year, quarter);
                yield storeData != null ? List.of(storeData) : List.of();
            }
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    @Cacheable(value = "storeRevenueCustomRange", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr + '_' + #startDate + '_' + #endDate")
    public List<Map<String, Object>> getStoreRevenueByDateRange(User user, String startDate, String endDate) {
        if (startDate == null || endDate == null) {
            throw new IllegalArgumentException("Start date and end date are required for custom date range");
        }
        
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getStoreRevenueByDateRangeHQ(startDate, endDate);
            case "STATE_MANAGER" -> repo.getStoreRevenueByDateRangeState(user.getStateAbbr(), startDate, endDate);
            case "STORE_MANAGER" -> {
                Map<String, Object> storeData = repo.getStoreRevenueByDateRangeStore(user.getStoreId(), startDate, endDate);
                yield storeData != null ? List.of(storeData) : List.of();
            }
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    // Utility methods for time period options
    @Cacheable(value = "availableYears", key = "'years'")
    public List<Map<String, Object>> getAvailableYears() {
        return repo.getAvailableYears();
    }

    @Cacheable(value = "availableMonths", key = "#year")
    public List<Map<String, Object>> getAvailableMonthsForYear(Integer year) {
        return repo.getAvailableMonthsForYear(year);
    }

    @Cacheable(value = "availableQuarters", key = "#year")
    public List<Map<String, Object>> getAvailableQuartersForYear(Integer year) {
        return repo.getAvailableQuartersForYear(year);
    }

    // =================================================================
    // FINAL STORE REVENUE CHART API - Production Ready
    // =================================================================

    @Cacheable(value = "storeRevenueChart", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr + '_' + #timePeriod + '_' + #year + '_' + #month")
    public List<Map<String, Object>> getStoreRevenueChart(User user, String timePeriod, Integer year, Integer month) {
        
        return switch (timePeriod.toLowerCase()) {
            case "all-time", "alltime" -> getStoreRevenueChartAllTime(user);
            case "year", "yearly" -> {
                if (year == null) throw new IllegalArgumentException("Year is required for yearly data");
                yield getStoreRevenueChartYear(user, year);
            }
            case "month", "monthly" -> {
                if (year == null || month == null) throw new IllegalArgumentException("Year and month are required for monthly data");
                yield getStoreRevenueChartMonth(user, year, month);
            }
            default -> throw new IllegalArgumentException("Invalid time period: " + timePeriod + ". Use: all-time, year, or month");
        };
    }

    private List<Map<String, Object>> getStoreRevenueChartAllTime(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getStoreRevenueChartAllTimeHQ();
            case "STATE_MANAGER" -> repo.getStoreRevenueChartAllTimeState(user.getStateAbbr());
            case "STORE_MANAGER" -> repo.getStoreRevenueChartAllTimeStore(user.getStoreId());
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    private List<Map<String, Object>> getStoreRevenueChartYear(User user, Integer year) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getStoreRevenueChartYearHQ(year);
            case "STATE_MANAGER" -> repo.getStoreRevenueChartYearState(user.getStateAbbr(), year);
            case "STORE_MANAGER" -> repo.getStoreRevenueChartYearStore(user.getStoreId(), year);
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    private List<Map<String, Object>> getStoreRevenueChartMonth(User user, Integer year, Integer month) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getStoreRevenueChartMonthHQ(year, month);
            case "STATE_MANAGER" -> repo.getStoreRevenueChartMonthState(user.getStateAbbr(), year, month);
            case "STORE_MANAGER" -> repo.getStoreRevenueChartMonthStore(user.getStoreId(), year, month);
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    // Chart utility methods
    @Cacheable(value = "chartYears", key = "'available_years'")
    public List<Map<String, Object>> getChartAvailableYears() {
        return repo.getChartAvailableYears();
    }

    @Cacheable(value = "chartMonths", key = "#year")
    public List<Map<String, Object>> getChartAvailableMonths(Integer year) {
        return repo.getChartAvailableMonths(year);
    }

    // =================================================================
    // COMPREHENSIVE ANALYTICS - Advanced Business Intelligence
    // =================================================================

    // Hourly Performance Analytics - Role-based using correct materialized views
    @Cacheable(value = "hourlyAnalytics", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr")
    public List<Map<String, Object>> getHourlyPerformanceAnalytics(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getHourlyPerformanceAnalyticsHQ();
            case "STATE_MANAGER" -> repo.getHourlyPerformanceAnalyticsState(user.getStateAbbr());
            case "STORE_MANAGER" -> repo.getHourlyPerformanceAnalyticsStore(user.getStoreId());
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    // Product Performance Analytics - Role-based using top_products views
    @Cacheable(value = "productAnalytics", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr + '_' + #category")
    public List<Map<String, Object>> getProductPerformanceAnalytics(User user, String category, Integer limit) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getProductPerformanceAnalyticsHQ(category, limit);
            case "STATE_MANAGER" -> repo.getProductPerformanceAnalyticsState(user.getStateAbbr(), category, limit);
            case "STORE_MANAGER" -> repo.getProductPerformanceAnalyticsStore(user.getStoreId(), category, limit);
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    // Category Performance Analytics - Role-based
    @Cacheable(value = "categoryAnalytics", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr")
    public List<Map<String, Object>> getCategoryPerformanceAnalytics(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getCategoryPerformanceAnalyticsHQ();
            case "STATE_MANAGER" -> repo.getCategoryPerformanceAnalyticsState(user.getStateAbbr());
            case "STORE_MANAGER" -> repo.getCategoryPerformanceAnalyticsStore(user.getStoreId());
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    // Customer Acquisition Analytics - Role-based (only HQ and STATE have this data)
    @Cacheable(value = "customerAcquisition", key = "#user.role + '_' + #user.stateAbbr")
    public List<Map<String, Object>> getCustomerAcquisitionAnalytics(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getCustomerAcquisitionAnalyticsHQ();
            case "STATE_MANAGER" -> repo.getCustomerAcquisitionAnalyticsState(user.getStateAbbr());
            case "STORE_MANAGER" -> List.of(); // Store managers don't have acquisition data
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    // Daily Revenue Trends - Only for HQ (only view available)
    @Cacheable(value = "dailyTrends", key = "#user.role")
    public List<Map<String, Object>> getDailyRevenueTrends(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getDailyRevenueTrendsHQ();
            case "STATE_MANAGER", "STORE_MANAGER" -> List.of(); // Not available for other roles
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    // Monthly Revenue Trends - Role-based
    @Cacheable(value = "monthlyTrends", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr")
    public List<Map<String, Object>> getMonthlyRevenueTrends(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getMonthlyRevenueTrendsHQ();
            case "STATE_MANAGER" -> repo.getMonthlyRevenueTrendsState(user.getStateAbbr());
            case "STORE_MANAGER" -> repo.getMonthlyRevenueTrendsStore(user.getStoreId());
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    // Store Performance Comparison - Role-based
    @Cacheable(value = "storeComparison", key = "#user.role + '_' + #user.stateAbbr")
    public List<Map<String, Object>> getStorePerformanceComparison(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getStorePerformanceComparisonHQ();
            case "STATE_MANAGER" -> repo.getStorePerformanceComparisonState(user.getStateAbbr());
            case "STORE_MANAGER" -> repo.getStorePerformanceComparisonStore(user.getStoreId());
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }
    
    // State Revenue Trends - Role-based (HQ gets all states, others get their data)
    @Cacheable(value = "stateRevenueTrends", key = "#user.role + '_' + #user.stateAbbr")
    public List<Map<String, Object>> getStateRevenueTrends(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getStateRevenueTrendsHQ();
            case "STATE_MANAGER" -> repo.getStateRevenueTrendsState(user.getStateAbbr());
            case "STORE_MANAGER" -> {
                // Store managers see their state's trends
                String storeState = repo.getStoreState(user.getStoreId());
                yield repo.getStateRevenueTrendsState(storeState);
            }
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    // Removed seasonal analysis - doesn't provide real business value

    @Cacheable(value = "topProductsByTime", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr + '_' + #timePeriod + '_' + #year + '_' + #month + '_' + #limit")
    public List<Map<String, Object>> getTopProductsByTimePeriod(User user, String timePeriod, Integer year, Integer month, Integer limit) {
        if (limit == null) limit = 20; // Default limit
        
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getTopProductsByTimePeriod(null, null, timePeriod, year, month, limit);
            case "STATE_MANAGER" -> repo.getTopProductsByTimePeriod(null, user.getStateAbbr(), timePeriod, year, month, limit);
            case "STORE_MANAGER" -> repo.getTopProductsByTimePeriod(user.getStoreId(), null, timePeriod, year, month, limit);
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    @Cacheable(value = "storeComparison", key = "#user.role + '_' + #user.stateAbbr + '_' + #year + '_' + #month")
    public List<Map<String, Object>> getStorePerformanceComparison(User user, Integer year, Integer month) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getStorePerformanceComparison(null, year, month);
            case "STATE_MANAGER" -> repo.getStorePerformanceComparison(user.getStateAbbr(), year, month);
            case "STORE_MANAGER" -> {
                // Store managers see their store comparison within their state
                List<Map<String, Object>> stateStores = repo.getStorePerformanceComparison(user.getStateAbbr(), year, month);
                yield storeStores.stream()
                    .filter(store -> user.getStoreId().equals(store.get("storeid")))
                    .toList();
            }
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    // =================================================================
    // ENHANCED STORE ANALYTICS - For the new stores page
    // =================================================================

    @Cacheable(value = "storePerformanceAnalytics", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr")
    public List<Map<String, Object>> getStorePerformanceAnalytics(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getStorePerformanceAnalyticsHQ();
            case "STATE_MANAGER" -> repo.getStorePerformanceAnalyticsState(user.getStateAbbr());
            case "STORE_MANAGER" -> repo.getStorePerformanceAnalyticsStore(user.getStoreId());
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    @Cacheable(value = "statePerformanceAnalytics", key = "#user.role + '_' + #user.stateAbbr")
    public List<Map<String, Object>> getStatePerformanceAnalytics(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getStatePerformanceAnalyticsHQ();
            case "STATE_MANAGER" -> repo.getStatePerformanceAnalyticsState(user.getStateAbbr());
            case "STORE_MANAGER" -> repo.getStatePerformanceAnalyticsStore(user.getStoreId());
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    @Cacheable(value = "monthlyRevenueTrendsByStore", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr")
    public List<Map<String, Object>> getMonthlyRevenueTrendsByStore(User user) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getMonthlyRevenueTrendsByStoreHQ();
            case "STATE_MANAGER" -> repo.getMonthlyRevenueTrendsByStoreState(user.getStateAbbr());
            case "STORE_MANAGER" -> repo.getMonthlyRevenueTrendsByStoreStore(user.getStoreId());
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    // ============================================================================
    // NEW STORE ANALYTICS METHODS - Enhanced Store Intelligence
    // ============================================================================

    public List<Map<String, Object>> getStoreHourlyPerformance(String role, String stateAbbr, String storeId) {
        String sql;
        if ("HQ_ADMIN".equals(role)) {
            sql = """
                SELECT 
                    s.storeid,
                    s.city,
                    s.state,
                    s.state_abbr,
                    EXTRACT(HOUR FROM o.orderdate) as hour_of_day,
                    COUNT(o.orderid) as total_orders,
                    SUM(o.total) as total_revenue,
                    AVG(o.total) as avg_order_value
                FROM stores s
                JOIN orders o ON s.storeid = o.storeid
                GROUP BY s.storeid, s.city, s.state, s.state_abbr, EXTRACT(HOUR FROM o.orderdate)
                ORDER BY s.storeid, EXTRACT(HOUR FROM o.orderdate)
                """;
            return jdbcTemplate.queryForList(sql);
        } else if ("STATE_MANAGER".equals(role)) {
            sql = """
                SELECT 
                    s.storeid,
                    s.city,
                    s.state,
                    s.state_abbr,
                    EXTRACT(HOUR FROM o.orderdate) as hour_of_day,
                    COUNT(o.orderid) as total_orders,
                    SUM(o.total) as total_revenue,
                    AVG(o.total) as avg_order_value
                FROM stores s
                JOIN orders o ON s.storeid = o.storeid
                WHERE s.state_abbr = ?
                GROUP BY s.storeid, s.city, s.state, s.state_abbr, EXTRACT(HOUR FROM o.orderdate)
                ORDER BY s.storeid, EXTRACT(HOUR FROM o.orderdate)
                """;
            return jdbcTemplate.queryForList(sql, stateAbbr);
        } else { // STORE_MANAGER
            sql = """
                SELECT 
                    s.storeid,
                    s.city,
                    s.state,
                    s.state_abbr,
                    EXTRACT(HOUR FROM o.orderdate) as hour_of_day,
                    COUNT(o.orderid) as total_orders,
                    SUM(o.total) as total_revenue,
                    AVG(o.total) as avg_order_value
                FROM stores s
                JOIN orders o ON s.storeid = o.storeid
                WHERE s.storeid = ?
                GROUP BY s.storeid, s.city, s.state, s.state_abbr, EXTRACT(HOUR FROM o.orderdate)
                ORDER BY EXTRACT(HOUR FROM o.orderdate)
                """;
            return jdbcTemplate.queryForList(sql, storeId);
        }
    }

    public List<Map<String, Object>> getStoreCustomerAcquisition(String role, String stateAbbr, String storeId) {
        String sql;
        if ("HQ_ADMIN".equals(role)) {
            sql = """
                SELECT 
                    s.storeid,
                    s.city,
                    s.state_abbr,
                    EXTRACT(YEAR FROM o.orderdate) as year,
                    EXTRACT(MONTH FROM o.orderdate) as month,
                    TO_CHAR(o.orderdate, 'Month YYYY') as month_name,
                    COUNT(DISTINCT o.customerid) as new_customers,
                    SUM(o.total) as revenue_from_new_customers
                FROM stores s
                JOIN orders o ON s.storeid = o.storeid
                GROUP BY s.storeid, s.city, s.state_abbr, EXTRACT(YEAR FROM o.orderdate), EXTRACT(MONTH FROM o.orderdate), TO_CHAR(o.orderdate, 'Month YYYY')
                ORDER BY s.storeid, EXTRACT(YEAR FROM o.orderdate), EXTRACT(MONTH FROM o.orderdate)
                """;
            return jdbcTemplate.queryForList(sql);
        } else if ("STATE_MANAGER".equals(role)) {
            sql = """
                SELECT 
                    s.storeid,
                    s.city,
                    s.state_abbr,
                    EXTRACT(YEAR FROM o.orderdate) as year,
                    EXTRACT(MONTH FROM o.orderdate) as month,
                    TO_CHAR(o.orderdate, 'Month YYYY') as month_name,
                    COUNT(DISTINCT o.customerid) as new_customers,
                    SUM(o.total) as revenue_from_new_customers
                FROM stores s
                JOIN orders o ON s.storeid = o.storeid
                WHERE s.state_abbr = ?
                GROUP BY s.storeid, s.city, s.state_abbr, EXTRACT(YEAR FROM o.orderdate), EXTRACT(MONTH FROM o.orderdate), TO_CHAR(o.orderdate, 'Month YYYY')
                ORDER BY s.storeid, EXTRACT(YEAR FROM o.orderdate), EXTRACT(MONTH FROM o.orderdate)
                """;
            return jdbcTemplate.queryForList(sql, stateAbbr);
        } else { // STORE_MANAGER
            sql = """
                SELECT 
                    s.storeid,
                    s.city,
                    s.state_abbr,
                    EXTRACT(YEAR FROM o.orderdate) as year,
                    EXTRACT(MONTH FROM o.orderdate) as month,
                    TO_CHAR(o.orderdate, 'Month YYYY') as month_name,
                    COUNT(DISTINCT o.customerid) as new_customers,
                    SUM(o.total) as revenue_from_new_customers
                FROM stores s
                JOIN orders o ON s.storeid = o.storeid
                WHERE s.storeid = ?
                GROUP BY s.storeid, s.city, s.state_abbr, EXTRACT(YEAR FROM o.orderdate), EXTRACT(MONTH FROM o.orderdate), TO_CHAR(o.orderdate, 'Month YYYY')
                ORDER BY EXTRACT(YEAR FROM o.orderdate), EXTRACT(MONTH FROM o.orderdate)
                """;
            return jdbcTemplate.queryForList(sql, storeId);
        }
    }

    public List<Map<String, Object>> getStoreProductMix(String role, String stateAbbr, String storeId) {
        String sql;
        if ("HQ_ADMIN".equals(role)) {
            sql = "SELECT * FROM store_product_mix_v2 ORDER BY store_id, total_revenue DESC";
            return jdbcTemplate.queryForList(sql);
        } else if ("STATE_MANAGER".equals(role)) {
            sql = "SELECT * FROM store_product_mix_v2 WHERE state = ? ORDER BY store_id, total_revenue DESC";
            return jdbcTemplate.queryForList(sql, stateAbbr);
        } else { // STORE_MANAGER
            sql = "SELECT * FROM store_product_mix_v2 WHERE store_id = ? ORDER BY total_revenue DESC";
            return jdbcTemplate.queryForList(sql, storeId);
        }
    }

    public List<Map<String, Object>> getStoreWeeklyTrends(String role, String stateAbbr, String storeId) {
        String sql;
        if ("HQ_ADMIN".equals(role)) {
            sql = "SELECT * FROM store_weekly_trends_v2 ORDER BY store_id, week_start";
            return jdbcTemplate.queryForList(sql);
        } else if ("STATE_MANAGER".equals(role)) {
            sql = "SELECT * FROM store_weekly_trends_v2 WHERE state = ? ORDER BY store_id, week_start";
            return jdbcTemplate.queryForList(sql, stateAbbr);
        } else { // STORE_MANAGER
            sql = "SELECT * FROM store_weekly_trends_v2 WHERE store_id = ? ORDER BY week_start";
            return jdbcTemplate.queryForList(sql, storeId);
        }
    }

    public List<Map<String, Object>> getStoreDailyOperations(String role, String stateAbbr, String storeId) {
        String sql;
        if ("HQ_ADMIN".equals(role)) {
            sql = "SELECT * FROM store_daily_operations_v2 ORDER BY store_id, operation_date";
            return jdbcTemplate.queryForList(sql);
        } else if ("STATE_MANAGER".equals(role)) {
            sql = "SELECT * FROM store_daily_operations_v2 WHERE state = ? ORDER BY store_id, operation_date";
            return jdbcTemplate.queryForList(sql, stateAbbr);
        } else { // STORE_MANAGER
            sql = "SELECT * FROM store_daily_operations_v2 WHERE store_id = ? ORDER BY operation_date";
            return jdbcTemplate.queryForList(sql, storeId);
        }
    }

    public List<Map<String, Object>> getStoreEfficiencyMetrics(String role, String stateAbbr, String storeId) {
        String sql;
        if ("HQ_ADMIN".equals(role)) {
            sql = "SELECT * FROM store_efficiency_metrics_v2 ORDER BY total_revenue DESC";
            return jdbcTemplate.queryForList(sql);
        } else if ("STATE_MANAGER".equals(role)) {
            sql = "SELECT * FROM store_efficiency_metrics_v2 WHERE state = ? ORDER BY total_revenue DESC";
            return jdbcTemplate.queryForList(sql, stateAbbr);
        } else { // STORE_MANAGER
            sql = "SELECT * FROM store_efficiency_metrics_v2 WHERE store_id = ? ORDER BY total_revenue DESC";
            return jdbcTemplate.queryForList(sql, storeId);
        }
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

    // Helper method to extract user from authentication
    private User getUserFromAuthentication(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof User) {
            return (User) authentication.getPrincipal();
        }
        throw new RuntimeException("Invalid authentication");
    }

    // ===== STORE-SPECIFIC ANALYTICS SERVICE METHODS =====

    public Map<String, Object> getStoreAnalyticsOverview(String storeId, Authentication authentication) {
        User user = getUserFromAuthentication(authentication);
        
        // Get basic store KPIs
        String kpiSql = "SELECT * FROM kpis_global_store WHERE store_id = ?";
        List<Map<String, Object>> kpiData = jdbcTemplate.queryForList(kpiSql, storeId);
        
        // Get efficiency metrics
        String efficiencySql = "SELECT * FROM store_efficiency_metrics_v2 WHERE store_id = ?";
        List<Map<String, Object>> efficiencyData = jdbcTemplate.queryForList(efficiencySql, storeId);
        
        // Get recent performance (last 30 days)
        String recentSql = "SELECT COUNT(*) as recent_orders, SUM(daily_revenue) as recent_revenue " +
                          "FROM store_daily_operations_v2 WHERE store_id = ? AND operation_date >= CURRENT_DATE - INTERVAL '30 days'";
        List<Map<String, Object>> recentData = jdbcTemplate.queryForList(recentSql, storeId);
        
        Map<String, Object> overview = new HashMap<>();
        overview.put("kpis", kpiData.isEmpty() ? null : kpiData.get(0));
        overview.put("efficiency", efficiencyData.isEmpty() ? null : efficiencyData.get(0));
        overview.put("recent_performance", recentData.isEmpty() ? null : recentData.get(0));
        
        return overview;
    }

    public List<Map<String, Object>> getStoreRevenueTrends(String storeId, Authentication authentication) {
        User user = getUserFromAuthentication(authentication);
        
        // Get daily revenue trends for the last 90 days
        String sql = "SELECT operation_date, daily_revenue, daily_orders, avg_order_value, unique_customers " +
                    "FROM store_daily_operations_v2 " +
                    "WHERE store_id = ? AND operation_date >= CURRENT_DATE - INTERVAL '90 days' " +
                    "ORDER BY operation_date";
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    public List<Map<String, Object>> getStoreHourlyPerformance(String storeId, Authentication authentication) {
        User user = getUserFromAuthentication(authentication);
        
        // Get hourly performance data
        String sql = "SELECT hour, revenue, orders FROM revenue_by_hour_store WHERE store_id = ? ORDER BY hour";
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    public List<Map<String, Object>> getStoreCategoryPerformance(String storeId, Authentication authentication) {
        User user = getUserFromAuthentication(authentication);
        
        // Get category performance for the store
        String sql = "SELECT category, total_revenue, units_sold, total_orders, unique_customers, avg_order_value " +
                    "FROM category_performance_store WHERE store_id = ? ORDER BY total_revenue DESC";
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    public List<Map<String, Object>> getStoreDailyOperations(String storeId, Authentication authentication) {
        User user = getUserFromAuthentication(authentication);
        
        // Get detailed daily operations for last 60 days
        String sql = "SELECT operation_date, daily_orders, daily_revenue, avg_order_value, " +
                    "unique_customers, total_items_sold, categories_sold, " +
                    "first_order_time, last_order_time " +
                    "FROM store_daily_operations_v2 " +
                    "WHERE store_id = ? AND operation_date >= CURRENT_DATE - INTERVAL '60 days' " +
                    "ORDER BY operation_date DESC";
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    public List<Map<String, Object>> getStoreCustomerInsights(String storeId, Authentication authentication) {
        User user = getUserFromAuthentication(authentication);
        
        // Get customer acquisition trends
        String sql = "SELECT week_start, new_customers, returning_customers, total_orders, total_revenue " +
                    "FROM store_customer_acquisition_v2 " +
                    "WHERE store_id = ? " +
                    "ORDER BY week_start DESC LIMIT 12";
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    public List<Map<String, Object>> getStoreProductPerformance(String storeId, Authentication authentication) {
        User user = getUserFromAuthentication(authentication);
        
        // Get top products from store analytics comprehensive view
        String sql = "SELECT product_name, category, size, " +
                    "SUM(product_revenue) as total_revenue, " +
                    "SUM(quantity_sold) as total_quantity, " +
                    "COUNT(DISTINCT orderid) as orders_count, " +
                    "COUNT(DISTINCT customerid) as customers_count, " +
                    "AVG(price) as avg_price " +
                    "FROM store_analytics_comprehensive " +
                    "WHERE storeid = ? AND date_key >= CURRENT_DATE - INTERVAL '30 days' " +
                    "GROUP BY product_name, category, size " +
                    "ORDER BY total_revenue DESC LIMIT 20";
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    public List<Map<String, Object>> getStoreRecentOrders(String storeId, Authentication authentication) {
        User user = getUserFromAuthentication(authentication);
        
        // Get recent orders for the store
        String sql = "SELECT orderid, customerid, orderdate, nitems, total, city, zipcode " +
                    "FROM recent_orders_store " +
                    "WHERE storeid = ? " +
                    "ORDER BY orderdate DESC LIMIT 50";
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    public Map<String, Object> getStoreEfficiencyMetrics(String storeId, Authentication authentication) {
        User user = getUserFromAuthentication(authentication);
        
        // Get comprehensive efficiency metrics
        String sql = "SELECT * FROM store_efficiency_metrics_v2 WHERE store_id = ?";
        List<Map<String, Object>> metrics = jdbcTemplate.queryForList(sql, storeId);
        
        if (metrics.isEmpty()) {
            return Map.of("error", "No efficiency metrics found for store: " + storeId);
        }
        
        return metrics.get(0);
    }
}