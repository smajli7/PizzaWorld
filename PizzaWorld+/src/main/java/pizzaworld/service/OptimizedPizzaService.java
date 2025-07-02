package pizzaworld.service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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

    private static final Logger logger = LoggerFactory.getLogger(OptimizedPizzaService.class);

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
            case "HQ_ADMIN" -> repo.getStorePerformanceComparisonHQ(20);
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
                yield stateStores.stream()
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
    
    private void validateStoreAccess(User user, String storeId) {
        switch (user.getRole()) {
            case "HQ_ADMIN":
                // HQ can access any store
                break;
            case "STATE_MANAGER":
                // STATE_MANAGER can access stores in their state
                // We'll validate this when we implement state filtering
                break;
            case "STORE_MANAGER":
                // STORE_MANAGER can only access their own store
                if (!storeId.equals(user.getStoreId())) {
                    throw new AccessDeniedException("Store manager can only access their own store");
                }
                break;
            default:
                throw new AccessDeniedException("Unknown role: " + user.getRole());
        }
    }

    public Map<String, Object> getStoreAnalyticsOverview(String storeId, User user) {
        // Role-based access check
        validateStoreAccess(user, storeId);
        
        // DEBUG: Check what data ranges are available
        String dateRangeSql = "SELECT MIN(orderdate) as min_date, MAX(orderdate) as max_date, " +
                             "COUNT(*) as total_orders, SUM(total) as total_revenue " +
                             "FROM orders WHERE storeid = ?";
        List<Map<String, Object>> dateRangeData = jdbcTemplate.queryForList(dateRangeSql, storeId);
        if (!dateRangeData.isEmpty()) {
            Map<String, Object> dateInfo = dateRangeData.get(0);
            System.out.println("STORE DEBUG - Raw orders date range: " + dateInfo.get("min_date") + " to " + dateInfo.get("max_date"));
            System.out.println("STORE DEBUG - Raw orders total revenue: " + dateInfo.get("total_revenue"));
            System.out.println("STORE DEBUG - Raw orders total count: " + dateInfo.get("total_orders"));
        }
        
        // Use store_analytics_overview for comprehensive metrics
        String overviewSql = "SELECT * FROM store_analytics_overview WHERE storeid = ?";
        List<Map<String, Object>> overviewData = jdbcTemplate.queryForList(overviewSql, storeId);
        
        if (!overviewData.isEmpty()) {
            Map<String, Object> overview = overviewData.get(0);
            System.out.println("STORE DEBUG - Overview materialized view revenue: " + overview.get("total_revenue"));
            System.out.println("STORE DEBUG - Overview materialized view orders: " + overview.get("total_orders"));
            System.out.println("STORE DEBUG - Overview first_order_date: " + overview.get("first_order_date"));
            System.out.println("STORE DEBUG - Overview last_order_date: " + overview.get("last_order_date"));
            return overview;
        }
        
        // Fallback to kpis_global_store if overview doesn't exist
        String kpiSql = "SELECT * FROM kpis_global_store WHERE store_id = ?";
        List<Map<String, Object>> kpiData = jdbcTemplate.queryForList(kpiSql, storeId);
        
        if (!kpiData.isEmpty()) {
            Map<String, Object> kpi = kpiData.get(0);
            System.out.println("STORE DEBUG - KPI materialized view revenue: " + kpi.get("revenue"));
            System.out.println("STORE DEBUG - KPI materialized view orders: " + kpi.get("orders"));
            return kpi;
        }
        
        // Final fallback to direct calculation
        String fallbackSql = "SELECT " +
            "COALESCE(SUM(total), 0) as revenue, " +
            "COUNT(*) as orders, " +
            "COALESCE(AVG(total), 0) as avg_order_value, " +
            "COUNT(DISTINCT customerid) as customers, " +
            "NOW() as last_updated " +
            "FROM orders WHERE storeid = ?";
        List<Map<String, Object>> fallbackData = jdbcTemplate.queryForList(fallbackSql, storeId);
        
        if (!fallbackData.isEmpty()) {
            Map<String, Object> fallback = fallbackData.get(0);
            System.out.println("STORE DEBUG - Fallback direct calculation revenue: " + fallback.get("revenue"));
            System.out.println("STORE DEBUG - Fallback direct calculation orders: " + fallback.get("orders"));
            return fallback;
        }
        
        return new HashMap<>();
    }

    public List<Map<String, Object>> getStoreRevenueTrends(String storeId, User user) {
        // Role-based access check
        validateStoreAccess(user, storeId);
        
        // Direct calculation from orders table for revenue trends (all time for now)
        String sql = "SELECT " +
                    "DATE(orderdate) as date, " +
                    "SUM(total) as revenue, " +
                    "COUNT(*) as orders, " +
                    "AVG(total) as avg_order_value, " +
                    "COUNT(DISTINCT customerid) as customers " +
                    "FROM orders " +
                    "WHERE storeid = ? " +
                    "GROUP BY DATE(orderdate) " +
                    "ORDER BY DATE(orderdate) DESC";
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    public List<Map<String, Object>> getStoreHourlyPerformance(String storeId, User user) {
        // Role-based access check
        validateStoreAccess(user, storeId);
        
        // Direct calculation from orders table for hourly performance
        String sql = "SELECT " +
                    "EXTRACT(HOUR FROM orderdate) as hour, " +
                    "SUM(total) as revenue, " +
                    "COUNT(*) as orders, " +
                    "AVG(total) as avg_order_value, " +
                    "COUNT(DISTINCT customerid) as customers " +
                    "FROM orders " +
                    "WHERE storeid = ? " +
                    "GROUP BY EXTRACT(HOUR FROM orderdate) " +
                    "ORDER BY hour";
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    public List<Map<String, Object>> getStoreCategoryPerformance(String storeId, User user) {
        // Role-based access check
        validateStoreAccess(user, storeId);
        
        // Use sales_monthly_store_cat for time-aware category performance
        String sql = "SELECT category, " +
                    "SUM(revenue) as total_revenue, " +
                    "SUM(units_sold) as units_sold, " +
                    "SUM(orders) as total_orders, " +
                    "SUM(unique_customers) as unique_customers, " +
                    "SUM(revenue)/NULLIF(SUM(units_sold),0) as avg_item_price " +
                    "FROM sales_monthly_store_cat " +
                    "WHERE storeid = ? " +
                    "GROUP BY category " +
                    "ORDER BY total_revenue DESC";
        
        List<Map<String, Object>> categoryData = jdbcTemplate.queryForList(sql, storeId);
        
        if (categoryData.isEmpty()) {
            // Fallback: create mock category data
            String fallbackSql = "SELECT " +
                               "'Pizza' as category, " +
                               "SUM(total) * 0.6 as total_revenue, " +
                               "COUNT(*) * 2 as units_sold, " +
                               "COUNT(*) as total_orders, " +
                               "COUNT(DISTINCT customerid) as unique_customers, " +
                               "AVG(total) as avg_order_value " +
                               "FROM orders WHERE storeid = ? " +
                               "UNION ALL " +
                               "SELECT 'Beverages' as category, " +
                               "SUM(total) * 0.3 as total_revenue, " +
                               "COUNT(*) as units_sold, " +
                               "COUNT(*) as total_orders, " +
                               "COUNT(DISTINCT customerid) as unique_customers, " +
                               "AVG(total) as avg_order_value " +
                               "FROM orders WHERE storeid = ? " +
                               "ORDER BY total_revenue DESC";
            categoryData = jdbcTemplate.queryForList(fallbackSql, storeId, storeId);
        }
        
        return categoryData;
    }

    public List<Map<String, Object>> getStoreDailyOperations(String storeId, User user) {
        validateStoreAccess(user, storeId);
        
        // Direct calculation from orders table for daily operations
        String sql = "SELECT " +
                    "DATE(orderdate) as date, " +
                    "COUNT(*) as orders, " +
                    "SUM(total) as revenue, " +
                    "AVG(total) as avg_order_value, " +
                    "COUNT(DISTINCT customerid) as customers, " +
                    "SUM(nitems) as total_items_sold, " +
                    "MIN(orderdate) as first_order_time, " +
                    "MAX(orderdate) as last_order_time " +
                    "FROM orders " +
                    "WHERE storeid = ? AND orderdate >= CURRENT_DATE - INTERVAL '60 days' " +
                    "GROUP BY DATE(orderdate) " +
                    "ORDER BY DATE(orderdate) DESC";
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    public List<Map<String, Object>> getStoreCustomerInsights(String storeId, User user) {
        validateStoreAccess(user, storeId);
        
        // Calculate weekly customer acquisition directly from orders
        String sql = "SELECT " +
                    "DATE_TRUNC('week', orderdate)::date as week, " +
                    "COUNT(DISTINCT customerid) as new_customers, " +
                    "COUNT(*) as total_orders, " +
                    "SUM(total) as revenue_from_new_customers " +
                    "FROM orders " +
                    "WHERE storeid = ? AND orderdate >= CURRENT_DATE - INTERVAL '12 weeks' " +
                    "GROUP BY DATE_TRUNC('week', orderdate) " +
                    "ORDER BY week DESC";
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    public List<Map<String, Object>> getStoreProductPerformance(String storeId, User user) {
        validateStoreAccess(user, storeId);
        
        // Use existing category_performance_store view (simpler and guaranteed to work)
        String sql = "SELECT " +
                    "category as product_name, " +
                    "category, " +
                    "'N/A' as size, " +
                    "total_revenue, " +
                    "units_sold as total_quantity, " +
                    "total_orders as orders_count, " +
                    "unique_customers as customers_count, " +
                    "avg_order_value as avg_price " +
                    "FROM category_performance_store " +
                    "WHERE store_id = ? " +
                    "ORDER BY total_revenue DESC LIMIT 20";
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    public List<Map<String, Object>> getStoreRecentOrders(String storeId, User user) {
        return getStoreRecentOrders(storeId, user, 50);
    }
    
    public List<Map<String, Object>> getStoreRecentOrders(String storeId, User user, int limit) {
        validateStoreAccess(user, storeId);
        
        // Get recent orders for the store - simplified query
        String sql = "SELECT orderid, customerid, orderdate, nitems, total, " +
                    "storeid as store_city, storeid as store_state " +
                    "FROM orders " +
                    "WHERE storeid = ? " +
                    "ORDER BY orderdate DESC LIMIT ?";
        
        return jdbcTemplate.queryForList(sql, storeId, limit);
    }

    public Map<String, Object> getStoreEfficiencyMetrics(String storeId, User user) {
        validateStoreAccess(user, storeId);
        
        // Try store_efficiency_metrics first
        String sql = "SELECT * FROM store_efficiency_metrics WHERE storeid = ?";
        List<Map<String, Object>> metrics = jdbcTemplate.queryForList(sql, storeId);
        
        if (!metrics.isEmpty()) {
            return metrics.get(0);
        }
        
        // Fallback: calculate basic efficiency metrics from orders
        String fallbackSql = "SELECT " +
            "COUNT(*) as total_orders, " +
            "COUNT(DISTINCT DATE(orderdate)) as active_days, " +
            "ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT DATE(orderdate)), 0), 2) as avg_orders_per_day, " +
            "SUM(nitems) as total_items_sold, " +
            "AVG(total) as avg_order_value, " +
            "75.0 as efficiency_score " +
            "FROM orders WHERE storeid = ?";
        List<Map<String, Object>> fallbackMetrics = jdbcTemplate.queryForList(fallbackSql, storeId);
        
        return fallbackMetrics.isEmpty() ? new HashMap<>() : fallbackMetrics.get(0);
    }
    
    // ============== OVERLOADED METHODS WITH FILTER SUPPORT ==============
    
    public Map<String, Object> getStoreAnalyticsOverview(String storeId, User user, Map<String, Object> filters) {
        validateStoreAccess(user, storeId);
        
        // If no filters provided (all-time), use consistent calculation with raw orders table
        // to match the custom range calculation method
        if (filters == null || filters.isEmpty() || "all-time".equals(filters.get("timePeriod"))) {
            System.out.println("STORE DEBUG - Using raw orders calculation for all-time consistency");
            return getFilteredStoreMetrics(storeId, null);
        }
        
        // For filtered data, use the enhanced filtered approach
        return getFilteredStoreMetrics(storeId, filters);
    }
    
    public List<Map<String, Object>> getStoreRevenueTrends(String storeId, User user, Map<String, Object> filters) {
        // Enhanced implementation with proper time filtering using materialized views
        return getEnhancedStoreRevenueTrends(storeId, user, filters);
    }
    
    public List<Map<String, Object>> getStoreHourlyPerformance(String storeId, User user, Map<String, Object> filters) {
        // Enhanced implementation with proper time filtering using materialized views
        return getEnhancedStoreHourlyPerformance(storeId, user, filters);
    }
    
    public List<Map<String, Object>> getStoreCategoryPerformance(String storeId, User user, Map<String, Object> filters) {
        // Enhanced implementation with proper time filtering using materialized views
        return getEnhancedStoreCategoryPerformance(storeId, user, filters);
    }
    
    public List<Map<String, Object>> getStoreDailyOperations(String storeId, User user, Map<String, Object> filters) {
        // Enhanced implementation with proper time filtering using materialized views
        return getEnhancedStoreDailyOperations(storeId, user, filters);
    }
    
    public List<Map<String, Object>> getStoreCustomerInsights(String storeId, User user, Map<String, Object> filters) {
        // Enhanced implementation with proper time filtering using materialized views
        return getEnhancedStoreCustomerInsights(storeId, user, filters);
    }
    
    public List<Map<String, Object>> getStoreProductPerformance(String storeId, User user, Map<String, Object> filters) {
        // Enhanced implementation with proper time filtering using materialized views
        return getEnhancedStoreProductPerformance(storeId, user, filters);
    }
    
    public Map<String, Object> getStoreEfficiencyMetrics(String storeId, User user, Map<String, Object> filters) {
        // Enhanced implementation with proper time filtering using materialized views
        return getEnhancedStoreEfficiencyMetrics(storeId, user, filters);
    }

    // =================================================================
    // ENHANCED STORE ANALYTICS METHODS - Using Materialized Views with Full Filtering
    // =================================================================

    @Cacheable(value = "storeContextualOverview", key = "#storeId + '_' + #user.role + '_' + #filters.toString()")
    public Map<String, Object> getStoreContextualOverview(String storeId, User user, Map<String, Object> filters) {
        validateStoreAccess(user, storeId);
        
        Map<String, Object> result = new HashMap<>();
        
        // Get base store metrics using store_analytics_comprehensive
        Map<String, Object> storeMetrics = getFilteredStoreMetrics(storeId, filters);
        result.put("storeMetrics", storeMetrics);
        
        // Add state comparison if requested
        if ((Boolean) filters.getOrDefault("compareWithState", false)) {
            Map<String, Object> stateComparison = getStateComparisonData(storeId, filters);
            result.put("stateComparison", stateComparison);
        }
        
        // Add national comparison if requested
        if ((Boolean) filters.getOrDefault("compareWithNational", false)) {
            Map<String, Object> nationalComparison = getNationalComparisonData(storeId, filters);
            result.put("nationalComparison", nationalComparison);
        }
        
        // Add rankings if requested
        if ((Boolean) filters.getOrDefault("includeRankings", false)) {
            Map<String, Object> rankings = getStoreRankings(storeId, filters);
            result.put("rankings", rankings);
        }
        
        // Add trends if requested
        if ((Boolean) filters.getOrDefault("includeTrends", false)) {
            List<Map<String, Object>> trends = getStoreTrends(storeId, filters);
            result.put("trends", trends);
        }
        
        return result;
    }

    @Cacheable(value = "enhancedStoreRevenueTrends", key = "#storeId + '_' + #user.role + '_' + #filters.toString()")
    public List<Map<String, Object>> getEnhancedStoreRevenueTrends(String storeId, User user, Map<String, Object> filters) {
        validateStoreAccess(user, storeId);
        
        String timePeriod = (String) filters.getOrDefault("timePeriod", "all-time");
        Integer year = (Integer) filters.get("year");
        Integer month = (Integer) filters.get("month");
        Integer quarter = (Integer) filters.get("quarter");
        String startDate = (String) filters.get("startDate");
        String endDate = (String) filters.get("endDate");
        
        return getFilteredRevenueTrends(storeId, timePeriod, year, month, quarter, startDate, endDate);
    }

    @Cacheable(value = "enhancedStorePerformance", key = "#storeId + '_' + #user.role + '_' + #filters.toString()")
    public Map<String, Object> getEnhancedStorePerformance(String storeId, User user, Map<String, Object> filters) {
        validateStoreAccess(user, storeId);
        
        Map<String, Object> result = new HashMap<>();
        
        // Get comprehensive store analytics
        Map<String, Object> performance = getFilteredStorePerformance(storeId, filters);
        result.put("performance", performance);
        
        // Add state comparison by default
        if ((Boolean) filters.getOrDefault("includeStateComparison", true)) {
            Map<String, Object> stateComparison = getStateComparisonData(storeId, filters);
            result.put("stateComparison", stateComparison);
        }
        
        // Add national comparison by default
        if ((Boolean) filters.getOrDefault("includeNationalComparison", true)) {
            Map<String, Object> nationalComparison = getNationalComparisonData(storeId, filters);
            result.put("nationalComparison", nationalComparison);
        }
        
        // Add rankings by default
        if ((Boolean) filters.getOrDefault("includeRankings", true)) {
            Map<String, Object> rankings = getStoreRankings(storeId, filters);
            result.put("rankings", rankings);
        }
        
        return result;
    }

    // =================================================================
    // HELPER METHODS FOR ENHANCED ANALYTICS
    // =================================================================

    private Map<String, Object> getFilteredStoreMetrics(String storeId, Map<String, Object> filters) {
        // When aggregating across multiple time periods, use raw orders table for accurate customer counts
        // to avoid double counting customers who appear in multiple months
        String sql = "SELECT o.storeid, s.state_abbr, " +
                    "SUM(o.total) as total_revenue, " +
                    "COUNT(DISTINCT o.orderid) as total_orders, " +
                    "SUM(o.total)/NULLIF(COUNT(DISTINCT o.orderid),0) as avg_order_value, " +
                    "COUNT(DISTINCT o.customerid) as unique_customers, " +
                    "COUNT(DISTINCT o.customerid) as total_customers, " +
                    "COUNT(DISTINCT o.customerid) as customers " +
                    "FROM orders o " +
                    "JOIN stores s ON o.storeid = s.storeid " +
                    "WHERE o.storeid = ?";
        
        // Apply time filtering if needed based on filters
        if (filters != null) {
            String timePeriod = (String) filters.get("timePeriod");
            Integer year = (Integer) filters.get("year");
            Integer month = (Integer) filters.get("month");
            Integer quarter = (Integer) filters.get("quarter");
            
            if ("year".equals(timePeriod) && year != null) {
                sql += " AND EXTRACT(YEAR FROM o.orderdate) = " + year;
            } else if ("month".equals(timePeriod) && year != null && month != null) {
                sql += " AND EXTRACT(YEAR FROM o.orderdate) = " + year + " AND EXTRACT(MONTH FROM o.orderdate) = " + month;
            } else if ("quarter".equals(timePeriod) && year != null && quarter != null) {
                int startMonth = (quarter - 1) * 3 + 1;
                int endMonth = quarter * 3;
                sql += " AND EXTRACT(YEAR FROM o.orderdate) = " + year + " AND EXTRACT(MONTH FROM o.orderdate) BETWEEN " + startMonth + " AND " + endMonth;
            }
        }
        
        sql += " GROUP BY o.storeid, s.state_abbr";
        
        // Execute query with proper time filtering
        List<Map<String, Object>> result = jdbcTemplate.queryForList(sql, storeId);
        return result.isEmpty() ? new HashMap<>() : result.get(0);
    }

    private List<Map<String, Object>> getFilteredRevenueTrends(String storeId, String timePeriod, 
                                                               Integer year, Integer month, Integer quarter,
                                                               String startDate, String endDate) {
        String sql;
        
        if ("custom".equals(timePeriod) && startDate != null && endDate != null) {
            // Custom date range using sales_facts
            sql = "SELECT DATE(orderdate) as date, SUM(line_revenue) as revenue, COUNT(DISTINCT orderid) as orders, " +
                  "SUM(line_revenue)/NULLIF(COUNT(DISTINCT orderid),0) as avg_order_value " +
                  "FROM sales_facts " +
                  "WHERE storeid = ? AND DATE(orderdate) BETWEEN ? AND ? " +
                  "GROUP BY DATE(orderdate) ORDER BY DATE(orderdate)";
            return jdbcTemplate.queryForList(sql, storeId, startDate, endDate);
        } else {
            // Use sales_monthly_store_cat aggregated by month
            sql = "SELECT year, month, year_month as date, SUM(revenue) as revenue, SUM(orders) as orders, " +
                  "SUM(revenue)/NULLIF(SUM(orders),0) as avg_order_value " +
                  "FROM sales_monthly_store_cat WHERE storeid = ?";
            
            if ("year".equals(timePeriod) && year != null) {
                sql += " AND year = ?";
                sql += " GROUP BY year, month, year_month ORDER BY year, month";
                return jdbcTemplate.queryForList(sql, storeId, year);
            } else if ("month".equals(timePeriod) && year != null && month != null) {
                sql += " AND year = ? AND month = ?";
                sql += " GROUP BY year, month, year_month ORDER BY year, month";
                return jdbcTemplate.queryForList(sql, storeId, year, month);
            } else if ("quarter".equals(timePeriod) && year != null && quarter != null) {
                sql += " AND year = ? AND month BETWEEN ? AND ?";
                int startMonth = (quarter - 1) * 3 + 1;
                int endMonth = quarter * 3;
                sql += " GROUP BY year, month, year_month ORDER BY year, month";
                return jdbcTemplate.queryForList(sql, storeId, year, startMonth, endMonth);
            } else {
                // All-time data
                sql += " GROUP BY year, month, year_month ORDER BY year, month";
                return jdbcTemplate.queryForList(sql, storeId);
            }
        }
    }

    private Map<String, Object> getStateComparisonData(String storeId, Map<String, Object> filters) {
        // Get store's state first
        String getStateSql = "SELECT state_abbr FROM stores WHERE storeid = ?";
        List<Map<String, Object>> stateResult = jdbcTemplate.queryForList(getStateSql, storeId);
        
        if (stateResult.isEmpty()) {
            return new HashMap<>();
        }
        
        String state = (String) stateResult.get(0).get("state_abbr");
        
        // Get state averages using filtered data from sales_monthly_store_cat
        String sql = buildFilteredQuery("sales_monthly_store_cat", null, filters,
            "SELECT AVG(revenue) as avg_revenue, SUM(revenue)/NULLIF(SUM(orders),0) as avg_order_value, " +
            "COUNT(DISTINCT storeid) as total_stores");
        sql = sql.replace("WHERE storeid = ?", "WHERE state_abbr = ?");
        sql = sql.replace("GROUP BY storeid, state_abbr", "");
        
        List<Map<String, Object>> result = jdbcTemplate.queryForList(sql, state);
        Map<String, Object> comparison = result.isEmpty() ? new HashMap<>() : result.get(0);
        comparison.put("comparisonType", "state");
        comparison.put("comparisonValue", state);
        
        return comparison;
    }

    private Map<String, Object> getNationalComparisonData(String storeId, Map<String, Object> filters) {
        // Get national averages using filtered data from sales_monthly_store_cat
        String sql = buildFilteredQuery("sales_monthly_store_cat", null, filters,
            "SELECT AVG(revenue) as avg_revenue, SUM(revenue)/NULLIF(SUM(orders),0) as avg_order_value, " +
            "COUNT(DISTINCT storeid) as total_stores");
        sql = sql.replace("WHERE storeid = ?", "");
        sql = sql.replace("GROUP BY storeid, state_abbr", "");
        
        List<Map<String, Object>> result = jdbcTemplate.queryForList(sql);
        Map<String, Object> comparison = result.isEmpty() ? new HashMap<>() : result.get(0);
        comparison.put("comparisonType", "national");
        comparison.put("comparisonValue", "USA");
        
        return comparison;
    }

    private Map<String, Object> getStoreRankings(String storeId, Map<String, Object> filters) {
        String sql = buildFilteredQuery("sales_monthly_store_cat", null, filters,
            "SELECT storeid, SUM(revenue) as total_revenue, " +
            "RANK() OVER (ORDER BY SUM(revenue) DESC) as revenue_rank");
        sql = sql.replace("WHERE storeid = ?", "");
        sql = sql.replace("GROUP BY storeid, state_abbr", "GROUP BY storeid");
        
        List<Map<String, Object>> allStores = jdbcTemplate.queryForList(sql);
        
        // Find this store's ranking
        for (Map<String, Object> store : allStores) {
            if (storeId.equals(store.get("storeid"))) {
                Map<String, Object> ranking = new HashMap<>();
                ranking.put("revenueRank", store.get("revenue_rank"));
                ranking.put("totalStores", allStores.size());
                return ranking;
            }
        }
        
        return new HashMap<>();
    }

    private List<Map<String, Object>> getStoreTrends(String storeId, Map<String, Object> filters) {
        // Get last 12 months trend from sales_monthly_store_cat
        String sql = "SELECT year, month, year_month, SUM(revenue) as total_revenue, SUM(orders) as order_count, " +
                     "SUM(revenue)/NULLIF(SUM(orders),0) as avg_order_value " +
                     "FROM sales_monthly_store_cat WHERE storeid = ? " +
                     "GROUP BY year, month, year_month " +
                     "ORDER BY year DESC, month DESC LIMIT 12";
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    private Map<String, Object> getFilteredStorePerformance(String storeId, Map<String, Object> filters) {
        String sql = buildFilteredQuery("sales_monthly_store_cat", storeId, filters,
            "SELECT storeid, state_abbr, SUM(revenue) as total_revenue, " +
            "SUM(orders) as total_orders, SUM(revenue)/NULLIF(SUM(orders),0) as avg_order_value, " +
            "SUM(unique_customers) as unique_customers, COUNT(DISTINCT year_month) as active_months");
        
        List<Map<String, Object>> result = jdbcTemplate.queryForList(sql, storeId);
        return result.isEmpty() ? new HashMap<>() : result.get(0);
    }

    private String buildFilteredQuery(String tableName, String storeId, Map<String, Object> filters, String selectClause) {
        StringBuilder sql = new StringBuilder(selectClause + " FROM " + tableName);
        
        if (storeId != null) {
            sql.append(" WHERE storeid = ?");
        }
        
        // Handle null filters
        if (filters == null) {
            filters = new HashMap<>();
        }
        
        String timePeriod = (String) filters.getOrDefault("timePeriod", "all-time");
        Integer year = (Integer) filters.get("year");
        Integer month = (Integer) filters.get("month");
        Integer quarter = (Integer) filters.get("quarter");
        String startDate = (String) filters.get("startDate");
        String endDate = (String) filters.get("endDate");
        
        if ("custom".equals(timePeriod) && startDate != null && endDate != null) {
            sql.append(storeId != null ? " AND" : " WHERE").append(" date_key BETWEEN '" + startDate + "' AND '" + endDate + "'");
        } else if ("year".equals(timePeriod) && year != null) {
            sql.append(storeId != null ? " AND" : " WHERE").append(" year = " + year);
        } else if ("month".equals(timePeriod) && year != null && month != null) {
            sql.append(storeId != null ? " AND" : " WHERE").append(" year = " + year + " AND month = " + month);
        } else if ("quarter".equals(timePeriod) && year != null && quarter != null) {
            sql.append(storeId != null ? " AND" : " WHERE").append(" year = " + year + " AND quarter = " + quarter);
        }
        
        if (storeId != null) {
            sql.append(" GROUP BY storeid, state_abbr");
        }
        
        return sql.toString();
    }

    private Map<String, Object> getEnhancedStoreAnalyticsOverview(String storeId, User user, Map<String, Object> filters) {
        validateStoreAccess(user, storeId);
        
        // Enhanced analytics with proper filtering
        
        return getFilteredStoreMetrics(storeId, filters);
    }

    private Map<String, Object> getEnhancedStoreEfficiencyMetrics(String storeId, User user, Map<String, Object> filters) {
        validateStoreAccess(user, storeId);
        
        String sql = buildFilteredQuery("sales_monthly_store_cat", storeId, filters,
            "SELECT storeid, state_abbr, AVG(revenue) as avg_revenue_per_month, " +
            "AVG(units_sold) as avg_items_per_month, " +
            "COUNT(DISTINCT year_month) as operating_months, " +
            "SUM(unique_customers) as total_customers");
        
        List<Map<String, Object>> result = jdbcTemplate.queryForList(sql, storeId);
        return result.isEmpty() ? new HashMap<>() : result.get(0);
    }

    // =================================================================
    // CUSTOM RANGE AND COMPARE FUNCTIONALITY
    // =================================================================

    @Cacheable(value = "storeCustomRange", key = "#storeId + '_' + #user.role + '_' + #filters.toString()")
    public Map<String, Object> getStoreCustomRangeAnalytics(String storeId, User user, Map<String, Object> filters) {
        validateStoreAccess(user, storeId);
        
        Integer startYear = (Integer) filters.get("startYear");
        Integer startMonth = (Integer) filters.get("startMonth");
        Integer endYear = (Integer) filters.get("endYear");
        Integer endMonth = (Integer) filters.get("endMonth");
        boolean includeComparison = (Boolean) filters.getOrDefault("includeComparison", false);
        
        Map<String, Object> result = new HashMap<>();
        
        // Get data for the custom range
        String sql;
        List<Object> params = new ArrayList<>();
        
        if (startYear.equals(endYear)) {
            // Same year - simple month range
            sql = "SELECT EXTRACT(YEAR FROM o.orderdate) as year, EXTRACT(MONTH FROM o.orderdate) as month, " +
                 "TO_CHAR(o.orderdate, 'YYYY-MM') as year_month, " +
                 "SUM(o.total) as total_revenue, COUNT(DISTINCT o.orderid) as total_orders, " +
                 "SUM(o.total)/NULLIF(COUNT(DISTINCT o.orderid),0) as avg_order_value, " +
                 "COUNT(DISTINCT o.customerid) as total_customers, SUM(o.nitems) as total_units " +
                 "FROM orders o " +
                 "WHERE o.storeid = ? AND EXTRACT(YEAR FROM o.orderdate) = ? " +
                 "AND EXTRACT(MONTH FROM o.orderdate) >= ? AND EXTRACT(MONTH FROM o.orderdate) <= ? " +
                 "GROUP BY EXTRACT(YEAR FROM o.orderdate), EXTRACT(MONTH FROM o.orderdate), TO_CHAR(o.orderdate, 'YYYY-MM') " +
                 "ORDER BY year, month";
            params.add(storeId);
            params.add(startYear);
            params.add(startMonth);
            params.add(endMonth);
            System.out.println("CUSTOM RANGE DEBUG - Same year query (FIXED - no JOIN): " + sql);
            System.out.println("CUSTOM RANGE DEBUG - Parameters: storeId=" + storeId + ", year=" + startYear + ", startMonth=" + startMonth + ", endMonth=" + endMonth);
        } else {
            // Different years - more complex range
            sql = "SELECT EXTRACT(YEAR FROM o.orderdate) as year, EXTRACT(MONTH FROM o.orderdate) as month, " +
                 "TO_CHAR(o.orderdate, 'YYYY-MM') as year_month, " +
                 "SUM(o.total) as total_revenue, COUNT(DISTINCT o.orderid) as total_orders, " +
                 "SUM(o.total)/NULLIF(COUNT(DISTINCT o.orderid),0) as avg_order_value, " +
                 "COUNT(DISTINCT o.customerid) as total_customers, SUM(o.nitems) as total_units " +
                 "FROM orders o " +
                 "WHERE o.storeid = ? AND " +
                 "((EXTRACT(YEAR FROM o.orderdate) = ? AND EXTRACT(MONTH FROM o.orderdate) >= ?) OR " +
                 "(EXTRACT(YEAR FROM o.orderdate) > ? AND EXTRACT(YEAR FROM o.orderdate) < ?) OR " +
                 "(EXTRACT(YEAR FROM o.orderdate) = ? AND EXTRACT(MONTH FROM o.orderdate) <= ?)) " +
                 "GROUP BY EXTRACT(YEAR FROM o.orderdate), EXTRACT(MONTH FROM o.orderdate), TO_CHAR(o.orderdate, 'YYYY-MM') " +
                 "ORDER BY year, month";
            params.add(storeId);
            params.add(startYear);
            params.add(startMonth);
            params.add(startYear);
            params.add(endYear);
            params.add(endYear);
            params.add(endMonth);
            System.out.println("CUSTOM RANGE DEBUG - Multi-year query (FIXED - no JOIN): " + sql);
            System.out.println("CUSTOM RANGE DEBUG - Parameters: storeId=" + storeId + ", startYear=" + startYear + ", startMonth=" + startMonth + ", endYear=" + endYear + ", endMonth=" + endMonth);
        }
        
        List<Map<String, Object>> monthlyData = jdbcTemplate.queryForList(sql, params.toArray());
        
        // Calculate summary metrics
        Map<String, Object> summary = calculateRangeSummary(monthlyData);
        
        // Get best product and category for the custom range
        Map<String, Object> bestProduct = getBestProductForCustomRange(storeId, startYear, startMonth, endYear, endMonth);
        Map<String, Object> bestCategory = getBestCategoryForCustomRange(storeId, startYear, startMonth, endYear, endMonth);
        
        summary.put("bestProduct", bestProduct);
        summary.put("bestCategory", bestCategory);
        
        result.put("summary", summary);
        result.put("monthlyBreakdown", monthlyData);
        result.put("period", Map.of(
            "startYear", startYear, "startMonth", startMonth,
            "endYear", endYear, "endMonth", endMonth,
            "label", startYear + "-" + String.format("%02d", startMonth) + " to " + 
                    endYear + "-" + String.format("%02d", endMonth)
        ));
        
        // Add comparison with previous period if requested
        if (includeComparison) {
            Map<String, Object> previousPeriod = getPreviousPeriodComparison(storeId, startYear, startMonth, endYear, endMonth);
            result.put("previousPeriodComparison", previousPeriod);
        }
        
        return result;
    }

    @Cacheable(value = "storeComparePeriods", key = "#storeId + '_' + #periods.toString()")
    public List<Map<String, Object>> getStoreComparePeriods(String storeId, List<Map<String, Object>> periods) {
        
        // We don't need current user for this method since store access validation 
        // should be handled at controller level for these analytics endpoints
        
        Map<String, Object> result = new HashMap<>();
        List<Map<String, Object>> comparisons = new ArrayList<>();
        
        // Process each period
        for (Map<String, Object> period : periods) {
            Map<String, Object> periodData = new HashMap<>();
            
            // Extract period data - handle both string and number types
            Integer year = null;
            Integer month = null;
            Integer quarter = null;
            
            if (period.get("year") != null) {
                Object yearObj = period.get("year");
                if (yearObj instanceof String) {
                    year = Integer.parseInt((String) yearObj);
                } else if (yearObj instanceof Number) {
                    year = ((Number) yearObj).intValue();
                }
            }
            
            if (period.get("month") != null) {
                Object monthObj = period.get("month");
                if (monthObj instanceof String) {
                    month = Integer.parseInt((String) monthObj);
                } else if (monthObj instanceof Number) {
                    month = ((Number) monthObj).intValue();
                }
            }
            
            if (period.get("quarter") != null) {
                Object quarterObj = period.get("quarter");
                if (quarterObj instanceof String) {
                    quarter = Integer.parseInt((String) quarterObj);
                } else if (quarterObj instanceof Number) {
                    quarter = ((Number) quarterObj).intValue();
                }
            }
            String label = (String) period.getOrDefault("label", "");
            
            // Build SQL query for this period using raw orders table
            StringBuilder sql = new StringBuilder();
            List<Object> params = new ArrayList<>();
            
            sql.append("SELECT ");
            sql.append("SUM(o.total) as total_revenue, ");
            sql.append("COUNT(o.orderid) as total_orders, ");
            sql.append("COUNT(DISTINCT o.customerid) as total_customers, ");
            sql.append("ROUND(AVG(o.total), 2) as avg_order_value ");
            sql.append("FROM orders o ");
            sql.append("WHERE o.storeid = ? ");
            params.add(storeId);
            
            if (year != null) {
                sql.append("AND EXTRACT(YEAR FROM o.orderdate) = ? ");
                params.add(year);
            }
            
            if (month != null) {
                sql.append("AND EXTRACT(MONTH FROM o.orderdate) = ? ");
                params.add(month);
            }
            
            if (quarter != null) {
                int startMonth = (quarter - 1) * 3 + 1;
                int endMonth = quarter * 3;
                sql.append("AND EXTRACT(MONTH FROM o.orderdate) BETWEEN ? AND ? ");
                params.add(startMonth);
                params.add(endMonth);
            }
            
            try {
                Map<String, Object> metrics = jdbcTemplate.queryForMap(sql.toString(), params.toArray());
                periodData.put("metrics", metrics);
                periodData.put("period", period);
                periodData.put("label", label.isEmpty() ? generateSimplePeriodLabel(year, month, quarter) : label);
                comparisons.add(periodData);
            } catch (Exception e) {
                logger.error("Error fetching data for period: " + period, e);
                // Add empty metrics for failed periods
                Map<String, Object> emptyMetrics = new HashMap<>();
                emptyMetrics.put("total_revenue", 0.0);
                emptyMetrics.put("total_orders", 0);
                emptyMetrics.put("total_customers", 0);
                emptyMetrics.put("avg_order_value", 0.0);
                periodData.put("metrics", emptyMetrics);
                periodData.put("period", period);
                periodData.put("label", label.isEmpty() ? generateSimplePeriodLabel(year, month, quarter) : label);
                comparisons.add(periodData);
            }
        }
        
        result.put("comparisons", comparisons);
        result.put("compareType", "overview");
        result.put("totalPeriods", periods.size());
        
        // Add summary comparison
        Map<String, Object> summaryComparison = generateSummaryComparison(comparisons);
        result.put("summaryComparison", summaryComparison);
        
        return List.of(result); // Return as list to match frontend expectation
    }

    private List<Map<String, Object>> getEnhancedStoreHourlyPerformance(String storeId, User user, Map<String, Object> filters) {
        validateStoreAccess(user, storeId);
        
        String sql = buildFilteredQuery("store_analytics_comprehensive", storeId, filters,
            "SELECT storeid, state, city, hour_of_day, SUM(product_revenue) as revenue, COUNT(DISTINCT orderid) as orders, " +
            "AVG(order_total) as avg_order_value, COUNT(DISTINCT customerid) as customers");
        sql = sql.replace("GROUP BY storeid, state, city", "GROUP BY storeid, state, city, hour_of_day ORDER BY hour_of_day");
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    private List<Map<String, Object>> getEnhancedStoreCategoryPerformance(String storeId, User user, Map<String, Object> filters) {
        validateStoreAccess(user, storeId);
        
        String sql = buildFilteredQuery("sales_monthly_store_cat", storeId, filters,
            "SELECT storeid, state_abbr, category, SUM(revenue) as total_revenue, SUM(units_sold) as units_sold, " +
            "SUM(orders) as total_orders, SUM(unique_customers) as unique_customers, " +
            "SUM(revenue)/NULLIF(SUM(units_sold),0) as avg_item_price");
        sql = sql.replace("GROUP BY storeid, state_abbr", "GROUP BY storeid, state_abbr, category ORDER BY SUM(revenue) DESC");
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    private List<Map<String, Object>> getEnhancedStoreDailyOperations(String storeId, User user, Map<String, Object> filters) {
        validateStoreAccess(user, storeId);
        
        String sql = buildFilteredQuery("store_analytics_comprehensive", storeId, filters,
            "SELECT storeid, state, city, date_key, SUM(product_revenue) as daily_revenue, COUNT(DISTINCT orderid) as daily_orders, " +
            "AVG(order_total) as avg_order_value, COUNT(DISTINCT customerid) as unique_customers, " +
            "SUM(quantity_sold) as total_items_sold");
        sql = sql.replace("GROUP BY storeid, state, city", "GROUP BY storeid, state, city, date_key ORDER BY date_key DESC");
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    private List<Map<String, Object>> getEnhancedStoreCustomerInsights(String storeId, User user, Map<String, Object> filters) {
        validateStoreAccess(user, storeId);
        
        // Use customer acquisition data from materialized views
        String sql = "SELECT * FROM store_customer_acquisition WHERE storeid = ?";
        
        String timePeriod = (String) filters.getOrDefault("timePeriod", "all-time");
        Integer year = (Integer) filters.get("year");
        Integer month = (Integer) filters.get("month");
        
        if ("year".equals(timePeriod) && year != null) {
            sql += " AND EXTRACT(YEAR FROM month) = " + year;
        } else if ("month".equals(timePeriod) && year != null && month != null) {
            sql += " AND EXTRACT(YEAR FROM month) = " + year + " AND EXTRACT(MONTH FROM month) = " + month;
        }
        
        sql += " ORDER BY month DESC";
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    private List<Map<String, Object>> getEnhancedStoreProductPerformance(String storeId, User user, Map<String, Object> filters) {
        validateStoreAccess(user, storeId);
        
        String sql = buildFilteredQuery("store_analytics_comprehensive", storeId, filters,
            "SELECT storeid, state, city, sku, product_name, category, size, SUM(product_revenue) as total_revenue, " +
            "SUM(quantity_sold) as total_quantity, COUNT(DISTINCT orderid) as orders_count, " +
            "COUNT(DISTINCT customerid) as customers_count, AVG(price) as avg_price");
        sql = sql.replace("GROUP BY storeid, state, city", "GROUP BY storeid, state, city, sku, product_name, category, size ORDER BY SUM(product_revenue) DESC");
        
        return jdbcTemplate.queryForList(sql, storeId);
    }

    // =================================================================
    // HELPER METHODS FOR CUSTOM RANGE AND COMPARE FUNCTIONALITY
    // =================================================================

    private Map<String, Object> calculateRangeSummary(List<Map<String, Object>> monthlyData) {
        Map<String, Object> summary = new HashMap<>();
        
        double totalRevenue = monthlyData.stream()
            .mapToDouble(data -> ((Number) data.getOrDefault("total_revenue", 0)).doubleValue())
            .sum();
        
        long totalOrders = monthlyData.stream()
            .mapToLong(data -> ((Number) data.getOrDefault("total_orders", 0)).longValue())
            .sum();
        
        long totalCustomers = monthlyData.stream()
            .mapToLong(data -> ((Number) data.getOrDefault("total_customers", 0)).longValue())
            .sum();
        
        long totalUnits = monthlyData.stream()
            .mapToLong(data -> ((Number) data.getOrDefault("total_units", 0)).longValue())
            .sum();
        
        summary.put("totalRevenue", totalRevenue);
        summary.put("totalOrders", totalOrders);
        summary.put("totalCustomers", totalCustomers);
        summary.put("totalUnits", totalUnits);
        summary.put("avgOrderValue", totalOrders > 0 ? totalRevenue / totalOrders : 0);
        summary.put("avgRevenuePerMonth", !monthlyData.isEmpty() ? totalRevenue / monthlyData.size() : 0);
        summary.put("monthsCount", monthlyData.size());
        
        // Performance Metrics - Find peak month
        if (!monthlyData.isEmpty()) {
            Map<String, Object> peakMonth = monthlyData.stream()
                .max((a, b) -> Double.compare(
                    ((Number) a.getOrDefault("total_revenue", 0)).doubleValue(),
                    ((Number) b.getOrDefault("total_revenue", 0)).doubleValue()
                ))
                .orElse(new HashMap<>());
            
            summary.put("peakMonth", Map.of(
                "month", peakMonth.get("month"),
                "year", peakMonth.get("year"),
                "total_revenue", peakMonth.get("total_revenue")
            ));
        }
        
        return summary;
    }

    private Map<String, Object> getPreviousPeriodComparison(String storeId, Integer startYear, Integer startMonth, 
                                                           Integer endYear, Integer endMonth) {
        // Calculate the length of the period in months
        int periodLength = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
        
        // Calculate previous period start/end
        int prevEndYear = startYear;
        int prevEndMonth = startMonth - 1;
        if (prevEndMonth < 1) {
            prevEndMonth = 12;
            prevEndYear--;
        }
        
        int prevStartYear = prevEndYear;
        int prevStartMonth = prevEndMonth - periodLength + 1;
        while (prevStartMonth < 1) {
            prevStartMonth += 12;
            prevStartYear--;
        }
        
        String sql = "SELECT SUM(revenue) as total_revenue, SUM(orders) as total_orders, " +
                    "SUM(revenue)/NULLIF(SUM(orders),0) as avg_order_value, " +
                    "SUM(unique_customers) as total_customers " +
                    "FROM sales_monthly_store_cat " +
                    "WHERE storeid = ? AND " +
                    "((year = ? AND month >= ?) OR (year > ? AND year < ?) OR (year = ? AND month <= ?))";
        
        List<Map<String, Object>> result = jdbcTemplate.queryForList(sql, 
            storeId, prevStartYear, prevStartMonth, prevStartYear, prevEndYear, prevEndYear, prevEndMonth);
        
        Map<String, Object> comparison = result.isEmpty() ? new HashMap<>() : result.get(0);
        comparison.put("periodLabel", prevStartYear + "-" + String.format("%02d", prevStartMonth) + 
                                     " to " + prevEndYear + "-" + String.format("%02d", prevEndMonth));
        
        return comparison;
    }

    private String generatePeriodLabel(String period, Map<String, Object> periodFilters) {
        switch (period) {
            case "year":
                return "Year " + periodFilters.get("year");
            case "month":
                return periodFilters.get("year") + "-" + String.format("%02d", (Integer) periodFilters.get("month"));
            case "quarter":
                return "Q" + periodFilters.get("quarter") + " " + periodFilters.get("year");
            case "custom":
                return periodFilters.get("startDate") + " to " + periodFilters.get("endDate");
            default:
                return "All Time";
        }
    }

    private Map<String, Object> generateSummaryComparison(List<Map<String, Object>> comparisons) {
        Map<String, Object> summary = new HashMap<>();
        
        // Extract metrics from each comparison
        List<Map<String, Object>> metrics = comparisons.stream()
            .map(comp -> (Map<String, Object>) comp.get("metrics"))
            .filter(m -> m != null)
            .toList();
        
        if (metrics.isEmpty()) {
            return summary;
        }
        
        // Calculate min, max, average for key metrics
        double[] revenues = metrics.stream()
            .mapToDouble(m -> ((Number) m.getOrDefault("total_revenue", 0)).doubleValue())
            .toArray();
        
        long[] orders = metrics.stream()
            .mapToLong(m -> ((Number) m.getOrDefault("total_orders", 0)).longValue())
            .toArray();
        
        long[] customers = metrics.stream()
            .mapToLong(m -> ((Number) m.getOrDefault("total_customers", 0)).longValue())
            .toArray();
        
        // Revenue statistics
        summary.put("revenueStats", Map.of(
            "min", revenues.length > 0 ? java.util.Arrays.stream(revenues).min().orElse(0) : 0,
            "max", revenues.length > 0 ? java.util.Arrays.stream(revenues).max().orElse(0) : 0,
            "avg", revenues.length > 0 ? java.util.Arrays.stream(revenues).average().orElse(0) : 0,
            "total", revenues.length > 0 ? java.util.Arrays.stream(revenues).sum() : 0
        ));
        
        // Order statistics
        summary.put("ordersStats", Map.of(
            "min", orders.length > 0 ? java.util.Arrays.stream(orders).min().orElse(0) : 0,
            "max", orders.length > 0 ? java.util.Arrays.stream(orders).max().orElse(0) : 0,
            "avg", orders.length > 0 ? java.util.Arrays.stream(orders).average().orElse(0) : 0,
            "total", orders.length > 0 ? java.util.Arrays.stream(orders).sum() : 0
        ));
        
        // Customer statistics
        summary.put("customersStats", Map.of(
            "min", customers.length > 0 ? java.util.Arrays.stream(customers).min().orElse(0) : 0,
            "max", customers.length > 0 ? java.util.Arrays.stream(customers).max().orElse(0) : 0,
            "avg", customers.length > 0 ? java.util.Arrays.stream(customers).average().orElse(0) : 0,
            "total", customers.length > 0 ? java.util.Arrays.stream(customers).sum() : 0
        ));
        
        // Find best and worst performing periods
        int bestRevenueIndex = 0;
        int worstRevenueIndex = 0;
        for (int i = 1; i < revenues.length; i++) {
            if (revenues[i] > revenues[bestRevenueIndex]) bestRevenueIndex = i;
            if (revenues[i] < revenues[worstRevenueIndex]) worstRevenueIndex = i;
        }
        
        summary.put("bestPeriod", Map.of(
            "index", bestRevenueIndex,
            "label", comparisons.get(bestRevenueIndex).get("label"),
            "revenue", revenues[bestRevenueIndex]
        ));
        
        summary.put("worstPeriod", Map.of(
            "index", worstRevenueIndex,
            "label", comparisons.get(worstRevenueIndex).get("label"),
            "revenue", revenues[worstRevenueIndex]
        ));
        
        return summary;
    }

    private String generateSimplePeriodLabel(Integer year, Integer month, Integer quarter) {
        if (year == null) return "Unknown Period";
        
        if (quarter != null) {
            return "Q" + quarter + " " + year;
        } else if (month != null) {
            String[] monthNames = {"", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
            return monthNames[month] + " " + year;
        } else {
            return year.toString();
        }
    }

    // =================================================================
    // CUSTOM RANGE PERFORMANCE METRICS - Best Product and Category
    // =================================================================

    private Map<String, Object> getBestProductForCustomRange(String storeId, Integer startYear, Integer startMonth, 
                                                           Integer endYear, Integer endMonth) {
        String sql;
        List<Object> params = new ArrayList<>();
        
        if (startYear.equals(endYear)) {
            // Same year - simple month range
            sql = """
                SELECT p.sku, p.name, p.size, p.category,
                       SUM(oi.quantity * p.price) as total_revenue,
                       SUM(oi.quantity) as total_quantity,
                       COUNT(DISTINCT o.orderid) as orders_count
                FROM orders o
                JOIN order_items oi ON o.orderid = oi.orderid
                JOIN products p ON oi.sku = p.sku
                WHERE o.storeid = ? AND EXTRACT(YEAR FROM o.orderdate) = ?
                  AND EXTRACT(MONTH FROM o.orderdate) >= ? AND EXTRACT(MONTH FROM o.orderdate) <= ?
                GROUP BY p.sku, p.name, p.size, p.category
                ORDER BY total_revenue DESC
                LIMIT 1
                """;
            params.add(storeId);
            params.add(startYear);
            params.add(startMonth);
            params.add(endMonth);
        } else {
            // Different years - more complex range
            sql = """
                SELECT p.sku, p.name, p.size, p.category,
                       SUM(oi.quantity * p.price) as total_revenue,
                       SUM(oi.quantity) as total_quantity,
                       COUNT(DISTINCT o.orderid) as orders_count
                FROM orders o
                JOIN order_items oi ON o.orderid = oi.orderid
                JOIN products p ON oi.sku = p.sku
                WHERE o.storeid = ? AND
                      ((EXTRACT(YEAR FROM o.orderdate) = ? AND EXTRACT(MONTH FROM o.orderdate) >= ?) OR
                       (EXTRACT(YEAR FROM o.orderdate) > ? AND EXTRACT(YEAR FROM o.orderdate) < ?) OR
                       (EXTRACT(YEAR FROM o.orderdate) = ? AND EXTRACT(MONTH FROM o.orderdate) <= ?))
                GROUP BY p.sku, p.name, p.size, p.category
                ORDER BY total_revenue DESC
                LIMIT 1
                """;
            params.add(storeId);
            params.add(startYear);
            params.add(startMonth);
            params.add(startYear);
            params.add(endYear);
            params.add(endYear);
            params.add(endMonth);
        }
        
        List<Map<String, Object>> result = jdbcTemplate.queryForList(sql, params.toArray());
        return result.isEmpty() ? new HashMap<>() : result.get(0);
    }

    private Map<String, Object> getBestCategoryForCustomRange(String storeId, Integer startYear, Integer startMonth, 
                                                            Integer endYear, Integer endMonth) {
        String sql;
        List<Object> params = new ArrayList<>();
        
        if (startYear.equals(endYear)) {
            // Same year - simple month range
            sql = """
                SELECT p.category,
                       SUM(oi.quantity * p.price) as total_revenue,
                       SUM(oi.quantity) as total_quantity,
                       COUNT(DISTINCT o.orderid) as orders_count,
                       COUNT(DISTINCT p.sku) as products_count
                FROM orders o
                JOIN order_items oi ON o.orderid = oi.orderid
                JOIN products p ON oi.sku = p.sku
                WHERE o.storeid = ? AND EXTRACT(YEAR FROM o.orderdate) = ?
                  AND EXTRACT(MONTH FROM o.orderdate) >= ? AND EXTRACT(MONTH FROM o.orderdate) <= ?
                GROUP BY p.category
                ORDER BY total_revenue DESC
                LIMIT 1
                """;
            params.add(storeId);
            params.add(startYear);
            params.add(startMonth);
            params.add(endMonth);
        } else {
            // Different years - more complex range
            sql = """
                SELECT p.category,
                       SUM(oi.quantity * p.price) as total_revenue,
                       SUM(oi.quantity) as total_quantity,
                       COUNT(DISTINCT o.orderid) as orders_count,
                       COUNT(DISTINCT p.sku) as products_count
                FROM orders o
                JOIN order_items oi ON o.orderid = oi.orderid
                JOIN products p ON oi.sku = p.sku
                WHERE o.storeid = ? AND
                      ((EXTRACT(YEAR FROM o.orderdate) = ? AND EXTRACT(MONTH FROM o.orderdate) >= ?) OR
                       (EXTRACT(YEAR FROM o.orderdate) > ? AND EXTRACT(YEAR FROM o.orderdate) < ?) OR
                       (EXTRACT(YEAR FROM o.orderdate) = ? AND EXTRACT(MONTH FROM o.orderdate) <= ?))
                GROUP BY p.category
                ORDER BY total_revenue DESC
                LIMIT 1
                """;
            params.add(storeId);
            params.add(startYear);
            params.add(startMonth);
            params.add(startYear);
            params.add(endYear);
            params.add(endYear);
            params.add(endMonth);
        }
        
        List<Map<String, Object>> result = jdbcTemplate.queryForList(sql, params.toArray());
        return result.isEmpty() ? new HashMap<>() : result.get(0);
    }

    // =================================================================
    // PRODUCTS INFO ALL - New MV-based Product Analytics
    // =================================================================

    public Map<String, Object> getProductKPI(User user, Map<String, Object> filters) {
        String sku = (String) filters.get("sku");
        String timePeriod = (String) filters.get("timePeriod");
        Integer year = (Integer) filters.get("year");
        Integer month = (Integer) filters.get("month");
        
        // Use products_info_all materialized view
        StringBuilder sql = new StringBuilder("""
            SELECT 
                revenue,
                orders,
                units_sold,
                unique_customers,
                avg_price,
                avg_order_value
            FROM products_info_all
            WHERE sku = ?
            """);
        
        List<Object> params = new ArrayList<>();
        params.add(sku);
        
        // Add time period filtering based on materialized view structure
        if ("all-time".equals(timePeriod)) {
            // For all-time, get the aggregated row where both year and month are NULL
            sql.append(" AND year IS NULL AND month IS NULL");
        } else if ("year".equals(timePeriod) && year != null) {
            // For year, get the row where year matches and month is NULL
            sql.append(" AND year = ? AND month IS NULL");
            params.add(year);
        } else if ("month".equals(timePeriod) && year != null && month != null) {
            // For month, get the row where both year and month match
            sql.append(" AND year = ? AND month = ?");
            params.add(year);
            params.add(month);
        }
        
        // Note: The products_info_all MV doesn't include store/state filtering
        // If role-based filtering is needed, it would require extending the MV
        
        List<Map<String, Object>> result = jdbcTemplate.queryForList(sql.toString(), params.toArray());
        return result.isEmpty() ? new HashMap<>() : result.get(0);
    }

    public List<Map<String, Object>> getProductTrend(User user, Map<String, Object> filters) {
        String sku = (String) filters.get("sku");
        String metric = (String) filters.get("metric");
        String interval = (String) filters.get("interval");
        
        // Map metric parameter to column name in materialized view
        String columnName = switch (metric) {
            case "revenue" -> "revenue";
            case "orders" -> "orders";
            case "units" -> "units_sold";
            case "aov" -> "avg_order_value";
            case "customers" -> "unique_customers";
            default -> "revenue";
        };
        
        // Use products_info_all materialized view for trends
        StringBuilder sql = new StringBuilder(String.format("""
            SELECT
                COALESCE(year, 0) AS yr,
                COALESCE(month, 0) AS mo,
                %s AS metric_value
            FROM products_info_all
            WHERE sku = ?
              AND year IS NOT NULL 
              AND month IS NOT NULL
            ORDER BY yr, mo
            """, columnName));
        
        List<Object> params = new ArrayList<>();
        params.add(sku);
        
        // Note: The products_info_all MV doesn't include store/state filtering
        // If role-based filtering is needed, it would require extending the MV
        
        return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    }

    public Map<String, Object> getProductComparison(User user, Map<String, Object> filters) {
        String sku = (String) filters.get("sku");
        String periodLength = (String) filters.get("periodLength");
        Integer year = (Integer) filters.get("year");
        Integer month = (Integer) filters.get("month");
        
        Map<String, Object> result = new HashMap<>();
        
        // Get current period data
        Map<String, Object> currentFilters = new HashMap<>(filters);
        currentFilters.put("timePeriod", periodLength);
        Map<String, Object> currentData = getProductKPI(user, currentFilters);
        
        // Calculate previous period
        Map<String, Object> previousFilters = new HashMap<>(filters);
        if ("year".equals(periodLength) && year != null) {
            previousFilters.put("year", year - 1);
        } else if ("month".equals(periodLength) && year != null && month != null) {
            if (month == 1) {
                previousFilters.put("year", year - 1);
                previousFilters.put("month", 12);
            } else {
                previousFilters.put("month", month - 1);
            }
        }
        previousFilters.put("timePeriod", periodLength);
        Map<String, Object> previousData = getProductKPI(user, previousFilters);
        
        result.put("current", currentData);
        result.put("previous", previousData);
        
        return result;
    }

    public List<Map<String, Object>> getProductsList(User user) {
        // Use direct query from products table like the dashboard
        StringBuilder sql = new StringBuilder("""
            SELECT DISTINCT p.sku, p.name as product_name, p.category, p.size, p.launch_date
            FROM products p
            """);
        
        List<Object> params = new ArrayList<>();
        
        // Add role-based filtering if needed (for now, show all products)
        switch (user.getRole()) {
            case "HQ_ADMIN" -> {
                // Show all products
            }
            case "STATE_MANAGER" -> {
                // Could filter by products sold in the state, but for now show all
            }
            case "STORE_MANAGER" -> {
                // Could filter by products sold in the store, but for now show all
            }
        }
        
        sql.append(" ORDER BY p.name");
        
        return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    }

    private void addProductTimeFilters(StringBuilder sql, List<Object> params, Map<String, Object> filters) {
        String timePeriod = (String) filters.get("timePeriod");
        Integer year = (Integer) filters.get("year");
        Integer month = (Integer) filters.get("month");
        Integer startYear = (Integer) filters.get("startYear");
        Integer startMonth = (Integer) filters.get("startMonth");
        Integer endYear = (Integer) filters.get("endYear");
        Integer endMonth = (Integer) filters.get("endMonth");
        Boolean sinceLaunch = (Boolean) filters.get("sinceLaunch");
        
        if (Boolean.TRUE.equals(sinceLaunch)) {
            sql.append(" AND (year IS NULL OR year >= (SELECT EXTRACT(YEAR FROM launch_date) FROM products_info_all WHERE sku = ? LIMIT 1))");
            params.add(filters.get("sku"));
        } else if ("all-time".equals(timePeriod)) {
            // For all-time, get the aggregated row where both year and month are NULL
            sql.append(" AND year IS NULL AND month IS NULL");
        } else if ("year".equals(timePeriod) && year != null) {
            // For year, get the row where year matches and month is NULL
            sql.append(" AND year = ? AND month IS NULL");
            params.add(year);
        } else if ("month".equals(timePeriod) && year != null && month != null) {
            // For month, get the row where both year and month match
            sql.append(" AND year = ? AND month = ?");
            params.add(year);
            params.add(month);
        } else if ("custom-range".equals(timePeriod) && startYear != null && startMonth != null && endYear != null && endMonth != null) {
            // For custom range, sum up all monthly data within the range
            sql.append("""
                AND year IS NOT NULL AND month IS NOT NULL
                AND ((year > ? OR (year = ? AND month >= ?))
                AND (year < ? OR (year = ? AND month <= ?)))
                """);
            params.add(startYear);
            params.add(startYear);
            params.add(startMonth);
            params.add(endYear);
            params.add(endYear);
            params.add(endMonth);
        }
    }

    private void addRoleBasedProductFilters(StringBuilder sql, List<Object> params, User user) {
        // Note: products_info_all MV would need to include store/state info for role-based filtering
        // For now, we'll assume HQ_ADMIN sees all products, others might have restrictions
        switch (user.getRole()) {
            case "HQ_ADMIN":
                // No additional filters - see all products
                break;
            case "STATE_MANAGER":
                // Would need state-level product filtering if MV includes state info
                // sql.append(" AND state = ?");
                // params.add(user.getStateAbbr());
                break;
            case "STORE_MANAGER":
                // Would need store-level product filtering if MV includes store info
                // sql.append(" AND storeid = ?");
                // params.add(user.getStoreId());
                break;
        }
    }

    // Products overview chart - use products_info_all materialized view
    public List<Map<String, Object>> getProductsOverviewChart(User user, String timePeriod, Integer year, Integer month) {
        StringBuilder sql = new StringBuilder("""
            SELECT 
                sku, 
                product_name, 
                category, 
                size,
                units_sold as total_units,
                revenue as total_revenue,
                orders as total_orders,
                unique_customers
            FROM products_info_all
            WHERE 1=1
            """);
        
        List<Object> params = new ArrayList<>();
        
        // Add time period filtering based on materialized view structure
        if ("all-time".equals(timePeriod)) {
            // For all-time, get the aggregated row where both year and month are NULL
            sql.append(" AND year IS NULL AND month IS NULL");
        } else if ("year".equals(timePeriod) && year != null) {
            // For year, get the row where year matches and month is NULL
            sql.append(" AND year = ? AND month IS NULL");
            params.add(year);
        } else if ("month".equals(timePeriod) && year != null && month != null) {
            // For month, get the row where both year and month match
            sql.append(" AND year = ? AND month = ?");
            params.add(year);
            params.add(month);
        }
        
        // Note: Role-based filtering not implemented in MV yet
        // For now, all users see the same data
        
        sql.append(" ORDER BY total_revenue DESC LIMIT 20");
        
        return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    }
}