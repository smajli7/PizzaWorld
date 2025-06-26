import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { RouterModule }   from '@angular/router';
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

  constructor() {}

  ngOnInit(): void {
    // Assuming the data is fetched from a service or API
    this.products = [
      { id: 1, name: 'Product 1', category: 'Category A', size: 'Small' },
      { id: 2, name: 'Product 2', category: 'Category B', size: 'Medium' },
      { id: 3, name: 'Product 3', category: 'Category A', size: 'Large' },
      { id: 4, name: 'Product 4', category: 'Category C', size: 'Small' },
      { id: 5, name: 'Product 5', category: 'Category B', size: 'Medium' },
      { id: 6, name: 'Product 6', category: 'Category A', size: 'Large' },
      { id: 7, name: 'Product 7', category: 'Category C', size: 'Small' },
      { id: 8, name: 'Product 8', category: 'Category B', size: 'Medium' },
      { id: 9, name: 'Product 9', category: 'Category A', size: 'Large' },
      { id: 10, name: 'Product 10', category: 'Category C', size: 'Small' }
    ];
    this.applyFilters();
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
