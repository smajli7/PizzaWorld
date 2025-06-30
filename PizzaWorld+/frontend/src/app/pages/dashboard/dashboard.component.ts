import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { LoadingPopupComponent } from '../../shared/loading-popup/loading-popup.component';
import { KpiService, PerformanceData, DashboardKpiDto } from '../../core/kpi.service';
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
  storePerformance: PerformanceData['storePerformance'] | null = null;
  loading = false;
  error = false;
  showLoadingPopup = false;
  loadingMessage = '';
  loadingProgress = 0;
  dataLastUpdated: Date | null = null;

  // Chart options
  revenueChartOpts: any = null;
  ordersChartOpts: any = null;

  // Analytics data
  topStoresData: any[] = [];
  revenueByYear: any[] = [];
  productCategoryPerformance: any[] = [];

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
      performance: this.kpi.loadPerformanceData().pipe(catchError(() => of(null))),
      topStores: this.kpi.getTopStoresByRevenue().pipe(catchError(() => of([]))),
      revenueByYear: this.kpi.getRevenueByYear().pipe(catchError(() => of([]))),
      productCategory: this.kpi.getProductCategoryPerformance().pipe(catchError(() => of([]))),
      revenueByStore: this.kpi.getRevenueByStore().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ globalKPIs, performance, topStores, revenueByYear, productCategory, revenueByStore }) => {
        if (!globalKPIs || !performance) {
          this.error = true;
          this.loading = false;
          this.showLoadingPopup = false;
          return;
        }
        this.globalKPIs = globalKPIs;
        this.storePerformance = performance.storePerformance;
        this.dataLastUpdated = null; // Optionally set if available from globalKPIs
        this.topStoresData = topStores;
        this.revenueByYear = revenueByYear;
        this.productCategoryPerformance = productCategory;
        this.initRevenueChart(revenueByStore);
        this.initOrdersChart(performance.storePerformance);
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
    this.kpi.clearPerformanceCache();
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

  // Chart: Orders by Store
  private initOrdersChart(storePerformance: PerformanceData['storePerformance']): void {
    if (!storePerformance) return;
    const stores = Object.entries(storePerformance)
      .map(([id, data]: any) => ({ id, ...data }))
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 10);
    this.ordersChartOpts = {
      series: [{ name: 'Orders', data: stores.map(s => s.totalOrders) }],
      chart: { type: 'bar', height: 350, toolbar: { show: false } },
      xaxis: {
        categories: stores.map(s => `Store ${s.id}`),
        labels: { rotate: -45, style: { fontSize: '12px' } }
      },
      yaxis: {
        title: { text: 'Orders' },
        labels: { formatter: (value: number) => this.formatNumber(value) }
      },
      stroke: { curve: 'smooth', width: 2 },
      dataLabels: { enabled: true, formatter: (value: number) => this.formatNumber(value) },
      tooltip: { y: { formatter: (value: number) => this.formatNumber(value) } },
      colors: ['#3b82f6'],
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