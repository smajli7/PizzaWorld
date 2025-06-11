package pizzaworld.controller;

import java.time.LocalDate;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import pizzaworld.service.PizzaService;
import pizzaworld.service.UserService;
import pizzaworld.model.CustomUserDetails;
import pizzaworld.model.User;

@RestController
@RequestMapping("/api")
public class PizzaController {
    @Autowired
    private PizzaService pizzaService;
    @Autowired
    private UserService userService;


    @GetMapping("/dashboard")
    public ResponseEntity<?> getDashboardKPIs(@AuthenticationPrincipal CustomUserDetails userDetails) {
            User user = userDetails.getUser();
        return ResponseEntity.ok(pizzaService.getDashboardKPIs(user));
}


    @GetMapping("/store/{storeId}")
    public ResponseEntity<?> getStoreKPIs(@PathVariable String storeId, @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(pizzaService.getStoreKPIs(storeId, user));
    }

    @GetMapping("/sales")
    public ResponseEntity<?> getSalesKPIs(@RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(pizzaService.getSalesKPIs(from, to, user));
    }

    @GetMapping("/orders")
    public ResponseEntity<?> getFilteredOrders(@RequestParam Map<String, String> params,
            @AuthenticationPrincipal UserDetails springUser) {

        User user = userService.find(springUser.getUsername());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        return ResponseEntity.ok(pizzaService.filterOrders(params));
    }

}
