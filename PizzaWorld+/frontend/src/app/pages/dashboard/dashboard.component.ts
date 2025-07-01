import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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
  ApexPlotOptions,
  ApexFill
} from 'ng-apexcharts';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, SidebarComponent, LoadingPopupComponent, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  // Main data properties
  globalKPIs: DashboardKpiDto | null = null;
  loading = false;
  error = false;
  showLoadingPopup = false;
  loadingMessage = '';
  loadingProgress = 0;
  dataLastUpdated: Date | null = null;

  // Additional data for comprehensive dashboard
  topStores: any[] = [];
  recentOrders: any[] = [];
  revenueByYear: any[] = [];

  // Chart options
  revenueChartOpts: any = null;
  revenueTrendChartOpts: any = null;
  orderVolumeChartOpts: any = null;

  // Add property to hold full data and sort flag
  revenueByStoreData: any[] = [];
  revenueSortAsc = false;

  constructor(private kpi: KpiService) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.dataLastUpdated = new Date();
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = false;
    this.showLoadingPopup = true;
    this.loadingMessage = 'Loading comprehensive dashboard data...';
    this.loadingProgress = 10;

    // Load all dashboard data in parallel
    forkJoin({
      globalKPIs: this.kpi.getDashboard().pipe(catchError(() => of(null))),
      revenueByYear: this.kpi.getRevenueByYear().pipe(catchError(() => of([]))),
      revenueByStore: this.kpi.getRevenueByStore().pipe(catchError(() => of([]))),
      ordersByMonth: this.kpi.getOrdersByMonth().pipe(catchError(() => of([]))),
      recentOrders: this.kpi.getRecentOrders(10).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ globalKPIs, revenueByYear, revenueByStore, ordersByMonth, recentOrders }) => {
        this.loadingProgress = 50;
        
        if (!globalKPIs) {
          this.error = true;
          this.loading = false;
          this.showLoadingPopup = false;
          return;
        }

        // Set data
        this.globalKPIs = globalKPIs;
        this.revenueByYear = revenueByYear;
        this.topStores = revenueByStore.slice(0, 5); // Top 5 stores for insights
        this.recentOrders = recentOrders;

        // Initialize charts
        this.initRevenueChart(revenueByStore);
        this.initRevenueTrendChart(revenueByYear);
        this.initOrdersByMonthChart(ordersByMonth);

        this.loading = false;
        this.showLoadingPopup = false;
        this.loadingProgress = 100;
        this.dataLastUpdated = new Date();
      },
      error: (error) => {
        console.error('Dashboard data loading failed:', error);
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

  // Toggle sort order and rebuild chart
  toggleRevenueSort(): void {
    this.revenueSortAsc = !this.revenueSortAsc;
    this.buildRevenueChart();
  }

  // Build chart using current sort order and full dataset
  private buildRevenueChart(): void {
    if (!this.revenueByStoreData || this.revenueByStoreData.length === 0) {
      return;
    }
    const sorted = [...this.revenueByStoreData].sort((a, b) => {
      const valA = a.total_revenue || a.revenue || 0;
      const valB = b.total_revenue || b.revenue || 0;
      return this.revenueSortAsc ? valA - valB : valB - valA;
    });

    this.revenueChartOpts = {
      series: [{ name: 'Revenue', data: sorted.map(s => Math.round(s.total_revenue || s.revenue || 0)) }],
      chart: {
        type: 'bar',
        height: 600,
        toolbar: { show: false },
        background: 'transparent'
      },
      xaxis: {
        categories: sorted.map(s => `${s.city}, ${s.state_abbr || s.state}`),
        labels: { rotate: -45, style: { fontSize: '11px', colors: '#64748b' } }
      },
      yaxis: {
        title: { text: 'Revenue (€)', style: { color: '#64748b' } },
        labels: { formatter: (v: number) => `€${this.formatNumber(v)}`, style: { colors: '#64748b' } }
      },
      stroke: { curve: 'smooth', width: 2 },
      dataLabels: { enabled: false },
      colors: ['#f97316'],
      plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
      grid: { borderColor: '#e2e8f0', strokeDashArray: 4 }
    };
  }

  // Chart: Revenue by Store (initial build)
  private initRevenueChart(revenueByStore: any[]): void {
    this.revenueByStoreData = revenueByStore || [];
    this.buildRevenueChart();
  }

  // Chart: Revenue Trend
  private initRevenueTrendChart(revenueData: any[]): void {
    // Ensure data is sorted chronologically so the chart starts with the oldest month
    const sorted = [...revenueData].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return (a.month || 0) - (b.month || 0);
    });

    const last12Months = sorted.slice(-12); // take the most recent 12 months in ascending order

    this.revenueTrendChartOpts = {
      series: [{
        name: 'Revenue Trend',
        data: last12Months.map(item => Math.round(item.revenue || 0))
      }],
      chart: {
        type: 'area',
        height: 250,
        toolbar: { show: false },
        background: 'transparent'
      },
      xaxis: {
        categories: last12Months.map(item => item.month ? `${item.year}-${String(item.month).padStart(2, '0')}` : `${item.year}`),
        labels: {
          style: { colors: '#64748b' }
        }
      },
      yaxis: {
        labels: {
          formatter: (value: number) => `€${this.formatNumber(value)}`,
          style: { colors: '#64748b' }
        }
      },
      stroke: {
        curve: 'smooth',
        width: 3
      },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.1,
          stops: [0, 90, 100]
        }
      },
      colors: ['#f97316'],
      grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 4
      },
      tooltip: {
        y: { formatter: (value: number) => this.formatCurrency(value) }
      }
    };
  }

  // Chart: Order Volume
  private initOrdersByMonthChart(orderData: any[]): void {
    if (!orderData || orderData.length === 0) return;

    this.orderVolumeChartOpts = {
      series: [{
        name: 'Monthly Orders',
        data: orderData.sort((a,b)=>{
          if(a.year!==b.year) return a.year-b.year; return (a.month||0)-(b.month||0);
        }).map(r => [ Date.UTC(r.year, (r.month||1)-1, 1), r.total_orders || r.count || 0 ])
      }],
      chart: {
        type: 'line',
        height: 250,
        toolbar: { show: false },
        background: 'transparent'
      },
      xaxis: {
        type: 'datetime',
        labels: { style: { colors: '#64748b' } }
      },
      yaxis: {
        labels: {
          formatter: (value: number) => Math.round(value).toString(),
          style: { colors: '#64748b' }
        }
      },
      stroke: {
        curve: 'smooth',
        width: 3
      },
      colors: ['#3b82f6'],
      grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 4
      },
      dataLabels: {
        enabled: false
      },
      tooltip: {
        y: { formatter: (value: number) => `${Math.round(value)} orders` }
      }
    };
  }

  // Formatting helpers for template
  formatCurrency(value: number): string {
    if (!value) return '€0';
    return new Intl.NumberFormat('de-DE', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value: number): string {
    if (!value) return '0';
    return new Intl.NumberFormat('de-DE').format(Math.round(value));
  }

  formatAvgOrder(value: number): string {
    if (!value) return '€0';
    return new Intl.NumberFormat('de-DE', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
}