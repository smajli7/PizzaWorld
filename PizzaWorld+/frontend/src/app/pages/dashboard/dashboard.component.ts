import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { LoadingPopupComponent } from '../../shared/loading-popup/loading-popup.component';
import { KpiService, DashboardKpiDto } from '../../core/kpi.service';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexDataLabels,
  ApexStroke,
  ApexTooltip,
  ApexPlotOptions
} from 'ng-apexcharts';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, SidebarComponent, LoadingPopupComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  globalKPIs: DashboardKpiDto | null = null;
  loading = false;
  error = false;
  showLoadingPopup = false;
  loadingMessage = '';
  loadingProgress = 0;
  dataLastUpdated: Date | null = null;

  // Chart options
  revenueChartOpts: any = null;
  revenueByYear: any[] = [];

  constructor(private kpi: KpiService) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = false;
    this.showLoadingPopup = true;
    this.loadingMessage = 'Loading dashboard data...';
    this.loadingProgress = 10;

    forkJoin({
      globalKPIs: this.kpi.getDashboard().pipe(catchError(() => of(null))),
      revenueByYear: this.kpi.getRevenueByYear().pipe(catchError(() => of([]))),
      revenueByStore: this.kpi.getRevenueByStore().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ globalKPIs, revenueByYear, revenueByStore }) => {
        if (!globalKPIs) {
          this.error = true;
          this.loading = false;
          this.showLoadingPopup = false;
          return;
        }
        this.globalKPIs = globalKPIs;
        this.revenueByYear = revenueByYear;
        this.initRevenueChart(revenueByStore);
        this.loading = false;
        this.showLoadingPopup = false;
        this.loadingProgress = 100;
      },
      error: () => {
        this.error = true;
        this.loading = false;
        this.showLoadingPopup = false;
      }
    });
  }

  refreshData(): void {
    this.kpi.clearDashboardCache();
    this.loadDashboardData();
  }

  // Chart: Revenue by Store
  private initRevenueChart(revenueByStore: any[]): void {
    const topStores = (revenueByStore || []).slice(0, 10);
    this.revenueChartOpts = {
      series: [{ name: 'Revenue', data: topStores.map(s => s.revenue) }],
      chart: { type: 'bar', height: 350, toolbar: { show: false } },
      xaxis: {
        categories: topStores.map(s => `${s.city}, ${s.state_abbr}`),
        labels: { rotate: -45, style: { fontSize: '12px' } }
      },
      yaxis: {
        title: { text: 'Revenue (€)' },
        labels: { formatter: (value: number) => `€${value.toFixed(0)}` }
      },
      stroke: { curve: 'smooth', width: 2 },
      dataLabels: { enabled: true, formatter: (value: number) => `€${value.toFixed(0)}` },
      tooltip: { y: { formatter: (value: number) => `€${value.toFixed(2)}` } },
      colors: ['#ff6b35'],
      plotOptions: { bar: { borderRadius: 8, columnWidth: '60%' } }
    };
  }

  // Formatting helpers for template
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('de-DE').format(value);
  }

  formatAvgOrder(value: number): string {
    return value ? `€${value.toFixed(2)}` : '-';
  }
} 