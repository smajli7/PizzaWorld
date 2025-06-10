package pizzaworld.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import pizzaworld.model.CustomUserDetails;
import pizzaworld.repository.UserRepo;

@Configuration
@EnableWebSecurity // Deaktiviert Spring Boot's Auto-Konfiguration und nutzt diese hier
public class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(); // sichere Passwortverschlüsselung
    }

    // ➕ Benutzerdetails aus der DB holen und in CustomUserDetails einwickeln
    @Bean
    UserDetailsService userDetailsService(UserRepo repo) {
        return username -> {
            System.out.println("🔍 Suche Benutzer: " + username);
            return repo.findByUsername(username)
                .map(CustomUserDetails::new) // 👈 unser echter DB-User wird verwendet
                .orElseThrow(() -> new UsernameNotFoundException("Benutzer nicht gefunden: " + username));
        };
    }

    // 👇 Ermöglicht manuelle Authentifizierung z. B. im Login-Controller
    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }

    // 🔐 Haupt-Sicherheitskonfiguration
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        http
            .csrf(AbstractHttpConfigurer::disable) // Für REST-APIs meist deaktiviert
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.ALWAYS)) // Session anlegen bei Login
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/login", "/api/logout", "/error", "/login").permitAll()
                .anyRequest().authenticated()
            )
            .httpBasic(AbstractHttpConfigurer::disable) // Basic Auth deaktivieren
            .formLogin(AbstractHttpConfigurer::disable) // Kein Login-Formular anzeigen (du kannst dein eigenes bauen)
            .logout(logout -> logout.logoutUrl("/logout")); // Logout-URL

        return http.build();
    }
}
