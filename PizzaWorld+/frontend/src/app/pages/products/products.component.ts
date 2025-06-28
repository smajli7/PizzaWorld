import { Component, ViewChild, ElementRef, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { TimeSelectorComponent } from '../../shared/time-selector/time-selector.component';
import { KpiService } from '../../core/kpi.service';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import { MultiSelectModule } from 'primeng/multiselect';
import { TooltipModule } from 'primeng/tooltip';
import { NgApexchartsModule } from 'ng-apexcharts';
import { LoadingPopupComponent } from '../../shared/loading-popup/loading-popup.component';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexDataLabels,
  ApexTooltip,
  ApexPlotOptions,
  ApexStroke,
  ApexResponsive,
  ApexLegend,
  ApexTitleSubtitle
} from 'ng-apexcharts';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  title: ApexTitleSubtitle;
  dataLabels: ApexDataLabels;
  tooltip: ApexTooltip;
  plotOptions: ApexPlotOptions;
  stroke: ApexStroke;
  responsive: ApexResponsive[];
  legend: ApexLegend;
  colors: string[];
  fill: any;
  labels: string[];
};

export interface ProductInfo {
  sku: string;
  name: string;
  category: string;
  price: number;
  size: string;
  ingredients: string;
  launch: string;
  totalOrders: number;
  uniqueCustomers: number;
  revenue: number;
  avgOrder: number;
}

// Backend data format
interface BackendProductInfo {
  sku: string;
  name: string;
  category: string;
  price: number;
  size: string;
  ingredients: string;
  launch: string;
  total_orders: number;
  customers: number;
  revenue: number;
  avg_order?: number;
}

@Component({
  standalone: true,
  selector: 'app-products',
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss'],
  imports: [
    SidebarComponent,
    TimeSelectorComponent,
    CommonModule,
    RouterModule,
    FormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    TableModule,
    MultiSelectModule,
    TooltipModule,
    NgApexchartsModule,
    LoadingPopupComponent
  ]
})
export class ProductsComponent implements OnInit {
  @ViewChild(SidebarComponent) sidebar!: SidebarComponent;

  // Data
  products: ProductInfo[] = [];
  filteredProducts: ProductInfo[] = [];
  loading = true;
  error = false;

  // Filters
  searchTerm = '';
  categoryFilter = '';
  sizeFilter = '';
  priceRangeFilter = '';
  sortBy = 'revenue';
  sortOrder: number = -1; // -1 for desc, 1 for asc

  // Loading popup
  showLoadingPopup = false;
  loadingProgress = 0;
  loadingMessage = 'Loading product data...';

  // Charts
  revenueChartOptions: Partial<ChartOptions> | null = null;
  ordersChartOptions: Partial<ChartOptions> | null = null;
  categoryChartOptions: Partial<ChartOptions> | null = null;
  topProductsChartOptions: Partial<ChartOptions> | null = null;

  // Categories and sizes for filters
  categories: string[] = [];
  sizes: string[] = [];
  priceRanges = [
    { label: 'All Prices', value: '' },
    { label: 'Under $5', value: '0-5' },
    { label: '$5 - $10', value: '5-10' },
    { label: '$10 - $15', value: '10-15' },
    { label: '$15 - $20', value: '15-20' },
    { label: 'Over $20', value: '20+' }
  ];

  sortOptions = [
    { label: 'Revenue (High to Low)', value: 'revenue', order: 'desc' },
    { label: 'Revenue (Low to High)', value: 'revenue', order: 'asc' },
    { label: 'Orders (High to Low)', value: 'totalOrders', order: 'desc' },
    { label: 'Orders (Low to High)', value: 'totalOrders', order: 'asc' },
    { label: 'Price (High to Low)', value: 'price', order: 'desc' },
    { label: 'Price (Low to High)', value: 'price', order: 'asc' },
    { label: 'Name A-Z', value: 'name', order: 'asc' },
    { label: 'Name Z-A', value: 'name', order: 'desc' }
  ];

  // Time selection
  selectedPeriod: 'day' | 'week' | 'month' | 'year' = 'month';
  fromDate: string = '';
  toDate: string = '';

  constructor(
    private kpi: KpiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadProductsFromCache();
  }

