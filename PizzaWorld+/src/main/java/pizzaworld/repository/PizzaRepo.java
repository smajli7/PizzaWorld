package pizzaworld.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import pizzaworld.model.User;

@Repository
public interface PizzaRepo extends JpaRepository<User, Long> {

       @Query(value = """
                         SELECT SUM(order_total) AS revenue, COUNT(*) AS orders,
                                AVG(order_total) AS avg_order, COUNT(DISTINCT customer_id) AS customers,
                                (SELECT COUNT(*) FROM products) AS products
                         FROM orders
                     """, nativeQuery = true)
       Map<String, Object> fetchGlobalKPIs();

       @Query(value = """
                         SELECT SUM(order_total) AS revenue, COUNT(*) AS orders,
                                AVG(order_total) AS avg_order, COUNT(DISTINCT customer_id) AS customers,
                                (SELECT COUNT(*) FROM products WHERE state = :state) AS products
                         FROM orders
                         WHERE state = :state
                     """, nativeQuery = true)
       Map<String, Object> fetchStateKPIs(@Param("state") String state);

       @Query(value = """
                         SELECT SUM(order_total) AS revenue, COUNT(*) AS orders,
                                AVG(order_total) AS avg_order, COUNT(DISTINCT customer_id) AS customers,
                                (SELECT COUNT(*) FROM products WHERE store_id = :storeId) AS products
                         FROM orders
                         WHERE store_id = :storeId
                     """, nativeQuery = true)
       Map<String, Object> fetchStoreKPIs(@Param("storeId") String storeId);

       @Query(value = "SELECT state FROM stores WHERE store_id = :storeId", nativeQuery = true)
       String getStoreState(@Param("storeId") String storeId);

       @Query(value = """
                         SELECT SUM(order_total) AS revenue, COUNT(*) AS total_orders,
                                COUNT(DISTINCT customer_id) AS unique_customers,
                                AVG(order_total) AS avg_order
                         FROM orders
                         WHERE sale_date BETWEEN :from AND :to
                     """, nativeQuery = true)
       Map<String, Object> fetchSalesKPIs(@Param("from") LocalDate from, @Param("to") LocalDate to);

       @Query(value = """
                         SELECT SUM(order_total) AS revenue, COUNT(*) AS total_orders,
                                COUNT(DISTINCT customer_id) AS unique_customers,
                                AVG(order_total) AS avg_order
                         FROM orders
                         WHERE state = :state AND sale_date BETWEEN :from AND :to
                     """, nativeQuery = true)
       Map<String, Object> fetchSalesKPIsByState(@Param("state") String state, @Param("from") LocalDate from,
                     @Param("to") LocalDate to);

       @Query(value = """
                         SELECT SUM(order_total) AS revenue, COUNT(*) AS total_orders,
                                COUNT(DISTINCT customer_id) AS unique_customers,
                                AVG(order_total) AS avg_order
                         FROM orders
                         WHERE store_id = :storeId AND sale_date BETWEEN :from AND :to
                     """, nativeQuery = true)
       Map<String, Object> fetchSalesKPIsByStore(@Param("storeId") String storeId, @Param("from") LocalDate from,
                     @Param("to") LocalDate to);

}
