package pizzaworld.controller;

import java.time.LocalDate;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import pizzaworld.service.PizzaService;
import pizzaworld.model.CustomUserDetails;
import pizzaworld.model.User;

@RestController
@RequestMapping("/api")
public class PizzaController {

    @Autowired
    private PizzaService pizzaService;

    // 📊 Dashboard-KPIs je nach Rolle (HQ, State, Store)
    @GetMapping("/dashboard")
    public ResponseEntity<?> getDashboardKPIs(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getDashboardKPIs(user));
    }

    // 📍 KPIs für bestimmte Filiale (nur erlaubt für HQ, zuständiger State oder Store-Manager)
    @GetMapping("/store/{storeId}")
    public ResponseEntity<?> getStoreKPIs(
            @PathVariable String storeId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getStoreKPIs(storeId, user));
    }

    // 💶 Umsatzanalyse nach Zeitraum (je nach Rolle unterschiedlich gefiltert)
    @GetMapping("/sales")
    public ResponseEntity<?> getSalesKPIs(
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getSalesKPIs(from, to, user));
    }
}
