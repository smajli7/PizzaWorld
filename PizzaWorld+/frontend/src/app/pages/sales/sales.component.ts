import { Component, ViewChild, ElementRef, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { KpiService } from '../../core/kpi.service';
import { FormsModule } from '@angular/forms';
import { LoadingPopupComponent } from '../../shared/loading-popup/loading-popup.component';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
  ApexTitleSubtitle,
  ApexPlotOptions,
  ApexFill,
  ApexLegend,
  ApexResponsive
} from 'ng-apexcharts';

export interface ChartOptions {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  dataLabels: ApexDataLabels;
  tooltip: ApexTooltip;
  title?: ApexTitleSubtitle;
  plotOptions?: ApexPlotOptions;
  fill?: ApexFill;
  legend?: ApexLegend;
  responsive?: ApexResponsive[];
  colors?: string[];
}

export interface SalesKPI {
  revenue: number;
  totalOrders: number;
  uniqueCustomers: number;
  avgOrder: number;
}

export interface BestSellingProduct {
  sku: string;
  name: string;
  size: string;
  revenue: number;
  totalSold: number;
}

export interface StoreRevenue {
  storeid: string;
  city: string;
  stateAbbr: string;
  revenue: number;
  orders: number;
}

export interface SalesTrend {
  day: string;
  revenue: number;
  orders: number;
}

export interface CategoryRevenue {
  category: string;
  revenue: number;
  orders: number;
}

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [
    SidebarComponent,
    CommonModule,
    RouterModule,
    NgApexchartsModule,
    FormsModule,
    LoadingPopupComponent,
  ],
  templateUrl: './sales.component.html',
  styleUrls: ['./sales.component.scss']
})
export class SalesComponent implements OnInit {
  @ViewChild('sidebar', { static: true }) sidebar!: ElementRef<HTMLElement>;

  // Date filtering
  selectedPeriod: 'day' | 'week' | 'month' | 'year' | 'all' = 'all';
  customFromDate: string = '';
  customToDate: string = '';
  fromDate: string = '';
  toDate: string = '';
  earliestOrderDate: string = '2000-01-01';

  // Data
  salesKPI: SalesKPI | null = null;
  bestSellingProducts: BestSellingProduct[] = [];
  storesByRevenue: StoreRevenue[] = [];
  salesTrend: SalesTrend[] = [];
  categoryRevenue: CategoryRevenue[] = [];

  // Charts
  salesTrendChart: ChartOptions | null = null;
  categoryRevenueChart: ChartOptions | null = null;
  revenueByStoreChart: ChartOptions | null = null;

  // UI State
  loading = false;
  loadingMessage: string = 'Loading sales data...';
  productsSortOrder: 'asc' | 'desc' = 'desc';
  showAllProducts = false;
  hasLoadedAllTime = false;

  // Hold the full time‐series to allow fast client-side filtering
  private fullSalesTrend: SalesTrend[] = [];

  constructor(private kpi: KpiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // Determine earliest order date from cache to build initial date range
    const cachedEarliest = localStorage.getItem('pizzaWorld_earliestOrderDate');
    this.earliestOrderDate = cachedEarliest || '2000-01-01';

    // Initialize All-Time date range (earliest → today)
    const today = new Date();
    this.fromDate = this.earliestOrderDate;
    this.toDate = today.toISOString().split('T')[0];
    this.selectedPeriod = 'all';

    // Attempt to load the fully cached dataset – should be instant after login
    this.loadCachedAllTimeData();
    if (this.hasLoadedAllTime) {
      console.log('✅ Sales page loaded INSTANTLY from cache');
      return;
    }

    // Fallback: If some data is missing (e.g. user refreshed page before preload finished)
    console.log('⚠️ Incomplete sales cache – fetching missing data from API');
    this.loadSalesData();
  }

  private initializeDateRange(): void {
    const today = new Date();
    const fromDate = new Date();
    
    switch (this.selectedPeriod) {
      case 'day':
        fromDate.setDate(today.getDate() - 1);
        break;
      case 'week':
        fromDate.setDate(today.getDate() - 7);
        break;
      case 'month':
        fromDate.setMonth(today.getMonth() - 1);
        break;
      case 'year':
        fromDate.setFullYear(today.getFullYear() - 1);
        break;
    }

    this.fromDate = fromDate.toISOString().split('T')[0];
    this.toDate = today.toISOString().split('T')[0];
  }

