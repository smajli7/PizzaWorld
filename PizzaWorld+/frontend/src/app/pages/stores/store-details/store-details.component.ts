import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SidebarComponent } from '../../../shared/sidebar/sidebar.component';
import { KpiService, StoreInfo } from '../../../core/kpi.service';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-store-details',
  standalone: true,
  imports: [
    SidebarComponent,
    CommonModule,
    CardModule,
    ButtonModule
  ],
  templateUrl: './store-details.component.html',
  styleUrls: ['./store-details.component.scss']
})
export class StoreDetailsComponent implements OnInit {
  storeId: string = '';
  store: StoreInfo | null = null;
  loading = true;
  error = false;
  storeStats: any = null;

  // New: track errors separately
  detailsError = false;
  statsError = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private kpi: KpiService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.storeId = params['id'];
      this.loadStoreDetails();
      this.loadStoreStats();
    });
  }

  loadStoreDetails(): void {
    this.loading = true;
    this.detailsError = false;
    this.error = false;

    this.kpi.getAllStores()
      .pipe(
        catchError(err => {
          console.error('Store loading error:', err);
          this.detailsError = true;
          this.updateErrorState();
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe(stores => {
        this.store = stores.find(s => s.storeid === this.storeId) || null;
        if (!this.store) {
          this.detailsError = true;
          this.updateErrorState();
        } else {
          this.detailsError = false;
          this.updateErrorState();
        }
      });
  }

  loadStoreStats(): void {
    this.statsError = false;
    this.kpi.getStoreStats(this.storeId)
      .pipe(
        catchError(err => {
          console.error('Store stats loading error:', err);
          this.statsError = true;
          this.updateErrorState();
          return of(null);
        })
      )
      .subscribe({
        next: (stats) => {
          if (stats) {
            this.storeStats = {
              totalOrders: stats.kpis?.orders || 0,
              totalRevenue: stats.kpis?.revenue || 0,
              avgOrderValue: stats.kpis?.avg_order || 0,
              uniqueCustomers: stats.kpis?.customers || 0,
              topProducts: Array.isArray(stats.topProducts)
                ? stats.topProducts.map((p: any) => ({
                    name: p.name || 'No data available',
                    size: p.size || '',
                    sku: p.sku || ''
                  }))
                : [],
              worstProducts: Array.isArray(stats.worstProducts)
                ? stats.worstProducts.map((p: any) => ({
                    name: p.name || 'No data available',
                    size: p.size || '',
                    sku: p.sku || ''
                  }))
                : []
            };
            this.statsError = false;
            this.updateErrorState();
          } else {
            this.statsError = true;
            this.updateErrorState();
          }
        },
        error: (err) => {
          this.statsError = true;
          this.updateErrorState();
        }
      });
  }

  // New: update error state based on both requests
  updateErrorState(): void {
    this.error = this.detailsError && this.statsError;
  }

  goBack(): void {
    this.router.navigate(['/stores']);
  }

  openInMaps(lat: number, lng: number): void {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank');
  }

  formatCoordinates(lat: number, lng: number): string {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
} 