# PizzaWorld Backend API Analysis & Frontend Patterns

## Overview
This document provides a comprehensive analysis of the PizzaWorld application's backend APIs, frontend patterns, and data structures. It serves as a reference for implementing enhanced dashboard features, specifically for creating a sophisticated products page that matches the store_details page functionality.

## Table of Contents
1. [Backend API Structure](#backend-api-structure)
2. [Frontend Service Patterns](#frontend-service-patterns)
3. [Store Details Page Analysis](#store-details-page-analysis)
4. [Product-Related APIs](#product-related-apis)
5. [Database Tables & Data Sources](#database-tables--data-sources)
6. [Time Filtering Patterns](#time-filtering-patterns)
7. [Chart Implementation Patterns](#chart-implementation-patterns)
8. [KPI Cards Structure](#kpi-cards-structure)
9. [Export Functionality](#export-functionality)
10. [Implementation Recommendations](#implementation-recommendations)

---

## Backend API Structure

### Core Controller: OptimizedPizzaController.java
**Location:** `/src/main/java/pizzaworld/controller/OptimizedPizzaController.java`

### Base URL Pattern
- All APIs use: `/api/v2/` prefix
- Role-based authentication via `@AuthenticationPrincipal CustomUserDetails`
- Three user roles: `HQ_ADMIN`, `STATE_MANAGER`, `STORE_MANAGER`

### Key Service: OptimizedPizzaService.java
**Location:** `/src/main/java/pizzaworld/service/OptimizedPizzaService.java`

---

## Frontend Service Patterns

### Core Service: kpi.service.ts
**Location:** `/frontend/src/app/core/kpi.service.ts`

### Authentication Pattern
```typescript
const token = localStorage.getItem('authToken');
const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
```

### Caching Strategy
- **Observable Cache**: `shareReplay(1, 600000)` (10 minutes)
- **Memory Cache**: Fast in-memory access
- **localStorage Cache**: Persistent across sessions
- **Date-specific Caches**: For time-based analytics

---

## Store Details Page Analysis

### Component: store-details.component.ts
**Location:** `/frontend/src/app/pages/stores/store-details/store-details.component.ts`

### Key Features to Replicate
1. **Time Period Filtering**
2. **KPI Cards with Dynamic Colors**
3. **Custom Range Analysis**
4. **Compare Periods Functionality**
5. **Advanced Charts with ApexCharts**
6. **Export Capabilities**
7. **Comprehensive Analytics**

### Time Period Options
```typescript
selectedTimePeriod: 'all-time' | 'year' | 'month' | 'quarter' | 'custom-range' | 'compare'
```

### KPI Card Structure
```typescript
kpiCards: Array<{
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  color: string;        // Tailwind gradient classes
  textColor: string;    // Usually 'text-white'
}>
```

### Color Themes by Mode
- **Regular Mode**: Orange gradients (`from-orange-500 to-orange-600`)
- **Custom Range**: Purple gradients (`from-purple-500 to-purple-600`)
- **Compare Mode**: Blue gradients or distinct colors per period

---

## Product-Related APIs

### Current Backend Endpoints

#### 1. Top Products
```http
GET /api/v2/products/top
Parameters:
  - category (optional): String
  - limit (default: 20): Integer
Response: List of top products by revenue
```

#### 2. Product Performance Analytics
```http
GET /api/v2/analytics/product-performance
Parameters:
  - category (optional): String
Response: Detailed product performance metrics
```

#### 3. Category Performance
```http
GET /api/v2/analytics/category-performance
Response: Category-level revenue and performance data
```

#### 4. Store-Specific Product Performance
```http
GET /api/v2/stores/{storeId}/analytics/product-performance
Parameters:
  - timePeriod (optional): String
  - year (optional): Integer
  - month (optional): Integer
  - quarter (optional): Integer
Response: Store-specific product performance with time filtering
```

#### 5. Export Endpoints
```http
GET /api/v2/products/top/export
GET /api/v2/analytics/product-performance/export
```

### Frontend Service Methods

#### Existing Methods
```typescript
// Basic product loading (maps to /api/v2/products/top?limit=100)
getAllProducts(): Observable<ProductInfo[]>

// Cached product access
getCachedProducts(): ProductInfo[] | null

// Store-specific with filters
getStoreProductPerformance(storeId: string, filters?: Partial<ChartFilterOptions>): Observable<ProductPerformancePoint[]>
```

#### Enhanced Methods Added
```typescript
// Enhanced analytics (maps to /api/v2/analytics/product-performance)
getProductPerformanceAnalytics(category?: string): Observable<ProductPerformancePoint[]>

// Category performance (maps to /api/v2/analytics/category-performance)
getProductCategoryPerformance(): Observable<any[]>

// Top products with filters (maps to /api/v2/products/top)
getTopProductsEnhanced(category?: string, limit?: number): Observable<any[]>

// Store products with time filters
getStoreProductPerformanceWithFilters(storeId: string, filters: Partial<ChartFilterOptions>): Observable<ProductPerformancePoint[]>

// Export functionality
exportProductPerformanceAnalytics(category?: string, limit?: number): Observable<Blob>
```

---

## Database Tables & Data Sources

### Primary Tables Used by Store Analytics

#### 1. `store_analytics_comprehensive`
**Purpose**: Detailed transactional data with product-level information
```sql
Fields:
- storeid, state, city
- sku, product_name, category, size
- product_revenue, quantity_sold, price
- orderid, customerid, order_total
- date_key, hour_of_day
```

#### 2. `sales_monthly_store_cat`
**Purpose**: Monthly aggregated data by store and category
```sql
Fields:
- storeid, state_abbr
- category, revenue, units_sold
- orders, unique_customers
- year, month, year_month
```

#### 3. Materialized Views (Pre-computed)
```sql
top_products_hq       -- HQ-level product performance
top_products_state    -- State-level product performance  
top_products_store    -- Store-level product performance
category_performance_hq/state/store  -- Category analytics
```

### SQL Pattern Examples

#### Enhanced Store Product Performance
```sql
SELECT storeid, state, city, sku, product_name, category, size, 
       SUM(product_revenue) as total_revenue, 
       SUM(quantity_sold) as total_quantity, 
       COUNT(DISTINCT orderid) as orders_count, 
       COUNT(DISTINCT customerid) as customers_count, 
       AVG(price) as avg_price
FROM store_analytics_comprehensive 
WHERE storeid = ? 
[+ time filters]
GROUP BY storeid, state, city, sku, product_name, category, size 
ORDER BY SUM(product_revenue) DESC
```

#### Enhanced Store Category Performance
```sql
SELECT storeid, state_abbr, category, 
       SUM(revenue) as total_revenue, 
       SUM(units_sold) as units_sold, 
       SUM(orders) as total_orders, 
       SUM(unique_customers) as unique_customers, 
       SUM(revenue)/NULLIF(SUM(units_sold),0) as avg_item_price
FROM sales_monthly_store_cat 
WHERE storeid = ? 
[+ time filters]
GROUP BY storeid, state_abbr, category 
ORDER BY SUM(revenue) DESC
```

---

## Time Filtering Patterns

### Filter Options Structure
```typescript
interface ChartFilterOptions {
  timePeriod: 'all-time' | 'year' | 'month' | 'quarter' | 'custom-range' | 'compare';
  year?: number;
  month?: number;
  quarter?: number;
  startDate?: string;
  endDate?: string;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
}
```

### Backend Filter Building
```java
// Generic query builder with time filtering (buildFilteredQuery method)
private String buildFilteredQuery(String tableName, String storeId, Map<String, Object> filters, String selectClause) {
    StringBuilder query = new StringBuilder(selectClause);
    query.append(" FROM ").append(tableName);
    
    // Add WHERE conditions based on filters
    if (filters.get("timePeriod").equals("year")) {
        query.append(" AND year = :year");
    }
    if (filters.get("timePeriod").equals("month")) {
        query.append(" AND year = :year AND month = :month");
    }
    // ... more filter conditions
}
```

### Frontend Filter Implementation
```typescript
private buildFilterOptions(): Partial<ChartFilterOptions> {
  if (this.selectedTimePeriod === 'custom-range' || this.selectedTimePeriod === 'compare') {
    return { timePeriod: this.selectedTimePeriod };
  }

  return {
    timePeriod: this.selectedTimePeriod,
    year: this.selectedYear,
    month: this.selectedMonth,
    quarter: this.selectedQuarter
  };
}
```

---

## Chart Implementation Patterns

### ApexCharts Configuration Structure
```typescript
export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  title: ApexTitleSubtitle;
  dataLabels: ApexDataLabels;
  tooltip: ApexTooltip;
  plotOptions: ApexPlotOptions;
  stroke: ApexStroke;
  responsive: ApexResponsive[];
  legend: ApexLegend;
  colors: string[];
  fill: any;
  labels: string[];
};

export type PieChartOptions = {
  series: number[];
  chart: ApexChart;
  title: ApexTitleSubtitle;
  dataLabels: ApexDataLabels;
  plotOptions: ApexPlotOptions;
  legend: ApexLegend;
  colors: string[];
  labels: string[];
};
```

### Chart Color Palette
```typescript
colors: ['#FF6B35', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444']
```

### Chart Export Configuration
```typescript
toolbar: {
  show: true,
  export: {
    csv: {
      filename: `chart-data-${this.getTimePeriodLabel()}`,
      columnDelimiter: ',',
      headerCategory: 'Category',
      headerValue: 'Value'
    },
    svg: { filename: `chart-${this.getTimePeriodLabel()}` },
    png: { filename: `chart-${this.getTimePeriodLabel()}` }
  }
}
```

---

## KPI Cards Structure

### Card Data Structure
```typescript
kpiCards: Array<{
  title: string;        // "Total Revenue"
  value: string;        // "$1,234,567" (formatted)
  subtitle: string;     // Time period or description
  icon: string;         // PrimeNG icon class
  color: string;        // Tailwind gradient background
  textColor: string;    // Text color class
}>
```

### Color Schemes by Context
```typescript
// Regular analytics (Orange theme)
color: 'bg-gradient-to-r from-orange-500 to-orange-600'
color: 'bg-gradient-to-r from-orange-400 to-orange-500'
color: 'bg-gradient-to-r from-orange-600 to-orange-700'
color: 'bg-gradient-to-r from-orange-300 to-orange-400'

// Custom range analytics (Purple theme)
color: 'bg-gradient-to-r from-purple-500 to-purple-600'
color: 'bg-gradient-to-r from-purple-400 to-purple-500'
color: 'bg-gradient-to-r from-purple-600 to-purple-700'
color: 'bg-gradient-to-r from-purple-300 to-purple-400'
```

### KPI Calculation Patterns
```typescript
// Standard metrics calculation
const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
const totalOrders = data.reduce((sum, item) => sum + item.orders, 0);
const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
const uniqueCustomers = data.reduce((sum, item) => sum + item.customers, 0);
```

---

## Export Functionality

### CSV Export Pattern
```typescript
exportData(): void {
  const headers = ['Column1', 'Column2', 'Column3'];
  const csvContent = [
    headers.join(','),
    ...this.data.map(row => [
      row.field1,
      `"${row.field2}"`, // Quote strings with potential commas
      row.field3
    ].join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `data-${this.getTimePeriodLabel()}-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}
```

### Backend Export Endpoints
```java
@GetMapping("/export")
public void exportData(HttpServletResponse response, /* parameters */) {
    List<Map<String, Object>> data = service.getData(/* params */);
    
    if (data.isEmpty()) {
        CsvExportUtil.writeCsv(response, List.of("No Data"), List.of(), "filename.csv");
        return;
    }

    List<String> headers = List.copyOf(data.get(0).keySet());
    List<List<String>> rows = data.stream()
            .map(row -> headers.stream().map(h -> String.valueOf(row.get(h))).toList())
            .toList();

    CsvExportUtil.writeCsv(response, headers, rows, "filename.csv");
}
```

---

## Implementation Recommendations

### For Enhanced Products Page

#### 1. Follow Store Details Patterns
- Use the same time filtering UI components and logic
- Implement identical KPI card structure and styling
- Use the same chart configuration patterns
- Follow the same export functionality structure

#### 2. Backend API Usage
```typescript
// Use these specific APIs for products page
forkJoin({
  products: this.kpi.getAllProducts(),
  productPerformance: this.kpi.getProductPerformanceAnalytics(category),
  categoryPerformance: this.kpi.getProductCategoryPerformance(),
  topProducts: this.kpi.getTopProductsEnhanced(category, 10)
}).subscribe(/* handle results */);
```

#### 3. Data Sources Priority
1. **Primary**: Use materialized views (`top_products_*`, `category_performance_*`)
2. **Secondary**: Use `store_analytics_comprehensive` for detailed analysis
3. **Fallback**: Use `sales_monthly_store_cat` for category-level data

#### 4. Component Structure
```typescript
// Essential properties for products page
selectedTimePeriod: 'all-time' | 'year' | 'month' | 'quarter' | 'custom-range' | 'compare'
availableYears: TimePeriodOption[]
availableMonths: TimePeriodOption[]
kpiCards: KpiCard[]
productPerformance: ProductPerformancePoint[]
categoryPerformance: CategoryPerformancePoint[]
customRangeData: any
compareData: any
analyticsLoading: boolean
chartsReady: boolean
```

#### 5. Required Methods
```typescript
// Time filtering
onTimePeriodChange(): void
onYearChange(): void
onMonthChange(): void
loadCustomRangeData(): void
loadCompareData(): void

// Data loading
loadProductAnalytics(): void
buildFilterOptions(): Partial<ChartFilterOptions>
updateKpiCards(): void

// Charts
buildProductAnalyticsCharts(): void
buildRevenueTrendChart(): void
buildCategoryChart(): void
buildPerformanceChart(): void

// Export
exportProducts(): void
exportChartData(chartType: string): void
```

#### 6. File Structure to Create/Modify
```
/frontend/src/app/pages/products/
├── products.component.ts        (enhance existing)
├── products.component.html      (enhance existing)
├── products.component.scss      (enhance existing)

/frontend/src/app/core/
├── kpi.service.ts              (add new methods)

Additional considerations:
- Use the same loading states pattern
- Implement the same error handling
- Follow the same caching strategy
- Use identical styling classes from store-details
```

---

## Key Takeaways

1. **Consistency**: The enhanced products page should mirror the store_details page functionality exactly
2. **Data Sources**: Prioritize materialized views for performance, fall back to raw tables for detailed analysis
3. **APIs**: Use the established `/api/v2/` endpoints with role-based access
4. **Patterns**: Follow the existing time filtering, KPI cards, and chart patterns precisely
5. **Performance**: Leverage caching at multiple levels (Observable, memory, localStorage)
6. **User Experience**: Maintain the same look, feel, and behavior as other dashboard pages

This analysis provides a complete foundation for implementing sophisticated dashboard features that integrate seamlessly with the existing PizzaWorld application architecture.