  loadProductsFromCache(): void {
    // Try to load from cache first (like stores page)
    const cachedProducts = this.kpi.getCachedProducts();

    if (cachedProducts && cachedProducts.length > 0) {
      console.log('✅ Products data loaded INSTANTLY from cache');
      this.products = cachedProducts;
      this.extractFilterOptions();
      this.applyFilters();
      this.initializeCharts();
      this.loading = false;
      return;
    }

    // Only if NO cache exists, then load with popup
    console.log('⚠️ No cached products data found - loading from API (this should not happen after login)');
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    this.error = false;
    this.showLoadingPopup = true;
    this.loadingProgress = 0;
    this.loadingMessage = 'Loading product data from database...';

    // Call the real backend API instead of generating mock data
    this.kpi.getAllProducts().subscribe({
      next: (products) => {
        console.log('Products loaded from API:', products);
        this.products = products;
        this.extractFilterOptions();
        this.applyFilters();
        this.initializeCharts();
        this.loading = false;
        this.showLoadingPopup = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.error = true;
        this.loading = false;
        this.showLoadingPopup = false;
        this.cdr.markForCheck();
      }
    });
  }

  private extractFilterOptions(): void {
    this.categories = [...new Set(this.products.map(p => p.category))];
    this.sizes = [...new Set(this.products.map(p => p.size))];
  }

