import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams }         from '@angular/common/http';
import { Observable, shareReplay, map, catchError, of }         from 'rxjs';
import { ProductsComponent, ProductInfo } from '../pages/products/products.component';

/** Entspricht DashboardKpiDto im Backend */
export interface DashboardKpiDto {
  revenue:   number;
  orders:    number;
  avgOrder:  number;
  customers: number;
  products:  number;
}

/** Store information interface */
export interface StoreInfo {
  storeid: string;
  zipcode: string;
  state_abbr: string;
  latitude: number;
  longitude: number;
  city: string; // City
  state: string;
  distance?: number;
}

/** Store performance data interface */
export interface StorePerformance {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  uniqueCustomers: number;
  lastUpdated: string;
}

/** Global KPIs interface */
export interface GlobalKPIs {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  totalCustomers: number;
  lastUpdated: string;
}

/** Performance data interface */
export interface PerformanceData {
  storePerformance: { [storeId: string]: StorePerformance };
  globalKPIs: GlobalKPIs;
}

/** Order information interface */
export interface OrderInfo {
  orderid: number;
  customerid: string;
  storeid: string;
  orderdate: string;
  nitems: number;
  total: number;
  store_city?: string;
  store_state?: string;
}

/** Paginated orders response interface */
export interface PaginatedOrdersResponse {
  orders: OrderInfo[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/** Order filters interface */
export interface OrderFilters {
  storeId?: string;
  customerId?: string;
  state?: string;
  orderId?: string;
  nitems?: string;
  from?: string;
  to?: string;
}

/** Global Store KPIs interface - matches kpis_global_store materialized view */
export interface GlobalStoreKpi {
  state: string;
  store_id: string;
  revenue: number;
  orders: number;
  avg_order_value: number;
  customers: number;
  last_updated: string;
}

/** Store Revenue Chart Data interface - matches store revenue by time periods view */
export interface StoreRevenueChartData {
  storeid: string;
  city: string;
  state_name?: string;
  state_abbr: string;
  year?: number;
  month?: number;
  quarter?: number;
  total_revenue?: number;
  monthly_revenue?: number;
  yearly_revenue?: number;
  quarterly_revenue?: number;
  order_count?: number;
  monthly_orders?: number;
  yearly_orders?: number;
  quarterly_orders?: number;
  unique_customers?: number;
  avg_order_value?: number;
  last_updated?: string;
}

/** Time Period Options interface */
export interface TimePeriodOption {
  year: number;
  month?: number;
  quarter?: number;
  year_label: string;
  month_label?: string;
  month_name_label?: string;
  quarter_label?: string;
}

/** Chart Filter Options interface */
export interface ChartFilterOptions {
  timePeriod: 'all-time' | 'year' | 'month' | 'quarter';
  year?: number;
  month?: number;
  quarter?: number;
  selectedStores?: string[];
}

// New interfaces for store-specific analytics
export interface StoreAnalyticsOverview {
  revenue: number;
  orders: number;
  avg_order_value: number;
  customers: number;
  last_updated: string;
}

export interface StoreRevenueTrend {
  date: string;
  revenue: number;
  orders: number;
}

export interface HourlyPerformancePoint {
  hour: number;
  revenue: number;
  orders: number;
}

export interface CategoryPerformancePoint {
  category: string;
  total_revenue: number;
  units_sold: number;
  avg_order_value: number;
}

export interface DailyOperationsPoint {
  date: string;
  revenue: number;
  orders: number;
  customers: number;
  avg_order_value: number;
}

export interface CustomerInsightsPoint {
  week_start: string;
  new_customers: number;
  returning_customers: number;
  total_revenue: number;
}

export interface ProductPerformancePoint {
  sku: string;
  product_name: string;
  total_revenue: number;
  total_quantity: number;
  orders_count: number;
}

export interface EfficiencyMetrics {
  efficiency_score: number;
  avg_orders_per_day: number;
  active_days: number;
  total_items_sold: number;
  avg_order_value: number;
  revenue_per_customer?: number;
}

@Injectable({ providedIn: 'root' })
export class KpiService {
  private http = inject(HttpClient);

  // Cache for dashboard KPIs - cache for 5 minutes
  private dashboardCache$: Observable<DashboardKpiDto> | null = null;

  // Cache for stores data - cache for 10 minutes
  private storesCache$: Observable<StoreInfo[]> | null = null;

  // In-memory cache for faster access
  private storesDataCache: StoreInfo[] | null = null;
  private performanceDataCache: PerformanceData | null = null;

  // Product data cache
  private productsCache$: Observable<ProductInfo[]> | null = null;
  private productsDataCache: ProductInfo[] | null = null;

  private recentOrdersCache: OrderInfo[] | null = null;

  /** Holt alle KPI‐Zahlen für das Dashboard - v2 optimized */
  getDashboard(): Observable<DashboardKpiDto> {
    if (!this.dashboardCache$) {
      const token = localStorage.getItem('authToken');
      const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
      this.dashboardCache$ = this.http.get<DashboardKpiDto>('/api/v2/dashboard/kpis', { headers })
        .pipe(shareReplay(1, 300000)); // Cache for 5 minutes
    }
    return this.dashboardCache$;
  }

  /** Clear cache when needed (e.g., after updates) */
  clearDashboardCache(): void {
    this.dashboardCache$ = null;
  }

  /** Holt alle Stores - v2 optimized */
  getAllStores(): Observable<StoreInfo[]> {
    if (!this.storesCache$) {
      const token = localStorage.getItem('authToken');
      const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

      console.log('🔄 Loading stores data from API...');

      this.storesCache$ = this.http.get<StoreInfo[]>('/api/v2/stores', { headers })
        .pipe(
          map(stores => {
            // Cache the stores data in both memory and localStorage
            this.storesDataCache = stores;
            localStorage.setItem('pizzaWorld_stores', JSON.stringify(stores));

            console.log(`✅ Stores data loaded: ${stores.length} locations`);
            return stores;
          }),
          catchError(error => {
            console.error('❌ Stores data loading failed:', error);
            throw error;
          }),
          shareReplay(1, 600000) // Cache for 10 minutes
        );
    }
    return this.storesCache$;
  }

  /** Get cached stores data - optimized for speed */
  getCachedStoresData(): StoreInfo[] | null {
    // First try in-memory cache (fastest)
    if (this.storesDataCache) {
      console.log('Stores data found in memory cache');
      return this.storesDataCache;
    }

    // Fallback to localStorage
    const cached = localStorage.getItem('pizzaWorld_stores');
    if (cached) {
      try {
        this.storesDataCache = JSON.parse(cached);
        console.log('Stores data loaded from localStorage');
        return this.storesDataCache;
      } catch (error) {
        console.error('Error parsing cached stores data:', error);
        localStorage.removeItem('pizzaWorld_stores');
      }
    }

    console.log('No cached stores data found');
    return null;
  }

  /** Clear stores cache when needed */
  clearStoresCache(): void {
    this.storesCache$ = null;
    this.storesDataCache = null;
  }

  /** Holt Orders-per-Day KPI */
  getOrdersPerDay(): Observable<any[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.get<any[]>('/api/kpi/orders-per-day', { headers });
  }

  /** Holt Sales-per-Day KPI */
  getSalesPerDay(): Observable<any[]> {
    return this.http.get<any[]>('/api/kpi/sales-per-day');
  }

  /** Holt Stores-per-Day KPI */
  getStoresPerDay(): Observable<any[]> {
    return this.http.get<any[]>('/api/kpi/stores-per-day');
  }

  /** Test method for Orders-per-Day KPI (no auth required) */
  getOrdersPerDayTest(): Observable<any[]> {
    return this.http.get<any[]>('/api/kpi/orders-per-day/test');
  }

  /** Fetches revenue by store for the dashboard chart - v2 optimized */
  getRevenueByStore(): Observable<any[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.get<any[]>('/api/v2/analytics/store-performance', { headers })
      .pipe(
        catchError(error => {
          console.error('❌ Revenue by store data loading failed:', error);
          return of([]);
        })
      );
  }

  /** Fetches sales KPIs for a date range - v2 optimized */
  getSalesKPIs(from: string, to: string): Observable<any> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.get<any>(`/api/v2/sales/kpis?from=${from}&to=${to}`, { headers })
      .pipe(
        map(data => {
          // Cache the sales KPIs data
          const cacheKey = `pizzaWorld_sales_kpis_${from}_${to}`;
          localStorage.setItem(cacheKey, JSON.stringify(data));
          return data;
        }),
        catchError(error => {
          // Try to get cached data if API fails
          const cacheKey = `pizzaWorld_sales_kpis_${from}_${to}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            console.log('Using cached sales KPIs data');
            return of(JSON.parse(cached));
          }
          throw error;
        })
      );
  }

  /** Fetches store-specific statistics and performance data */
  getStoreStats(storeId: string): Observable<any> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    // Use the test endpoint for debugging (no authentication required)
    return this.http.get<any>(`/api/stores/${storeId}/kpis/test`, { headers });
  }

  /** Load all performance data and cache it */
  loadPerformanceData(): Observable<PerformanceData> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    console.log('🔄 Processing store performance data (this may take a moment for 32 stores)...');

    return this.http.get<PerformanceData>('/api/dashboard/performance-data', { headers }).pipe(
      map((data) => this.cachePerformanceData(data)),
      catchError((primaryErr) => {
        console.warn('⚠️ Primary performance-data endpoint failed – falling back to legacy:', primaryErr);
        return this.http
          .get<PerformanceData>('/api/dashboard/performance-data/legacy', { headers })
          .pipe(
            map((legacyData) => this.cachePerformanceData(legacyData)),
            catchError((legacyErr) => {
              console.error('❌ Legacy performance-data endpoint also failed:', legacyErr);
              throw legacyErr;
            })
          );
      })
    );
  }

  /** helper to store performance data */
  private cachePerformanceData(data: PerformanceData): PerformanceData {
    // Cache in memory + localStorage
    this.performanceDataCache = data;
    localStorage.setItem('pizzaWorld_performance', JSON.stringify(data));

    const storeCount = Object.keys(data.storePerformance).length;
    console.log(`✅ Store performance data processed: ${storeCount} stores, $${data.globalKPIs.totalRevenue.toLocaleString()} total revenue`);
    return data;
  }

  /** Get cached performance data - optimized for speed */
  getCachedPerformanceData(): PerformanceData | null {
    // First try in-memory cache (fastest)
    if (this.performanceDataCache) {
      console.log('Performance data found in memory cache');
      return this.performanceDataCache;
    }

    // Fallback to localStorage
    const cached = localStorage.getItem('pizzaWorld_performance');
    if (cached) {
      try {
        this.performanceDataCache = JSON.parse(cached);
        console.log('Performance data loaded from localStorage');
        return this.performanceDataCache;
      } catch (error) {
        console.error('Error parsing cached performance data:', error);
        localStorage.removeItem('pizzaWorld_performance');
      }
    }

    console.log('No cached performance data found');
    return null;
  }

  /** Clear cached performance data */
  clearPerformanceCache(): void {
    this.performanceDataCache = null;
    localStorage.removeItem('pizzaWorld_performance');
  }

  /** Check if cached data is fresh (less than 24 hours old) */
  isCachedDataFresh(): boolean {
    const cached = this.getCachedPerformanceData();
    if (!cached) return false;

    const lastUpdated = new Date(cached.globalKPIs.lastUpdated);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

    return hoursDiff < 24;
  }

  /** Get specific store performance data - optimized for speed */
  getStorePerformance(storeId: string): StorePerformance | null {
    const performanceData = this.getCachedPerformanceData();
    return performanceData?.storePerformance[storeId] || null;
  }

  /** Load all products from backend API - v2 optimized */
  getAllProducts(): Observable<ProductInfo[]> {
    if (!this.productsCache$) {
      const token = localStorage.getItem('authToken');
      const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

      console.log('🔄 Loading products data from API...');

      this.productsCache$ = this.http.get<any[]>('/api/v2/products/top?limit=100', { headers })
        .pipe(
          map(backendProducts => {
            // Transform backend data to frontend format
            const products = backendProducts.map(backendProduct => ({
              sku: backendProduct.sku,
              name: backendProduct.name,
              category: backendProduct.category,
              price: Number(backendProduct.price),
              size: backendProduct.size,
              ingredients: backendProduct.ingredients,
              launch: backendProduct.launch,
              totalOrders: Number(backendProduct.total_orders),
              uniqueCustomers: Number(backendProduct.customers),
              revenue: Number(backendProduct.revenue),
              avgOrder: Number(backendProduct.avg_order || backendProduct.price)
            }));

            // Cache the products data in both memory and localStorage
            this.productsDataCache = products;
            localStorage.setItem('pizzaWorld_products', JSON.stringify(products));

            console.log(`✅ Products data loaded: ${products.length} products`);
            return products;
          }),
          catchError(error => {
            console.error('❌ Products data loading failed:', error);
            throw error;
          }),
          shareReplay(1, 600000) // Cache for 10 minutes
        );
    }
    return this.productsCache$;
  }

  /** Get cached products data */
  getCachedProducts(): ProductInfo[] | null {
    if (this.productsDataCache) {
      return this.productsDataCache;
    }
    const cached = localStorage.getItem('pizzaWorld_products');
    if (cached) {
      try {
        this.productsDataCache = JSON.parse(cached);
        return this.productsDataCache;
      } catch (error) {
        localStorage.removeItem('pizzaWorld_products');
      }
    }
    return null;
  }

  /** Clear products cache */
  clearProductsCache(): void {
    this.productsCache$ = null;
    this.productsDataCache = null;
    localStorage.removeItem('pizzaWorld_products');
  }

  /** Clear all sales-related caches */
  clearSalesCaches(): void {
    // Clear all sales-related localStorage items
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('pizzaWorld_sales_') ||
          key && key.startsWith('pizzaWorld_best_products_') ||
          key && key.startsWith('pizzaWorld_stores_revenue_') ||
          key && key.startsWith('pizzaWorld_sales_trend_') ||
          key && key.startsWith('pizzaWorld_category_revenue_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log('Cleared all sales-related caches');
  }

  /** Clear all caches - comprehensive method */
  clearAllCaches(): void {
    this.clearDashboardCache();
    this.clearStoresCache();
    this.clearPerformanceCache();
    this.clearProductsCache();
    this.clearSalesCaches();
    console.log('All caches cleared');
  }

  // --------- SALES ANALYTICS METHODS ---------

  /** Fetches best selling products for a date range */
  getBestSellingProducts(from: string, to: string): Observable<any[]> {
    // Use test endpoint for debugging (no authentication required)
    return this.http.get<any[]>(`/api/sales/test/best-selling-products?from=${from}&to=${to}`)
      .pipe(
        map(data => {
          // Cache the best selling products data
          const cacheKey = `pizzaWorld_best_products_${from}_${to}`;
          localStorage.setItem(cacheKey, JSON.stringify(data));
          return data;
        }),
        catchError(error => {
          // Try to get cached data if API fails
          const cacheKey = `pizzaWorld_best_products_${from}_${to}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            console.log('Using cached best selling products data');
            return of(JSON.parse(cached));
          }
          throw error;
        })
      );
  }

