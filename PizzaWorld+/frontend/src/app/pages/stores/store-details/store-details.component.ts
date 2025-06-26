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
    this.error = false;

    this.kpi.getAllStores()
      .pipe(
        catchError(err => {
          console.error('Store loading error:', err);
          this.error = true;
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe(stores => {
        this.store = stores.find(s => s.storeid === this.storeId) || null;
        if (!this.store) {
          this.error = true;
        }
      });
  }

  loadStoreStats(): void {
    console.log('Loading store stats for storeId:', this.storeId);
    // Load store-specific statistics from backend API
    this.kpi.getStoreStats(this.storeId)
      .pipe(
        catchError(err => {
          console.error('Store stats loading error:', err);
          console.error('Error details:', err.status, err.message);
          this.error = true;
          return of(null);
        })
      )
      .subscribe({
        next: (stats) => {
          console.log('Raw stats from backend:', stats);
          if (stats) {
            this.storeStats = {
              totalOrders: stats.kpis?.orders || 0,
              totalRevenue: stats.kpis?.revenue || 0,
              avgOrderValue: stats.kpis?.avg_order || 0,
              uniqueCustomers: stats.kpis?.customers || 0,
              topProducts: stats.topProducts || [],
              worstProducts: stats.worstProducts || []
            };
            console.log('Processed storeStats:', this.storeStats);
            console.log('Top products length:', this.storeStats.topProducts?.length);
            console.log('Worst products length:', this.storeStats.worstProducts?.length);
          } else {
            console.log('No stats returned from backend');
          }
        },
        error: (err) => {
          console.error('Subscription error:', err);
        }
      });
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