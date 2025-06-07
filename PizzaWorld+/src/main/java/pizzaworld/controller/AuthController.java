package pizzaworld.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.*;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import pizzaworld.model.User;
import pizzaworld.service.UserService;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuthController {

    /* ---------- DTO direkt hier ---------- */
    public record LoginRequest(String username, String password) {}

    private final AuthenticationManager authManager;
    private final UserService userService;

    public AuthController(AuthenticationManager authManager, UserService userService) {
        this.authManager = authManager;
        this.userService = userService;
    }

    /* ---------- 1. JSON-Login ---------- */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {

        Authentication auth = authManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.username(), req.password()));

        // Session festschreiben
        SecurityContextHolder.getContext().setAuthentication(auth);

        return ResponseEntity.ok(Map.of(
                "message",  "Login success",
                "username", auth.getName(),
                "roles",    auth.getAuthorities()
        ));
    }

    /* ---------- 2. Aktuell eingeloggter Benutzer ---------- */
    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal UserDetails springUser) {
        if (springUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                 .body(Map.of("error", "Not logged in"));
        }
        User u = userService.find(springUser.getUsername());
        if (u == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                 .body(Map.of("error", "User not in DB"));
        }
        Map<String, Object> body = new HashMap<>();
        body.put("username", u.getUsername());
        body.put("role",     u.getRole());
        body.put("storeId",  u.getStoreId());
        body.put("stateAbbr",u.getStateAbbr());
        return ResponseEntity.ok(body);
    }

    /* ---------- 3. Logout ---------- */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest req) {
        req.getSession().invalidate();
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(Map.of("message", "Logged out"));
    }
}
