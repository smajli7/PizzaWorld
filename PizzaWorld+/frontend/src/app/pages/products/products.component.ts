import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { RouterModule }   from '@angular/router';
import { HttpClient, } from '@angular/common/http';
import { FormsModule }    from '@angular/forms';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';

@Component({
  standalone : true,
  selector   : 'app-products',
  templateUrl: './products.component.html',
  styleUrls  : ['./products.component.scss'],
  imports    : [
    SidebarComponent,
    CommonModule,
    RouterModule,
    FormsModule
  ]
})
export class ProductsComponent implements OnInit {
  /* Sidebar-Instanz, um collapse auszulösen (optional) */
  @ViewChild(SidebarComponent) sidebar!: SidebarComponent;

  /* Daten & Filter */
  products:         any[] = [];
  filteredProducts: any[] = [];
  categoryFilter = '';
  sizeFilter     = '';
  searchTerm     = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any[]>('/api/products').subscribe(p => {
      this.products = p;
      this.applyFilters();
    });
  }

  toggleSidebar(): void {
    this.sidebar.toggleSidebar();
  }

  applyFilters(): void {
    const term = this.searchTerm.toLowerCase();
    this.filteredProducts = this.products.filter(p =>
      (!this.categoryFilter || p.category === this.categoryFilter) &&
      (!this.sizeFilter     || p.size     === this.sizeFilter)     &&
      (!this.searchTerm     || p.name.toLowerCase().includes(term))
    );
  }
}