  applyFilters(): void {
    let filtered = [...this.products];

    // Search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term)
      );
    }

    // Category filter
    if (this.categoryFilter) {
      filtered = filtered.filter(p => p.category === this.categoryFilter);
    }

    // Size filter
    if (this.sizeFilter) {
      filtered = filtered.filter(p => p.size === this.sizeFilter);
    }

    // Price range filter
    if (this.priceRangeFilter) {
      const [min, max] = this.priceRangeFilter.split('-').map(Number);
      filtered = filtered.filter(p => {
        if (this.priceRangeFilter === '20+') {
          return p.price >= 20;
        }
        return p.price >= min && p.price <= max;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = a[this.sortBy as keyof ProductInfo];
      let bVal: any = b[this.sortBy as keyof ProductInfo];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (this.sortOrder === 1) {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    this.filteredProducts = filtered;
  }

  onSortChange(event: any): void {
    const [value, order] = event.value.split(',');
    this.sortBy = value;
    this.sortOrder = order === 'asc' ? 1 : -1;
    this.applyFilters();
  }

  onSort(event: any): void {
    this.sortBy = event.field;
    this.sortOrder = event.order === 1 ? 1 : -1;
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.categoryFilter = '';
    this.sizeFilter = '';
    this.priceRangeFilter = '';
    this.sortBy = 'revenue';
    this.sortOrder = -1;
    this.applyFilters();
  }

  private initializeCharts(): void {
    this.initializeRevenueChart();
    this.initializeOrdersChart();
    this.initializeCategoryChart();
    this.initializeTopProductsChart();
  }

  private initializeRevenueChart(): void {
    const topProducts = [...this.products]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    this.revenueChartOptions = {
      series: [{
        name: 'Revenue',
        data: topProducts.map(p => p.revenue)
      }],
      chart: {
        type: 'bar',
        height: 350,
        toolbar: { show: false },
        background: '#ffffff',
        foreColor: '#ff6b35'
      },
      colors: ['#ff6b35'],
      xaxis: {
        categories: topProducts.map(p => p.name.substring(0, 15) + '...'),
        labels: {
          rotate: -45,
          style: {
            colors: '#ff6b35',
            fontSize: '12px'
          }
        }
      },
      yaxis: {
        title: {
          text: 'Revenue ($)',
          style: {
            color: '#ff6b35',
            fontSize: '14px',
            fontWeight: '600'
          }
        },
        labels: {
          style: {
            colors: '#ff6b35',
            fontSize: '12px'
          }
        }
      },
      dataLabels: {
        enabled: true,
        style: {
          colors: ['#ff6b35'],
          fontSize: '12px',
          fontWeight: 'bold'
        },
        formatter: (val: number) => '$' + (val / 1000).toFixed(0) + 'k'
      },
      tooltip: {
        theme: 'light',
        style: {
          fontSize: '12px'
        },
        y: {
          formatter: (value: number) => `$${value.toLocaleString()}`
        }
      },
      title: {
        text: 'Top 10 Products by Revenue',
        align: 'center',
        style: {
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#ff6b35'
        }
      },
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: '70%'
        }
      }
    };
  }

  private initializeOrdersChart(): void {
    const topProducts = [...this.products]
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 10);

    this.ordersChartOptions = {
      series: [{
        name: 'Orders',
        data: topProducts.map(p => p.totalOrders)
      }],
      chart: {
        type: 'line',
        height: 350,
        toolbar: { show: false },
        background: '#ffffff',
        foreColor: '#ff6b35'
      },
      colors: ['#ff6b35'],
      xaxis: {
        categories: topProducts.map(p => p.name.substring(0, 15) + '...'),
        labels: {
          rotate: -45,
          style: {
            colors: '#ff6b35',
            fontSize: '12px'
          }
        }
      },
      yaxis: {
        title: {
          text: 'Total Orders',
          style: {
            color: '#ff6b35',
            fontSize: '14px',
            fontWeight: '600'
          }
        },
        labels: {
          style: {
            colors: '#ff6b35',
            fontSize: '12px'
          }
        }
      },
      dataLabels: {
        enabled: true,
        style: {
          colors: ['#ff6b35'],
          fontSize: '12px',
          fontWeight: 'bold'
        }
      },
      stroke: {
        width: 4,
        colors: ['#ff6b35']
      },
      tooltip: {
        theme: 'light',
        style: {
          fontSize: '12px'
        },
        y: {
          formatter: (value: number) => value.toLocaleString()
        }
      },
      title: {
        text: 'Top 10 Products by Orders',
        align: 'center',
        style: {
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#ff6b35'
        }
      }
    };
  }

  private initializeCategoryChart(): void {
    const categoryData = this.products.reduce((acc, product) => {
      acc[product.category] = (acc[product.category] || 0) + product.revenue;
      return acc;
    }, {} as { [key: string]: number });

    const categories = Object.keys(categoryData);
    const revenues = Object.values(categoryData);

    this.categoryChartOptions = {
      series: [{
        name: 'Revenue',
        data: revenues
      }],
      chart: {
        type: 'pie',
        height: 350,
        background: '#ffffff',
        foreColor: '#ff6b35'
      },
      colors: ['#ff6b35', '#f7931e', '#ff8c42', '#ffa726', '#ffb74d', '#ffcc80'],
      labels: categories,
      dataLabels: {
        enabled: true,
        style: {
          colors: ['#ffffff'],
          fontSize: '12px',
          fontWeight: 'bold'
        },
        formatter: (val: number) => `${val.toFixed(1)}%`
      },
      tooltip: {
        theme: 'light',
        style: {
          fontSize: '12px'
        },
        y: {
          formatter: (value: number) => `$${value.toLocaleString()}`
        }
      },
      title: {
        text: 'Revenue by Category',
        align: 'center',
        style: {
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#ff6b35'
        }
      },
      legend: {
        position: 'bottom',
        labels: {
          colors: '#ff6b35'
        }
      }
    };
  }

  private initializeTopProductsChart(): void {
    const topProducts = [...this.products]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    this.topProductsChartOptions = {
      series: [{
        name: 'Revenue',
        data: topProducts.map(p => p.revenue)
      }],
      chart: {
        type: 'radialBar',
        height: 350,
        background: '#ffffff',
        foreColor: '#ff6b35'
      },
      colors: ['#ff6b35', '#f7931e', '#ff8c42', '#ffa726', '#ffb74d'],
      plotOptions: {
        radialBar: {
          dataLabels: {
            name: {
              fontSize: '14px',
              color: '#ff6b35',
              fontWeight: '600'
            },
            value: {
              fontSize: '16px',
              color: '#ff6b35',
              fontWeight: 'bold',
              formatter: (value: number) => `$${value.toLocaleString()}`
            }
          },
          track: {
            background: '#f5f5f5'
          }
        }
      },
      labels: topProducts.map(p => p.name.substring(0, 12) + '...'),
      title: {
        text: 'Top 5 Products Performance',
        align: 'center',
        style: {
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#ff6b35'
        }
      }
    };
  }

  toggleSidebar(): void {
    this.sidebar.toggleSidebar();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }

  formatNumber(value: number): string {
    return value.toLocaleString();
  }

  getProductDetails(sku: string): void {
    // Navigate to product details page
    console.log('Navigate to product details:', sku);
  }

  // Computed properties for template
  get totalFilteredRevenue(): number {
    return this.filteredProducts.reduce((sum, p) => sum + p.revenue, 0);
  }

  get totalFilteredOrders(): number {
    return this.filteredProducts.reduce((sum, p) => sum + p.totalOrders, 0);
  }

  get totalFilteredCustomers(): number {
    return this.filteredProducts.reduce((sum, p) => sum + p.uniqueCustomers, 0);
  }

  exportProducts(): void {
    console.log('Export all products');
    // TODO: Implement export functionality
  }

  exportFilteredProducts(): void {
    console.log('Export filtered products');
    // TODO: Implement export functionality
  }

  onTimePeriodChange(dateRange: { from: string; to: string }): void {
    this.fromDate = dateRange.from;
    this.toDate = dateRange.to;
    // You can add logic here to filter products data based on the selected time period
    console.log('Time period changed:', dateRange);
  }
}
