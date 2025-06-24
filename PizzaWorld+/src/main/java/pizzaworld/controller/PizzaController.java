package pizzaworld.controller;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import pizzaworld.dto.DashboardKpiDto;
import pizzaworld.dto.SalesKpiDto;
import pizzaworld.model.CustomUserDetails;
import pizzaworld.model.User;
import pizzaworld.service.PizzaService;
import pizzaworld.util.CsvExportUtil;

@RestController
@RequestMapping("/api")
public class PizzaController {

    @Autowired private PizzaService pizzaService;

    /* ───────────────────────── Dashboard KPIs ───────────────────────── */
    @GetMapping("/dashboard")
    public ResponseEntity<DashboardKpiDto> getDashboardKPIs(
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getDashboardKPIs(user));
    }

    /* ───────────────────────── CSV-Export ───────────────────────── */
    @GetMapping("/dashboard/export")
    public void exportDashboardCsv(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            HttpServletResponse response) {

        DashboardKpiDto kpi = pizzaService.getDashboardKPIs(userDetails.getUser());

        List<String> headers = List.of("Revenue", "Orders", "AvgOrder", "Customers", "Products");
        List<List<String>> rows = List.of(List.of(
            String.valueOf(kpi.revenue()),
            String.valueOf(kpi.orders()),
            String.valueOf(kpi.avgOrder()),
            String.valueOf(kpi.customers()),
            String.valueOf(kpi.products())
        ));

        CsvExportUtil.writeCsv(response, headers, rows, "dashboard.csv");
    }

    /* ───────────────────────── Store KPIs ───────────────────────── */
    @GetMapping("/store/{storeId}")
    public ResponseEntity<DashboardKpiDto> getStoreKPIs(
            @PathVariable String storeId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        return ResponseEntity.ok(pizzaService.getStoreKPIs(storeId, userDetails));
    }

    /* ───────────────────────── Sales KPIs ───────────────────────── */
    @GetMapping("/sales")
    public ResponseEntity<SalesKpiDto> getSalesKPIs(
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        return ResponseEntity.ok(
            pizzaService.getSalesKPIs(from, to, userDetails.getUser())
        );
    }

    /* ───────────────────────── Orders Filter ───────────────────────── */
    @GetMapping("/orders")
    public ResponseEntity<List<Map<String,Object>>> getFilteredOrders(
            @RequestParam Map<String,String> params,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        return ResponseEntity.ok(
            pizzaService.filterOrders(params, userDetails.getUser())
        );
    }
}
