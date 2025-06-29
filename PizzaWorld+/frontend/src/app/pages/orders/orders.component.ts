import { Component, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule, ApexAxisChartSeries, ApexChart, ApexXAxis, ApexTitleSubtitle, ApexDataLabels, ApexTooltip, ApexPlotOptions, ApexYAxis, ApexStroke } from 'ng-apexcharts';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { TimeSelectorComponent } from '../../shared/time-selector/time-selector.component';
import { KpiService, OrderInfo, PaginatedOrdersResponse, OrderFilters } from '../../core/kpi.service';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

export interface ChartOptions {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  dataLabels: ApexDataLabels;
  tooltip: ApexTooltip;
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    NgApexchartsModule,
    SidebarComponent,
    TimeSelectorComponent
  ],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss']
})
export class OrdersComponent implements OnInit, OnDestroy {
  @ViewChild('sidebar', { static: true }) sidebar!: ElementRef<HTMLElement>;

  /** Filled after HTTP call; null until then */
  ordersOpts: ChartOptions | null = null;

  // Time selection
  selectedPeriod: 'day' | 'week' | 'month' | 'year' = 'month';
  fromDate: string = '';
  toDate: string = '';

  // Orders table data
  orders: OrderInfo[] = [];
  loading: boolean = false;
  error: string | null = null;

  // Pagination
  currentPage: number = 0;
  pageSize: number = 50;
  totalCount: number = 0;
  totalPages: number = 0;
  hasNext: boolean = false;
  hasPrevious: boolean = false;

  // Sorting
  sortBy: string = 'orderdate';
  sortOrder: string = 'DESC';

  // Filters
  filters: OrderFilters = {};
  filterSubject = new Subject<void>();

  // Page size options
  pageSizeOptions = [25, 50, 100, 200];

  // Math property for template
  Math = Math;

  // Destroy subject for cleanup
  private destroy$ = new Subject<void>();

  constructor(private kpi: KpiService) {
    // Debounce filter changes
    this.filterSubject
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.loadOrders();
      });
  }

  ngOnInit(): void {
    // Load chart data - use test endpoint for now
    this.kpi.getOrdersPerDayTest().subscribe(rows => {
      this.ordersOpts = {
        series: [
          {
            name: 'Orders',
            data: rows.map(r => [new Date(r.day).getTime(), +r.count])
          }
        ],
        chart: { type: 'area', height: 320, toolbar: { show: false } },
        xaxis: { type: 'datetime' },
        yaxis: { title: { text: 'Orders' } },
        stroke: { curve: 'smooth' },
        dataLabels: { enabled: false },
        tooltip: { shared: true }
      };
    });

    // Load initial orders (try cache first, then API)
    this.loadInitialOrders();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load initial orders with caching strategy
   */
  private loadInitialOrders(): void {
    // Try to get cached recent orders first
    const cachedOrders = this.kpi.getCachedRecentOrders();
    if (cachedOrders && cachedOrders.length > 0) {
      this.orders = cachedOrders;
      this.totalCount = cachedOrders.length;
      this.totalPages = Math.ceil(this.totalCount / this.pageSize);
      this.updatePaginationInfo();
      console.log('✅ Loaded orders from cache');
    }

    // Always fetch fresh data in background using test endpoint
    this.loadOrders();
  }

  /**
   * Load orders with current filters and pagination
   */
  loadOrders(): void {
    this.loading = true;
    this.error = null;

    // Use test endpoint for now
    this.kpi.getPaginatedOrdersTest(this.filters, this.currentPage, this.pageSize, this.sortBy, this.sortOrder)
      .subscribe({
        next: (response: PaginatedOrdersResponse) => {
          this.orders = response.orders;
          this.totalCount = response.totalCount;
          this.totalPages = response.totalPages;
          this.currentPage = response.currentPage;
          this.pageSize = response.pageSize;
          this.hasNext = response.hasNext;
          this.hasPrevious = response.hasPrevious;
          this.loading = false;
          console.log(`✅ Loaded ${this.orders.length} orders (page ${this.currentPage + 1}/${this.totalPages})`);
        },
        error: (error) => {
          this.loading = false;
          this.error = 'Failed to load orders. Please try again.';
          console.error('❌ Error loading orders:', error);
        }
      });
  }

  /**
   * Update pagination info
   */
  private updatePaginationInfo(): void {
    this.totalPages = Math.ceil(this.totalCount / this.pageSize);
    this.hasNext = this.currentPage < this.totalPages - 1;
    this.hasPrevious = this.currentPage > 0;
  }

  /**
   * Handle filter changes
   */
  onFilterChange(): void {
    this.currentPage = 0; // Reset to first page
    this.filterSubject.next();
  }

  /**
   * Handle date range changes
   */
  onTimePeriodChange(dateRange: { from: string; to: string }): void {
    this.fromDate = dateRange.from;
    this.toDate = dateRange.to;
    this.filters.from = this.fromDate;
    this.filters.to = this.toDate;
    this.onFilterChange();
  }

  /**
   * Handle sorting changes
   */
  onSortChange(column: string): void {
    if (this.sortBy === column) {
      this.sortOrder = this.sortOrder === 'ASC' ? 'DESC' : 'ASC';
    } else {
      this.sortBy = column;
      this.sortOrder = 'DESC';
    }
    this.loadOrders();
  }

  /**
   * Handle page size changes
   */
  onPageSizeChange(): void {
    this.currentPage = 0; // Reset to first page
    this.loadOrders();
  }

  /**
   * Navigate to specific page
   */
  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadOrders();
    }
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.filters = {};
    this.fromDate = '';
    this.toDate = '';
    this.currentPage = 0;
    this.loadOrders();
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  /**
   * Get sort icon for column
   */
  getSortIcon(column: string): string {
    if (this.sortBy !== column) return '↕️';
    return this.sortOrder === 'ASC' ? '↑' : '↓';
  }

  /**
   * Get pagination range for display
   */
  getPaginationRange(): number[] {
    const range = [];
    const start = Math.max(0, this.currentPage - 2);
    const end = Math.min(this.totalPages - 1, this.currentPage + 2);
    
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  }

  toggleSidebar(): void {
    this.sidebar.nativeElement.classList.toggle('collapsed');
  }
}
