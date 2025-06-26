import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders }         from '@angular/common/http';
import { Observable }         from 'rxjs';

/** Entspricht DashboardKpiDto im Backend */
export interface DashboardKpiDto {
  revenue:   number;
  orders:    number;
  avgOrder:  number;
  customers: number;
  products:  number;
}

@Injectable({ providedIn: 'root' })
export class KpiService {
  private http = inject(HttpClient);

  /** Holt alle KPI‐Zahlen für das Dashboard */
  getDashboard(): Observable<DashboardKpiDto> {
    const token = localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.get<DashboardKpiDto>('/api/dashboard', { headers });
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
