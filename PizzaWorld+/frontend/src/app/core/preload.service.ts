import { Injectable } from '@angular/core';
import { KpiService } from './kpi.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class PreloadService {
  constructor(private kpi: KpiService) {}

  preloadAll(): Promise<any> {
    // Fetch the earliest order date first
    return new Promise((resolve, reject) => {
      this.kpi.getEarliestOrderDate().subscribe({
        next: (earliestDate) => {
          const today = new Date();
          // Ensure we only send YYYY-MM-DD without time
          const fromDate = earliestDate ? earliestDate.split(/[T\s]/)[0] : '2000-01-01';
          const toDate = today.toISOString().split('T')[0];

          // Persist earliest order date so other pages can instantly use it
          localStorage.setItem('pizzaWorld_earliestOrderDate', fromDate);

          console.log('🚀 Starting comprehensive data preload...');
          console.log(`📅 Date range: ${fromDate} to ${toDate}`);

          forkJoin({
            products: this.kpi.getAllProducts().pipe(catchError((e) => {console.error('❌ Preload: Products failed', e); return of([]);})),
            stores: this.kpi.getAllStores().pipe(catchError((e) => {console.error('❌ Preload: Stores failed', e); return of([]);})),
            dashboard: this.kpi.getDashboard().pipe(catchError((e) => {console.error('❌ Preload: Dashboard failed', e); return of(null);})),
            performance: this.kpi.loadPerformanceData().pipe(catchError((e) => {console.error('❌ Preload: Performance failed', e); return of(null);})),
            salesKpis: this.kpi.getSalesKPIs(fromDate, toDate).pipe(catchError((e) => {console.error('❌ Preload: Sales KPIs failed', e); return of(null);})),
            bestProducts: this.kpi.getBestSellingProducts(fromDate, toDate).pipe(catchError((e) => {console.error('❌ Preload: Best Products failed', e); return of([]);})),
            storesByRevenue: this.kpi.getStoresByRevenue(fromDate, toDate).pipe(catchError((e) => {console.error('❌ Preload: Stores by Revenue failed', e); return of([]);})),
            salesTrend: this.kpi.getSalesTrendByDay(fromDate, toDate).pipe(catchError((e) => {console.error('❌ Preload: Sales Trend failed', e); return of([]);})),
            revenueByCategory: this.kpi.getRevenueByCategory(fromDate, toDate).pipe(catchError((e) => {console.error('❌ Preload: Revenue by Category failed', e); return of([]);})),
          }).toPromise().then((result: any = {}) => {
            const {
              products = [],
              stores = [],
              dashboard = null,
              performance = null,
              salesKpis = null,
              bestProducts = [],
              storesByRevenue = [],
              salesTrend = [],
              revenueByCategory = [],
            } = result;
            
            console.log('✅ Preload complete:', {
              products: products.length,
              stores: stores.length,
              dashboard: !!dashboard,
              performance: !!performance,
              salesKpis: !!salesKpis,
              bestProducts: bestProducts.length,
              storesByRevenue: storesByRevenue.length,
              salesTrend: salesTrend.length,
              revenueByCategory: revenueByCategory.length,
            });

            // Wait a moment for all data to be properly cached, then verify
            setTimeout(() => {
              this.verifyCacheStatus();
              
              // Double-check that all essential data is cached
              const allCached = this.kpi.isAllDataCached();
              if (allCached) {
                console.log('🎉 ALL DATA SUCCESSFULLY CACHED - READY FOR INSTANT TAB SWITCHING!');
                resolve(result);
              } else {
                console.log('⚠️ Some data may not be cached - tab switching may have delays');
                resolve(result);
              }
            }, 200);

          }).catch((err) => {
            console.error('❌ PreloadService.preloadAll() failed:', err);
            reject(err);
          });
        },
        error: (err) => {
          console.error('❌ PreloadService.getEarliestOrderDate() failed:', err);
          reject(err);
        }
      });
    });
  }

  /** Verify that all essential data was successfully cached */
  verifyCacheStatus(): void {
    console.log('🔍 Verifying cache status after preload...');
    this.kpi.debugCacheStatus();
    
    const allCached = this.kpi.isAllDataCached();
    if (allCached) {
      console.log('✅ All essential data successfully cached - ready for instant tab switching!');
    } else {
      console.log('⚠️ Some essential data may not be cached - tab switching may have delays');
    }
  }
} 