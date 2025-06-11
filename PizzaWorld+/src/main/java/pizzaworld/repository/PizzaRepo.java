package pizzaworld.repository;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pizzaworld.model.User;

@Repository
public interface PizzaRepo extends JpaRepository<User, Long> {

Optional<User> findByUsername(String username);

@Query(value = """
       SELECT SUM(total) AS revenue,
              COUNT(*) AS orders,
              AVG(total) AS avg_order,
              COUNT(DISTINCT customerid) AS customers,
              (SELECT COUNT(*) FROM products) AS products
       FROM orders
""", nativeQuery = true)
Map<String, Object> fetchGlobalKPIs();

@Query(value = """
       SELECT SUM(o.total) AS revenue,
              COUNT(*) AS orders,
              AVG(o.total) AS avg_order,
              COUNT(DISTINCT o.customerid) AS customers,
              (SELECT COUNT(*) FROM products p
              JOIN stores s ON p.sku IS NOT NULL
              WHERE s.state = :state) AS products
       FROM orders o
       JOIN stores s ON o.storeid = s.storeid
       WHERE s.state = :state
""", nativeQuery = true)
       Map<String, Object> fetchStateKPIs(@Param("state") String state);

@Query(value = """
       SELECT SUM(total) AS revenue,
              COUNT(*) AS orders,
              AVG(total) AS avg_order,
              COUNT(DISTINCT customerid) AS customers,
              (SELECT COUNT(*) FROM products) AS products
       FROM orders
       WHERE storeid = :storeId
""", nativeQuery = true)
Map<String, Object> fetchStoreKPIs(@Param("storeId") String storeId);

@Query(value = "SELECT state_abbr FROM stores WHERE storeid = :storeId", nativeQuery = true)
String getStoreState(@Param("storeId") String storeId);

@Query(value = """
       SELECT SUM(total) AS revenue,
              COUNT(*) AS total_orders,
              COUNT(DISTINCT customerid) AS unique_customers,
              AVG(total) AS avg_order
       FROM orders
       WHERE orderdate BETWEEN :from AND :to
""", nativeQuery = true)
Map<String, Object> fetchSalesKPIs(@Param("from") LocalDate from, @Param("to") LocalDate to);

@Query(value = """
       SELECT SUM(o.total) AS revenue,
              COUNT(*) AS total_orders,
              COUNT(DISTINCT o.customerid) AS unique_customers,
              AVG(o.total) AS avg_order
       FROM orders o
       JOIN stores s ON o.storeid = s.storeid
       WHERE s.state = :state
       AND o.orderdate BETWEEN :from AND :to
""", nativeQuery = true)
Map<String, Object> fetchSalesKPIsByState(@Param("state") String state,
                                          @Param("from") LocalDate from,
                                          @Param("to") LocalDate to);

@Query(value = """
       SELECT SUM(total) AS revenue,
              COUNT(*) AS total_orders,
              COUNT(DISTINCT customerid) AS unique_customers,
              AVG(total) AS avg_order
       FROM orders
       WHERE storeid = :storeId
       AND orderdate BETWEEN :from AND :to
""", nativeQuery = true)
Map<String, Object> fetchSalesKPIsByStore(@Param("storeId") String storeId,
                                          @Param("from") LocalDate from,
                                          @Param("to") LocalDate to);
}
