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
import pizzaworld.dto.KpisGlobalStoreDto;

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

    @Cacheable(value = "hourlyAnalytics", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr + '_' + #year + '_' + #month")
    public List<Map<String, Object>> getHourlyPerformanceAnalytics(User user, Integer year, Integer month) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getHourlyPerformanceAnalytics(null, null, year, month);
            case "STATE_MANAGER" -> repo.getHourlyPerformanceAnalytics(null, user.getStateAbbr(), year, month);
            case "STORE_MANAGER" -> repo.getHourlyPerformanceAnalytics(user.getStoreId(), null, year, month);
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    @Cacheable(value = "productAnalytics", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr + '_' + #category + '_' + #year + '_' + #month + '_' + #limit")
    public List<Map<String, Object>> getProductPerformanceAnalytics(User user, String category, Integer year, Integer month, Integer limit) {
        if (limit == null) limit = 50; // Default limit
        
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getProductPerformanceAnalytics(null, null, category, year, month, limit);
            case "STATE_MANAGER" -> repo.getProductPerformanceAnalytics(null, user.getStateAbbr(), category, year, month, limit);
            case "STORE_MANAGER" -> repo.getProductPerformanceAnalytics(user.getStoreId(), null, category, year, month, limit);
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    @Cacheable(value = "peakHours", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr + '_' + #year + '_' + #month")
    public List<Map<String, Object>> getPeakHoursAnalysis(User user, Integer year, Integer month) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getPeakHoursAnalysis(null, null, year, month);
            case "STATE_MANAGER" -> repo.getPeakHoursAnalysis(null, user.getStateAbbr(), year, month);
            case "STORE_MANAGER" -> repo.getPeakHoursAnalysis(user.getStoreId(), null, year, month);
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

    @Cacheable(value = "seasonalAnalysis", key = "#user.role + '_' + #user.storeId + '_' + #user.stateAbbr + '_' + #year + '_' + #season")
    public List<Map<String, Object>> getSeasonalBusinessAnalysis(User user, Integer year, String season) {
        return switch (user.getRole()) {
            case "HQ_ADMIN" -> repo.getSeasonalBusinessAnalysis(null, null, year, season);
            case "STATE_MANAGER" -> repo.getSeasonalBusinessAnalysis(null, user.getStateAbbr(), year, season);
            case "STORE_MANAGER" -> repo.getSeasonalBusinessAnalysis(user.getStoreId(), null, year, season);
            default -> throw new AccessDeniedException("Unknown role: " + user.getRole());
        };
    }

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