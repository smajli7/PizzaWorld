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

<<<<<<< Updated upstream
    /* ───────────────────────── Dashboard KPIs ───────────────────────── */
=======
    @Autowired
    private UserService userService;

    /**
     * 📊 API: GET /api/dashboard
     * ⏩ Ruft automatisch die KPIs für den eingeloggten Benutzer ab
     * 🔐 Zugriff je nach Rolle:
     * - HQ_ADMIN: alle Daten
     * - STATE_MANAGER: eigenes Bundesland
     * - STORE_MANAGER: eigene Filiale
     * ✅ Frontend:
     * - Aufrufen nach dem Login, um Startseite / KPI-Kacheln zu füllen
     */
>>>>>>> Stashed changes
    @GetMapping("/dashboard")
    public ResponseEntity<DashboardKpiDto> getDashboardKPIs(
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getDashboardKPIs(user));
    }

<<<<<<< Updated upstream
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
=======
    /**
     * 📥 API: GET /api/dashboard/export
     * ⏩ Exportiert genau dieselben Daten wie /dashboard als CSV
     * 🧠 Wird aufgerufen, wenn der User im Dashboard auf „CSV Exportieren“ klickt
     * ✅ Frontend:
     * - Triggern über Button
     * - Header `Authorization: Bearer <token>` nicht vergessen
     * - Response ist eine CSV-Datei
     */
    @GetMapping("/dashboard/export")
    public void exportDashboardCsv(@AuthenticationPrincipal CustomUserDetails userDetails,
            HttpServletResponse response) {
        Map<String, Object> data = pizzaService.getDashboardKPIs(userDetails.getUser());

        List<String> headers = List.of("Revenue", "Orders", "AvgOrder", "Customers", "Products");
        List<List<String>> rows = List.of(List.of(
                String.valueOf(data.get("revenue")),
                String.valueOf(data.get("orders")),
                String.valueOf(data.get("avgOrder")),
                String.valueOf(data.get("customers")),
                String.valueOf(data.get("products"))));
>>>>>>> Stashed changes

        CsvExportUtil.writeCsv(response, headers, rows, "dashboard.csv");
    }

<<<<<<< Updated upstream
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
=======
    /**
     * 🏬 API: GET /api/store/{storeId}
     * ⏩ Gibt KPIs für eine bestimmte Filiale zurück
     * 🔐 Zugriff nur wenn:
     * - HQ_ADMIN: jede Filiale
     * - STATE_MANAGER: Filiale im eigenen Bundesland
     * - STORE_MANAGER: nur eigene Filiale
     * ✅ Frontend:
     * - Kann für KPI-Ansicht einer bestimmten Filiale verwendet werden (z. B.
     * Auswahl im Dropdown)
     */
    @GetMapping("/store/{storeId}")
    public ResponseEntity<?> getStoreKPIs(@PathVariable String storeId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(pizzaService.getStoreKPIs(storeId, userDetails));
    }

    /**
     * 📆 API: GET /api/sales?from=YYYY-MM-DD&to=YYYY-MM-DD
     * ⏩ Gibt Umsatz- und Verkaufszahlen für den Zeitraum zurück
     * 🔐 Zugriff je nach Rolle:
     * - HQ_ADMIN: alle Verkäufe
     * - STATE_MANAGER: Verkäufe im eigenen Bundesland
     * - STORE_MANAGER: Verkäufe eigener Filiale
     * ✅ Frontend:
     * - Ideal für Diagramme mit Zeitintervall (z. B. „Umsatzentwicklung“)
     * - Beispiel: /api/sales?from=2025-01-01&to=2025-03-31
     */
    @GetMapping("/sales")
    public ResponseEntity<?> getSalesKPIs(@RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getSalesKPIs(from, to, user));
    }

    /**
     * 📦 API: GET /api/orders?storeId=...&customerId=...
     * ⏩ Gibt Bestellungen gefiltert nach Filiale und/oder Kunde zurück
     * 🔐 Zugriff:
     * - HQ_ADMIN: alle
     * - STATE_MANAGER: nur eigene Bundesland-Filialen
     * - STORE_MANAGER: nur eigene Filiale
     * ✅ Frontend:
     * - Beispiel für Tabelle: Alle Orders einer Filiale
     * - Beispiel: /api/orders?storeId=S490972
     * - Optional kann zusätzlich ?customerId=... übergeben werden
     */
    @GetMapping("/orders")
    public ResponseEntity<?> getFilteredOrders(@RequestParam Map<String, String> params,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.filterOrders(params, user));
>>>>>>> Stashed changes
    }

    /**
     * 🧀 API: GET /api/products?storeId=...&category=...&available=...
     * ⏩ Gibt Produkte gefiltert nach Filiale, Kategorie, Verfügbarkeit zurück
     * 🔐 Zugriff:
     * - HQ_ADMIN: alle Produkte
     * - STATE_MANAGER: nur Produkte aus eigenen Filialen
     * - STORE_MANAGER: nur eigene Filiale
     * ✅ Frontend:
     * - Flexibler Einsatz in Produktübersicht / Management-UI
     * - Beispiel: /api/products?storeId=S490972&category=Pizza
     */
    @GetMapping("/products")
    public ResponseEntity<?> getFilteredProducts(@RequestParam Map<String, String> params,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        System.out.println("🔐 Controller erreicht");
        System.out.println("👤 userDetails: " + userDetails);
        return ResponseEntity.ok(pizzaService.filterProducts(params, user));
    }

    @GetMapping("/product/{sku}")

    public ResponseEntity<?> getProductDetail(@PathVariable String sku) {
        return ResponseEntity.ok(pizzaService.getProductDetails(sku));
    }
}
