// src/app/pages/dashboard/dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule }      from '@angular/common';        // ⬅️ NEU
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { KpiTileComponent }  from '../../core/kpi-tile/KpiTileComponent';
import { KpiService, DashboardKpiDto } from '../../core/kpi.service';

@Component({
  standalone: true,
  selector  : 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls : ['./dashboard.component.scss'],
  imports   : [
    CommonModule,         // ⬅️  Pipe-Definitionen
    SidebarComponent,
    KpiTileComponent
  ]
})
export class DashboardComponent implements OnInit {
  kpis: DashboardKpiDto | null = null;

  constructor(private kpi: KpiService) {}

  ngOnInit() {
    this.kpi.getDashboard().subscribe(k => this.kpis = k);
  }
}
