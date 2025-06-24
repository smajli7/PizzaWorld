
package pizzaworld.dto;

public record DashboardKpiDto(
    double revenue,
    long   orders,
    double avgOrder,
    long   customers,
    long   products
) {}
