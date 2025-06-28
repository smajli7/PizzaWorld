import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders }         from '@angular/common/http';
import { Observable, shareReplay, map, catchError }         from 'rxjs';

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

  /** Holt alle KPI‐Zahlen für das Dashboard */
  getDashboard(): Observable<DashboardKpiDto> {
    if (!this.dashboardCache$) {
      const token = localStorage.getItem('authToken');
      const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
      this.dashboardCache$ = this.http.get<DashboardKpiDto>('/api/dashboard', { headers })
        .pipe(shareReplay(1, 300000)); // Cache for 5 minutes
    }
    return this.dashboardCache$;
  }

  /** Clear cache when needed (e.g., after updates) */
  clearDashboardCache(): void {
    this.dashboardCache$ = null;
  }

  /** Holt alle Stores */
  getAllStores(): Observable<StoreInfo[]> {
    if (!this.storesCache$) {
      const token = localStorage.getItem('authToken');
      const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

      console.log('🔄 Loading stores data from API...');

      this.storesCache$ = this.http.get<StoreInfo[]>('/api/stores', { headers })
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
    return this.http.get<any[]>('/api/kpi/orders-per-day');
  }

  /** Holt Sales-per-Day KPI */
  getSalesPerDay(): Observable<any[]> {
    return this.http.get<any[]>('/api/kpi/sales-per-day');
  }

  /** Holt Stores-per-Day KPI */
  getStoresPerDay(): Observable<any[]> {
    return this.http.get<any[]>('/api/kpi/stores-per-day');
  }

  /** Fetches revenue by store for the dashboard chart */
  getRevenueByStore(): Observable<any[]> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.get<any[]>('/api/dashboard/revenue-by-store', { headers });
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

    return this.http.get<PerformanceData>('/api/dashboard/performance-data', { headers })
      .pipe(
        map(data => {
          // Cache the data in both memory and localStorage
          this.performanceDataCache = data;
          localStorage.setItem('pizzaWorld_performance', JSON.stringify(data));

          const storeCount = Object.keys(data.storePerformance).length;
          console.log(`✅ Store performance data processed: ${storeCount} stores, $${data.globalKPIs.totalRevenue.toLocaleString()} total revenue`);

          return data;
        }),
        catchError(error => {
          console.error('❌ Store performance data processing failed:', error);
          throw error;
        })
      );
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
}
