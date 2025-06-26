import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders }         from '@angular/common/http';
import { Observable, shareReplay }         from 'rxjs';

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
  name: string; // city
  state: string;
  distance?: number;
}

@Injectable({ providedIn: 'root' })
export class KpiService {
  private http = inject(HttpClient);
  
  // Cache for dashboard KPIs - cache for 5 minutes
  private dashboardCache$: Observable<DashboardKpiDto> | null = null;
  
  // Cache for stores data - cache for 10 minutes
  private storesCache$: Observable<StoreInfo[]> | null = null;

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
      this.storesCache$ = this.http.get<StoreInfo[]>('/api/stores', { headers })
        .pipe(shareReplay(1, 600000)); // Cache for 10 minutes
    }
    return this.storesCache$;
  }

  /** Clear stores cache when needed */
  clearStoresCache(): void {
    this.storesCache$ = null;
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

  /* Platz für weitere Methoden – z. B. dailyRevenue(), storeKPIs() … */
}