  onPeriodChange(): void {
    this.initializeDateRange();
    // Instead of re-loading from API we now filter the pre-fetched full dataset
    this.applyTemporalFilter();
  }

  onCustomDateChange(): void {
    if (this.customFromDate && this.customToDate) {
      this.fromDate = this.customFromDate;
      this.toDate = this.customToDate;
      this.applyTemporalFilter();
    }
  }

  onTimePeriodChange(dateRange: { from: string; to: string }): void {
    this.fromDate = dateRange.from;
    this.toDate = dateRange.to;
    // Directly apply client-side filtering on the already loaded full dataset
    this.applyTemporalFilter();
  }

  private loadSalesData(): void {
    this.loading = true;
    this.loadingMessage = 'Loading sales data...';

    // Try to load cached data first for better performance
    this.loadCachedData();

    forkJoin({
      kpis: this.kpi.getSalesKPIs(this.fromDate, this.toDate).pipe(catchError(() => of(null))),
      bestProducts: this.kpi.getBestSellingProducts(this.fromDate, this.toDate).pipe(catchError(() => of([]))),
      stores: this.kpi.getStoresByRevenue(this.fromDate, this.toDate).pipe(catchError(() => of([]))),
      trend: this.kpi.getSalesTrendByDay(this.fromDate, this.toDate).pipe(catchError(() => of([]))),
      categories: this.kpi.getRevenueByCategory(this.fromDate, this.toDate).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ kpis, bestProducts, stores, trend, categories }) => {
        // KPIs
        this.salesKPI = kpis ? {
          revenue: kpis.revenue || 0,
          totalOrders: kpis.total_orders || 0,
          uniqueCustomers: kpis.unique_customers || 0,
          avgOrder: kpis.avg_order || 0
        } : { revenue: 0, totalOrders: 0, uniqueCustomers: 0, avgOrder: 0 };
        // Best Selling Products
        this.bestSellingProducts = bestProducts.map((p: any) => ({
          sku: p.sku,
          name: p.name,
          size: p.size,
          revenue: p.revenue || 0,
          totalSold: p.total_sold || 0
        }));
        // Stores by Revenue
        this.storesByRevenue = stores.map((s: any) => ({
          storeid: s.storeid,
          city: s.city,
          stateAbbr: s.state_abbr,
          revenue: s.revenue || 0,
          orders: s.orders || 0
        }));
        this.initializeRevenueByStoreChart();
        // Sales Trend
        this.salesTrend = trend.map((t: any) => ({
          day: t.day,
          revenue: t.revenue || 0,
          orders: t.orders || 0
        }));
        // Cache full dataset for client-side filter only once
        if (this.fullSalesTrend.length === 0) {
          this.fullSalesTrend = [...this.salesTrend];
        }
        this.initializeSalesTrendChart();
        // Category Revenue
        this.categoryRevenue = categories.map((c: any) => ({
          category: c.category,
          revenue: c.revenue || 0,
          orders: c.orders || 0
        }));
        this.initializeCategoryRevenueChart();
        // All done!
        this.loading = false;
      },
      error: (err) => {
        // If any error, still hide loading but show empty data
        this.salesKPI = { revenue: 0, totalOrders: 0, uniqueCustomers: 0, avgOrder: 0 };
        this.bestSellingProducts = [];
        this.storesByRevenue = [];
        this.salesTrend = [];
        this.categoryRevenue = [];
        this.loading = false;
      }
    });
  }

  private loadCachedData(): void {
    // Load cached products data for better performance
    const cachedProducts = this.kpi.getCachedProducts();
    if (cachedProducts && cachedProducts.length > 0) {
      console.log('Using cached products data:', cachedProducts.length, 'products');
    }

    // Load cached stores data
    const cachedStores = this.kpi.getCachedStoresData();
    if (cachedStores && cachedStores.length > 0) {
      console.log('Using cached stores data:', cachedStores.length, 'stores');
    }

    // Load cached performance data
    const cachedPerformance = this.kpi.getCachedPerformanceData();
    if (cachedPerformance) {
      console.log('Using cached performance data');
    }
  }

  private initializeSalesTrendChart(): void {
    // Guard in case we call before data present
    if (!this.salesTrend || this.salesTrend.length === 0) {
      return;
    }

    this.salesTrendChart = {
      series: [
        {
          name: 'Revenue',
          data: this.salesTrend.map(t => [new Date(t.day).getTime(), t.revenue])
        },
        {
          name: 'Orders',
          data: this.salesTrend.map(t => [new Date(t.day).getTime(), t.orders])
        }
      ],
      chart: {
        type: 'area',
        height: 350,
        toolbar: { show: false },
        zoom: { enabled: false }
      },
      xaxis: {
        type: 'datetime',
        labels: {
          format: 'MMM dd'
        }
      },
      yaxis: {
        title: { text: 'Revenue (€)' },
        labels: {
          formatter: (value: number) => `€${value.toFixed(0)}`
        }
      },
      stroke: {
        curve: 'smooth',
        width: 2
      },
      dataLabels: { enabled: false },
      tooltip: {
        shared: true,
        x: {
          format: 'MMM dd, yyyy'
        },
        y: [
          {
            formatter: (value: number) => `€${value.toFixed(2)}`
          },
          {
            formatter: (value: number) => value.toFixed(0)
          }
        ]
      },
      colors: ['#ff6b35', '#f7931e'],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.3,
          stops: [0, 90, 100]
        }
      }
    };
  }

  private initializeCategoryRevenueChart(): void {
    this.categoryRevenueChart = {
      series: [
        {
          name: 'Revenue',
          data: this.categoryRevenue.map(c => c.revenue)
        }
      ],
      chart: {
        type: 'bar',
        height: 350,
        toolbar: { show: false }
      },
      xaxis: {
        categories: this.categoryRevenue.map(c => c.category),
        labels: {
          rotate: -45,
          style: {
            fontSize: '12px'
          }
        }
      },
      yaxis: {
        title: { text: 'Revenue (€)' },
        labels: {
          formatter: (value: number) => `€${value.toFixed(0)}`
        }
      },
      stroke: {
        curve: 'smooth',
        width: 2
      },
      dataLabels: {
        enabled: true,
        formatter: (value: number) => `€${value.toFixed(0)}`
      },
      tooltip: {
        y: {
          formatter: (value: number) => `€${value.toFixed(2)}`
        }
      },
      colors: ['#ff6b35'],
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: '60%'
        }
      }
    };
  }

  private initializeRevenueByStoreChart(): void {
    const topStores = this.storesByRevenue.slice(0, 10);
    
    this.revenueByStoreChart = {
      series: [
        {
          name: 'Revenue',
          data: topStores.map(s => s.revenue)
        }
      ],
      chart: {
        type: 'bar',
        height: 350,
        toolbar: { show: false }
      },
      xaxis: {
        categories: topStores.map(s => `${s.city} (${s.stateAbbr})`),
        labels: {
          rotate: -45,
          style: {
            fontSize: '11px'
          }
        }
      },
      yaxis: {
        title: { text: 'Revenue (€)' },
        labels: {
          formatter: (value: number) => `€${value.toFixed(0)}`
        }
      },
      stroke: {
        curve: 'smooth',
        width: 2
      },
      dataLabels: {
        enabled: true,
        formatter: (value: number) => `€${value.toFixed(0)}`
      },
      tooltip: {
        y: {
          formatter: (value: number) => `€${value.toFixed(2)}`
        }
      },
      colors: ['#f7931e'],
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: '70%'
        }
      }
    };
  }

  toggleProductsSort(): void {
    this.productsSortOrder = this.productsSortOrder === 'desc' ? 'asc' : 'desc';
  }

  getSortedProducts(): BestSellingProduct[] {
    const products = [...this.bestSellingProducts];
    if (this.productsSortOrder === 'desc') {
      return products.sort((a, b) => b.revenue - a.revenue);
    } else {
      return products.sort((a, b) => a.revenue - b.revenue);
    }
  }

  getDisplayedProducts(): BestSellingProduct[] {
    const sorted = this.getSortedProducts();
    return this.showAllProducts ? sorted : sorted.slice(0, 5);
  }

  getBestStore(): StoreRevenue | null {
    return this.storesByRevenue.length > 0 ? this.storesByRevenue[0] : null;
  }

  getWorstStore(): StoreRevenue | null {
    return this.storesByRevenue.length > 0 ? this.storesByRevenue[this.storesByRevenue.length - 1] : null;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('de-DE').format(value);
  }

  toggleSidebar(): void {
    this.sidebar.nativeElement.classList.toggle('collapsed');
  }

  private loadCachedAllTimeData(): void {
    // Use cached All Time data for instant display
    const kpis = this.kpi.getCachedAllTimeSalesKPIs(this.fromDate, this.toDate);
    const bestProducts = this.kpi.getCachedAllTimeBestProducts(this.fromDate, this.toDate);
    const storesRevenue = this.kpi.getCachedAllTimeStoresByRevenue(this.fromDate, this.toDate);
    const salesTrend = this.kpi.getCachedAllTimeSalesTrend(this.fromDate, this.toDate);
    const categoryRevenue = this.kpi.getCachedAllTimeRevenueByCategory(this.fromDate, this.toDate);
    
    // Check if we have all the necessary cached data
    if (kpis && bestProducts.length > 0 && storesRevenue.length > 0 && salesTrend.length > 0 && categoryRevenue.length > 0) {
      console.log('📊 Loading complete cached dataset INSTANTLY...');
      
      this.salesKPI = {
        revenue: kpis.revenue || 0,
        totalOrders: kpis.total_orders || 0,
        uniqueCustomers: kpis.unique_customers || 0,
        avgOrder: kpis.avg_order || 0
      };
      
      this.bestSellingProducts = bestProducts.map((p: any) => ({
        sku: p.sku,
        name: p.name,
        size: p.size,
        revenue: p.revenue || 0,
        totalSold: p.total_sold || 0
      }));
      
      this.storesByRevenue = storesRevenue.map((s: any) => ({
        storeid: s.storeid,
        city: s.city,
        stateAbbr: s.state_abbr,
        revenue: s.revenue || 0,
        orders: s.orders || 0
      }));
      
      this.salesTrend = salesTrend.map((t: any) => ({
        day: t.day,
        revenue: t.revenue || 0,
        orders: t.orders || 0
      }));
      
      this.categoryRevenue = categoryRevenue.map((c: any) => ({
        category: c.category,
        revenue: c.revenue || 0,
        orders: c.orders || 0
      }));
      
      this.initializeRevenueByStoreChart();
      this.initializeSalesTrendChart();
      this.initializeCategoryRevenueChart();
      
      // Ensure UI is updated and loading is set to false
      this.cdr.detectChanges();
      this.loading = false;
      this.hasLoadedAllTime = true;

      // Save the complete sales trend for later local filtering
      this.fullSalesTrend = [...this.salesTrend];
    } else {
      console.log('⚠️ Incomplete cached data - will load from API');
      // Set default values if cache is incomplete
      this.salesKPI = { revenue: 0, totalOrders: 0, uniqueCustomers: 0, avgOrder: 0 };
      this.bestSellingProducts = [];
      this.storesByRevenue = [];
      this.salesTrend = [];
      this.categoryRevenue = [];
      this.loading = true; // Keep loading true so API call can proceed
    }
  }

  // ------------------------------------------------------------------
  // ⏱️  CLIENT-SIDE DATE FILTERING LOGIC
  // ------------------------------------------------------------------
  private applyTemporalFilter(): void {
    if (this.fullSalesTrend.length === 0) {
      return;
    }

    const from = new Date(this.fromDate);
    const to = new Date(this.toDate);

    // Protect against invalid date inputs
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      this.salesTrend = [...this.fullSalesTrend];
    } else {
      this.salesTrend = this.fullSalesTrend.filter(item => {
        const d = new Date(item.day);
        return d >= from && d <= to;
      });
    }

    // Re-aggregate KPI numbers on the fly
    const totalRevenue = this.salesTrend.reduce((sum, r) => sum + (r.revenue || 0), 0);
    const totalOrders = this.salesTrend.reduce((sum, r) => sum + (r.orders || 0), 0);

    if (!this.salesKPI) {
      this.salesKPI = { revenue: 0, totalOrders: 0, uniqueCustomers: 0, avgOrder: 0 };
    }
    this.salesKPI.revenue = totalRevenue;
    this.salesKPI.totalOrders = totalOrders;
    this.salesKPI.avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Update chart visuals
    this.initializeSalesTrendChart();
    this.cdr.detectChanges();
  }
}