  /** Fetches stores ranked by revenue for a date range */
  getStoresByRevenue(from: string, to: string): Observable<any[]> {
    // Use test endpoint for debugging (no authentication required)
    return this.http.get<any[]>(`/api/sales/test/stores-by-revenue?from=${from}&to=${to}`)
      .pipe(
        map(data => {
          // Cache the stores by revenue data
          const cacheKey = `pizzaWorld_stores_revenue_${from}_${to}`;
          localStorage.setItem(cacheKey, JSON.stringify(data));
          return data;
        }),
        catchError(error => {
          // Try to get cached data if API fails
          const cacheKey = `pizzaWorld_stores_revenue_${from}_${to}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            console.log('Using cached stores by revenue data');
            return of(JSON.parse(cached));
          }
          throw error;
        })
      );
  }

  /** Fetches sales trend by day for a date range */
  getSalesTrendByDay(from: string, to: string): Observable<any[]> {
    // Use test endpoint for debugging (no authentication required)
    return this.http.get<any[]>(`/api/sales/test/trend-by-day?from=${from}&to=${to}`)
      .pipe(
        map(data => {
          // Cache the sales trend data
          const cacheKey = `pizzaWorld_sales_trend_${from}_${to}`;
          localStorage.setItem(cacheKey, JSON.stringify(data));
          return data;
        }),
        catchError(error => {
          // Try to get cached data if API fails
          const cacheKey = `pizzaWorld_sales_trend_${from}_${to}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            console.log('Using cached sales trend data');
            return of(JSON.parse(cached));
          }
          throw error;
        })
      );
  }

  /** Fetches revenue by category for a date range */
  getRevenueByCategory(from: string, to: string): Observable<any[]> {
    // Use test endpoint for debugging (no authentication required)
    return this.http.get<any[]>(`/api/sales/test/revenue-by-category?from=${from}&to=${to}`)
      .pipe(
        map(data => {
          // Cache the revenue by category data
          const cacheKey = `pizzaWorld_category_revenue_${from}_${to}`;
          localStorage.setItem(cacheKey, JSON.stringify(data));
          return data;
        }),
        catchError(error => {
          // Try to get cached data if API fails
          const cacheKey = `pizzaWorld_category_revenue_${from}_${to}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            console.log('Using cached revenue by category data');
            return of(JSON.parse(cached));
          }
          throw error;
        })
      );
  }

  /** Debug method to check orders table */
  debugOrders(): Observable<any> {
    return this.http.get<any>('/api/debug/orders');
  }

  /** Get the earliest order date for All Time range */
  getEarliestOrderDate(): Observable<string> {
    // Include JWT if present to avoid 403 on secured endpoint
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    return this.http
      .get<{ earliestOrderDate: string }>('/api/orders/earliest-date', { headers })
      .pipe(map(res => res.earliestOrderDate));
  }

  /** Get cached All Time sales KPIs */
  getCachedAllTimeSalesKPIs(from: string, to: string): any | null {
    const cacheKey = `pizzaWorld_sales_kpis_${from}_${to}`;
    const cached = localStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : null;
  }
  /** Get cached All Time best selling products */
  getCachedAllTimeBestProducts(from: string, to: string): any[] {
    const cacheKey = `pizzaWorld_best_products_${from}_${to}`;
    const cached = localStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : [];
  }
  /** Get cached All Time stores by revenue */
  getCachedAllTimeStoresByRevenue(from: string, to: string): any[] {
    const cacheKey = `pizzaWorld_stores_revenue_${from}_${to}`;
    const cached = localStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : [];
  }
  /** Get cached All Time sales trend */
  getCachedAllTimeSalesTrend(from: string, to: string): any[] {
    const cacheKey = `pizzaWorld_sales_trend_${from}_${to}`;
    const cached = localStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : [];
  }
  /** Get cached All Time revenue by category */
  getCachedAllTimeRevenueByCategory(from: string, to: string): any[] {
    const cacheKey = `pizzaWorld_category_revenue_${from}_${to}`;
    const cached = localStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : [];
  }

  /** Debug method to check cache status */
  debugCacheStatus(): void {
    console.log('🔍 Cache Status Report:');

    // Check in-memory caches
    console.log('📦 In-Memory Caches:');
    console.log(`  - Dashboard: ${this.dashboardCache$ ? '✅ Loaded' : '❌ Empty'}`);
    console.log(`  - Stores: ${this.storesCache$ ? '✅ Loaded' : '❌ Empty'}`);
    console.log(`  - Products: ${this.productsCache$ ? '✅ Loaded' : '❌ Empty'}`);
    console.log(`  - Stores Data: ${this.storesDataCache ? `✅ ${this.storesDataCache.length} stores` : '❌ Empty'}`);
    console.log(`  - Performance Data: ${this.performanceDataCache ? '✅ Loaded' : '❌ Empty'}`);
    console.log(`  - Products Data: ${this.productsDataCache ? `✅ ${this.productsDataCache.length} products` : '❌ Empty'}`);

    // Check localStorage caches
    console.log('💾 LocalStorage Caches:');
    const pizzaWorldKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('pizzaWorld_')) {
        pizzaWorldKeys.push(key);
      }
    }

    if (pizzaWorldKeys.length > 0) {
      pizzaWorldKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              console.log(`  - ${key}: ✅ ${parsed.length} items`);
            } else if (typeof parsed === 'object') {
              console.log(`  - ${key}: ✅ Object with ${Object.keys(parsed).length} properties`);
            } else {
              console.log(`  - ${key}: ✅ ${typeof parsed}`);
            }
          } catch (e) {
            console.log(`  - ${key}: ❌ Invalid JSON`);
          }
        } else {
          console.log(`  - ${key}: ❌ Empty`);
        }
      });
    } else {
      console.log('  - No PizzaWorld caches found in localStorage');
    }
  }

  /** Check if all essential data is cached */
  isAllDataCached(): boolean {
    const storesData = this.getCachedStoresData();
    const productsData = this.getCachedProducts();
    const performanceData = this.getCachedPerformanceData();

    const hasStores = storesData !== null && storesData.length > 0;
    const hasProducts = productsData !== null && productsData.length > 0;
    const hasPerformance = performanceData !== null;

    console.log('🔍 Essential Data Cache Check:');
    console.log(`  - Stores: ${hasStores ? '✅' : '❌'}`);
    console.log(`  - Products: ${hasProducts ? '✅' : '❌'}`);
    console.log(`  - Performance: ${hasPerformance ? '✅' : '❌'}`);

    return hasStores && hasProducts && hasPerformance;
  }

  /** Get paginated orders with filtering and sorting - v2 optimized */
  getPaginatedOrders(
    filters: OrderFilters,
    page: number = 0,
    size: number = 50,
    sortBy: string = 'orderdate',
    sortOrder: string = 'DESC'
  ): Observable<PaginatedOrdersResponse> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    // Build query parameters
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    params.append('page', page.toString());
    params.append('size', size.toString());
    params.append('sortBy', sortBy);
    params.append('sortOrder', sortOrder);

    return this.http.get<PaginatedOrdersResponse>(`/api/v2/orders?${params.toString()}`, { headers })
      .pipe(
        map(data => {
          // Cache the paginated results
          const cacheKey = `pizzaWorld_orders_${JSON.stringify(filters)}_${page}_${size}_${sortBy}_${sortOrder}`;
          localStorage.setItem(cacheKey, JSON.stringify(data));
          return data;
        }),
        catchError(error => {
          // Try to get cached data if API fails
          const cacheKey = `pizzaWorld_orders_${JSON.stringify(filters)}_${page}_${size}_${sortBy}_${sortOrder}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            console.log('Using cached orders data');
            return of(JSON.parse(cached));
          }
          throw error;
        })
      );
  }

  /** Get recent orders for initial caching - v2 optimized */
  getRecentOrders(limit: number = 50): Observable<OrderInfo[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    return this.http.get<OrderInfo[]>(`/api/v2/orders/recent?limit=${limit}`, { headers })
      .pipe(
        map(orders => {
          // Cache recent orders
          localStorage.setItem('pizzaWorld_recent_orders', JSON.stringify(orders));
          return orders;
        }),
        catchError(error => {
          // Try to get cached data if API fails
          const cached = localStorage.getItem('pizzaWorld_recent_orders');
          if (cached) {
            console.log('Using cached recent orders data');
            return of(JSON.parse(cached));
          }
          throw error;
        })
      );
  }

  /** Get recent orders for testing (no auth required) */
  getRecentOrdersTest(): Observable<OrderInfo[]> {
    return this.http.get<OrderInfo[]>('/api/orders/test/recent')
      .pipe(
        map(orders => {
          // Cache the recent orders
          this.recentOrdersCache = orders;
          localStorage.setItem('pizzaWorld_recent_orders', JSON.stringify(orders));
          console.log(`✅ Recent orders loaded: ${orders.length} orders`);
          return orders;
        }),
        catchError(error => {
          console.error('❌ Recent orders loading failed:', error);
          throw error;
        })
      );
  }

  /** Get paginated orders for testing (no auth required) */
  getPaginatedOrdersTest(
    filters: OrderFilters,
    page: number = 0,
    size: number = 50,
    sortBy: string = 'orderdate',
    sortOrder: string = 'DESC'
  ): Observable<PaginatedOrdersResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('sortOrder', sortOrder);

    // Add filter parameters
    if (filters.storeId) params.set('storeId', filters.storeId);
    if (filters.customerId) params.set('customerId', filters.customerId);
    if (filters.state) params.set('state', filters.state);
    if (filters.orderId) params.set('orderId', filters.orderId);
    if (filters.nitems) params.set('nitems', filters.nitems);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);

    return this.http.get<PaginatedOrdersResponse>(`/api/orders/test/paginated`, { params })
      .pipe(
        catchError(error => {
          console.error('❌ Paginated orders loading failed:', error);
          throw error;
        })
      );
  }

  /** Get cached recent orders */
  getCachedRecentOrders(): OrderInfo[] | null {
    const cached = localStorage.getItem('pizzaWorld_recent_orders');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.error('Error parsing cached recent orders:', error);
        localStorage.removeItem('pizzaWorld_recent_orders');
      }
    }
    return null;
  }

  /** Clear orders cache */
  clearOrdersCache(): void {
    // Clear all orders-related cache entries
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('pizzaWorld_orders_') || key === 'pizzaWorld_recent_orders') {
        localStorage.removeItem(key);
      }
    });
  }

  // 🚀 NEW DASHBOARD ANALYTICS METHODS

  /** Get top stores by revenue */
  getTopStoresByRevenue(): Observable<any[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    return this.http.get<any[]>('/api/dashboard/analytics/top-stores', { headers })
      .pipe(
        catchError(error => {
          console.error('❌ Top stores data loading failed:', error);
          return of([]);
        })
      );
  }

  /** Get revenue by year - v2 optimized */
  getRevenueByYear(): Observable<any[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    return this.http.get<any[]>('/api/v2/analytics/revenue/by-year', { headers })
      .pipe(
        catchError(error => {
          console.error('❌ Revenue by year data loading failed:', error);
          return of([]);
        })
      );
  }

  /** Get revenue by month - v2 optimized */
  getRevenueByMonth(): Observable<any[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    return this.http.get<any[]>('/api/v2/analytics/revenue/by-month', { headers })
      .pipe(
        catchError(error => {
          console.error('❌ Revenue by month data loading failed:', error);
          return of([]);
        })
      );
  }

  /** Get orders by month - v2 optimized */
  getOrdersByMonth(): Observable<any[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    return this.http.get<any[]>('/api/v2/analytics/orders/by-month', { headers })
      .pipe(
        catchError(error => {
          console.error('❌ Orders by month data loading failed:', error);
          return of([]);
        })
      );
  }

  /** Get product category performance */
  getProductCategoryPerformance(): Observable<any[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    return this.http.get<any[]>('/api/dashboard/analytics/product-category-performance', { headers })
      .pipe(
        catchError(error => {
          console.error('❌ Product category performance loading failed:', error);
          return of([]);
        })
      );
  }

  /** Get customer acquisition by month */
  getCustomerAcquisitionByMonth(): Observable<any[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    return this.http.get<any[]>('/api/dashboard/analytics/customer-acquisition', { headers })
      .pipe(
        catchError(error => {
          console.error('❌ Customer acquisition data loading failed:', error);
          return of([]);
        })
      );
  }

  /** Get average order value trend */
  getAverageOrderValueTrend(): Observable<any[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    return this.http.get<any[]>('/api/dashboard/analytics/avg-order-value-trend', { headers })
      .pipe(
        catchError(error => {
          console.error('❌ Average order value trend loading failed:', error);
          return of([]);
        })
      );
  }

  /** Get store performance comparison */
  getStorePerformanceComparison(): Observable<any[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    return this.http.get<any[]>('/api/dashboard/analytics/store-performance-comparison', { headers })
      .pipe(
        catchError(error => {
          console.error('❌ Store performance comparison loading failed:', error);
          return of([]);
        })
      );
  }

  /** Fetch consolidated dashboard payload (HQ, state or store depending on role) */
  getConsolidatedDashboard(): Observable<any> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.get<any>('/api/v2/analytics/hq/consolidated', { headers })
      .pipe(
        catchError(error => {
          console.error('❌ Consolidated dashboard data loading failed:', error);
          return of(null);
        })
      );
  }

  /** Fetch global store KPIs from materialized view - v2 optimized */
  getGlobalStoreKPIs(): Observable<GlobalStoreKpi[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    return this.http.get<GlobalStoreKpi[]>('/api/v2/kpis/global-store', { headers })
      .pipe(
        map(data => {
          // Cache the global store KPIs data
          localStorage.setItem('pizzaWorld_global_store_kpis', JSON.stringify(data));
          console.log(`✅ Global Store KPIs loaded: ${data.length} stores`);
          return data;
        }),
        catchError(error => {
          // Try to get cached data if API fails
          const cached = localStorage.getItem('pizzaWorld_global_store_kpis');
          if (cached) {
            console.log('Using cached global store KPIs data');
            return of(JSON.parse(cached));
          }
          console.error('❌ Global store KPIs loading failed:', error);
          return of([]);
        })
      );
  }

  /** Get cached global store KPIs */
  getCachedGlobalStoreKPIs(): GlobalStoreKpi[] | null {
    const cached = localStorage.getItem('pizzaWorld_global_store_kpis');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.error('Error parsing cached global store KPIs:', error);
        localStorage.removeItem('pizzaWorld_global_store_kpis');
      }
    }
    return null;
  }

  /** Clear global store KPIs cache */
  clearGlobalStoreKPIsCache(): void {
    localStorage.removeItem('pizzaWorld_global_store_kpis');
  }

  // =================================================================
  // STORE REVENUE CHART API - Dynamic Time Period Filtering
  // =================================================================

  /** Fetch store revenue chart data with time period filtering */
  getStoreRevenueChart(filters: ChartFilterOptions): Observable<StoreRevenueChartData[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    // Build query parameters
    const params = new HttpParams()
      .set('timePeriod', filters.timePeriod)
      .set('year', filters.year?.toString() || '')
      .set('month', filters.month?.toString() || '')
      .set('quarter', filters.quarter?.toString() || '');

    return this.http.get<StoreRevenueChartData[]>('/api/v2/chart/store-revenue', { headers, params })
      .pipe(
        map(data => {
          // Cache the store revenue chart data
          const cacheKey = `pizzaWorld_store_revenue_chart_${JSON.stringify(filters)}`;
          localStorage.setItem(cacheKey, JSON.stringify(data));
          console.log(`✅ Store Revenue Chart data loaded: ${data.length} stores for ${filters.timePeriod}`);
          return data;
        }),
        catchError(error => {
          // Try to get cached data if API fails
          const cacheKey = `pizzaWorld_store_revenue_chart_${JSON.stringify(filters)}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            console.log('Using cached store revenue chart data');
            return of(JSON.parse(cached));
          }
          console.error('❌ Store revenue chart loading failed:', error);
          return of([]);
        })
      );
  }

  /** Fetch store revenue data for custom date range */
  getStoreRevenueByDateRange(startDate: string, endDate: string): Observable<StoreRevenueChartData[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.get<StoreRevenueChartData[]>('/api/v2/chart/store-revenue/date-range', { headers, params })
      .pipe(
        map(data => {
          // Cache the store revenue data
          const cacheKey = `pizzaWorld_store_revenue_range_${startDate}_${endDate}`;
          localStorage.setItem(cacheKey, JSON.stringify(data));
          console.log(`✅ Store Revenue data loaded for date range: ${data.length} stores`);
          return data;
        }),
        catchError(error => {
          console.error('❌ Store revenue date range loading failed:', error);
          return of([]);
        })
      );
  }

  /** Get available years for time period filtering */
  getAvailableYears(): Observable<TimePeriodOption[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    return this.http.get<TimePeriodOption[]>('/api/v2/chart/time-periods/years', { headers })
      .pipe(
        map(data => {
          localStorage.setItem('pizzaWorld_available_years', JSON.stringify(data));
          return data;
        }),
        catchError(error => {
          console.error('❌ Available years loading failed:', error);
          return of([]);
        })
      );
  }

  /** Get available months for a specific year */
  getAvailableMonthsForYear(year: number): Observable<TimePeriodOption[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    const params = new HttpParams().set('year', year.toString());

    return this.http.get<TimePeriodOption[]>('/api/v2/chart/time-periods/months', { headers, params })
      .pipe(
        map(data => {
          const cacheKey = `pizzaWorld_available_months_${year}`;
          localStorage.setItem(cacheKey, JSON.stringify(data));
          return data;
        }),
        catchError(error => {
          console.error('❌ Available months loading failed:', error);
          return of([]);
        })
      );
  }

  /** Get available quarters for a specific year */
  getAvailableQuartersForYear(year: number): Observable<TimePeriodOption[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    const params = new HttpParams().set('year', year.toString());

    return this.http.get<TimePeriodOption[]>('/api/v2/chart/time-periods/quarters', { headers, params })
      .pipe(
        map(data => {
          const cacheKey = `pizzaWorld_available_quarters_${year}`;
          localStorage.setItem(cacheKey, JSON.stringify(data));
          return data;
        }),
        catchError(error => {
          console.error('❌ Available quarters loading failed:', error);
          return of([]);
        })
      );
  }

  /** Get cached store revenue chart data */
  getCachedStoreRevenueChart(filters: ChartFilterOptions): StoreRevenueChartData[] | null {
    const cacheKey = `pizzaWorld_store_revenue_chart_${JSON.stringify(filters)}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.error('Error parsing cached store revenue chart data:', error);
        localStorage.removeItem(cacheKey);
      }
    }
    return null;
  }

  /** Get cached available years */
  getCachedAvailableYears(): TimePeriodOption[] | null {
    const cached = localStorage.getItem('pizzaWorld_available_years');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        localStorage.removeItem('pizzaWorld_available_years');
      }
    }
    return null;
  }

  /** Clear store revenue chart cache */
  clearStoreRevenueChartCache(): void {
    // Clear all chart-related cache entries
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('pizzaWorld_store_revenue_') ||
          key.startsWith('pizzaWorld_available_')) {
        localStorage.removeItem(key);
      }
    });
    console.log('Store revenue chart cache cleared');
  }

  /** Filter stores by selection (for store filtering functionality) */
  filterStoresBySelection(allStores: StoreRevenueChartData[], selectedStoreIds: string[]): StoreRevenueChartData[] {
    if (!selectedStoreIds || selectedStoreIds.length === 0) {
      return allStores;
    }
    return allStores.filter(store => selectedStoreIds.includes(store.storeid));
  }

  /** Get revenue value from store data (handles different time period fields) */
  getRevenueValue(store: StoreRevenueChartData): number {
    return store.total_revenue ||
           store.monthly_revenue ||
           store.yearly_revenue ||
           store.quarterly_revenue ||
           0;
  }

  /** Get order count from store data (handles different time period fields) */
  getOrderCount(store: StoreRevenueChartData): number {
    return store.order_count ||
           store.monthly_orders ||
           store.yearly_orders ||
           store.quarterly_orders ||
           0;
  }

  // Helper to build HttpParams from chart filter options
  private buildTimeParams(filters?: Partial<ChartFilterOptions>): HttpParams {
    let params = new HttpParams();
    if (!filters) return params;
    if (filters.timePeriod) params = params.set('timePeriod', filters.timePeriod);
    if (filters.year) params = params.set('year', filters.year.toString());
    if (filters.month) params = params.set('month', filters.month.toString());
    if (filters.quarter) params = params.set('quarter', filters.quarter.toString());
    return params;
  }

  // Store-specific analytics endpoints
  getStoreAnalyticsOverview(storeId: string, filters?: Partial<ChartFilterOptions>): Observable<StoreAnalyticsOverview> {
    const headers = this.getAuthHeaders();
    const params = this.buildTimeParams(filters);
    return this.http.get<StoreAnalyticsOverview>(`/api/v2/stores/${storeId}/analytics/overview`, { headers, params });
  }

  getStoreRevenueTrends(storeId: string, filters?: Partial<ChartFilterOptions>): Observable<StoreRevenueTrend[]> {
    const headers = this.getAuthHeaders();
    const params = this.buildTimeParams(filters);
    return this.http.get<StoreRevenueTrend[]>(`/api/v2/stores/${storeId}/analytics/revenue-trends`, { headers, params });
  }

  getStoreHourlyPerformance(storeId: string, filters?: Partial<ChartFilterOptions>): Observable<HourlyPerformancePoint[]> {
    const headers = this.getAuthHeaders();
    const params = this.buildTimeParams(filters);
    return this.http.get<HourlyPerformancePoint[]>(`/api/v2/stores/${storeId}/analytics/hourly-performance`, { headers, params });
  }

  getStoreCategoryPerformance(storeId: string, filters?: Partial<ChartFilterOptions>): Observable<CategoryPerformancePoint[]> {
    const headers = this.getAuthHeaders();
    const params = this.buildTimeParams(filters);
    return this.http.get<CategoryPerformancePoint[]>(`/api/v2/stores/${storeId}/analytics/category-performance`, { headers, params });
  }

  getStoreDailyOperations(storeId: string, filters?: Partial<ChartFilterOptions>): Observable<DailyOperationsPoint[]> {
    const headers = this.getAuthHeaders();
    const params = this.buildTimeParams(filters);
    return this.http.get<DailyOperationsPoint[]>(`/api/v2/stores/${storeId}/analytics/daily-operations`, { headers, params });
  }

  getStoreCustomerInsights(storeId: string, filters?: Partial<ChartFilterOptions>): Observable<CustomerInsightsPoint[]> {
    const headers = this.getAuthHeaders();
    const params = this.buildTimeParams(filters);
    return this.http.get<CustomerInsightsPoint[]>(`/api/v2/stores/${storeId}/analytics/customer-insights`, { headers, params });
  }

  getStoreProductPerformance(storeId: string, filters?: Partial<ChartFilterOptions>): Observable<ProductPerformancePoint[]> {
    const headers = this.getAuthHeaders();
    const params = this.buildTimeParams(filters);
    return this.http.get<ProductPerformancePoint[]>(`/api/v2/stores/${storeId}/analytics/product-performance`, { headers, params });
  }

  getStoreRecentOrders(storeId: string, limit = 50): Observable<OrderInfo[]> {
    const headers = this.getAuthHeaders();
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<OrderInfo[]>(`/api/v2/stores/${storeId}/analytics/recent-orders`, { headers, params });
  }

  getStoreEfficiencyMetrics(storeId: string, filters?: Partial<ChartFilterOptions>): Observable<EfficiencyMetrics> {
    const headers = this.getAuthHeaders();
    const params = this.buildTimeParams(filters);
    return this.http.get<EfficiencyMetrics>(`/api/v2/stores/${storeId}/analytics/efficiency-metrics`, { headers, params });
  }

  // Helper to get auth headers (moved from stores component)
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('authToken');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}
