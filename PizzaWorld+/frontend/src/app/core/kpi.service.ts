import { inject, Injectable } from '@angular/core';
import { HttpClient }         from '@angular/common/http';
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
    return this.http.get<DashboardKpiDto>('/api/dashboard');
  }

  /* Platz für weitere Methoden – z. B. dailyRevenue(), storeKPIs() … */
}
