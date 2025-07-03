// src/app/shared/sidebar/sidebar.component.ts
import { Component, ElementRef, ViewChild, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { KpiService, OrdersKPIs } from '../../core/kpi.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  imports: [CommonModule, RouterModule]
})
export class SidebarComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  private kpiService = inject(KpiService);
  private destroy$ = new Subject<void>();

  user$: typeof this.auth.currentUser$;

  @ViewChild('sidebar', { static: true }) sidebar!: ElementRef<HTMLElement>;

  // Quick Stats data
  quickStats: OrdersKPIs = {
    totalOrders: 0,
    totalRevenue: 0,
    totalCustomers: 0,
    totalStores: 0
  };
  quickStatsLoading = true;
  quickStatsError = false;

  constructor() {
    this.user$ = this.auth.currentUser$;
  }

  ngOnInit(): void {
    this.loadQuickStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadQuickStats(): void {
    this.quickStatsLoading = true;
    this.quickStatsError = false;

    // Load KPIs without any filters to get all-time stats
    this.kpiService.getOrdersKPIs()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (kpis: OrdersKPIs) => {
          this.quickStats = kpis;
          this.quickStatsLoading = false;
        },
        error: (error: any) => {
          console.error('Error loading quick stats:', error);
          this.quickStatsError = true;
          this.quickStatsLoading = false;
        }
      });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  formatCompactNumber(value: number): string {
    // Return exact number instead of compact format for accuracy
    return new Intl.NumberFormat('en-US').format(value);
  }

  formatCompactCurrency(value: number): string {
    // For currency, still use compact format but with more precision
    if (value >= 1000000) {
      return '$' + (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return '$' + (value / 1000).toFixed(1) + 'K';
    }
    return '$' + new Intl.NumberFormat('en-US').format(value);
  }

  toggleSidebar(): void {
    this.sidebar.nativeElement.classList.toggle('collapsed');
  }

  logout(): void {
    this.auth.logout();
    sessionStorage.setItem('logoutMsg', 'You have been successfully logged out.');
    this.router.navigate(['/login']);
  }
}
