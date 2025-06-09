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
//import org.springframework.security.crypto.password.NoOpPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import pizzaworld.repository.UserRepo;

@Configuration
@EnableWebSecurity          // sorgt dafür, dass diese Config die Auto-Security ersetzt
public class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();       // RICHTIG
}

    @Bean
UserDetailsService userDetailsService(UserRepo repo) {
    return username -> {
        System.out.println("🔍 Suche Benutzer: " + username);
        return repo.findByUsername(username)
            .map(u -> org.springframework.security.core.userdetails.User
                .withUsername(u.getUsername())
                .password(u.getPassword())
                .roles(u.getRole())
                .build())
            .orElseThrow(() -> new UsernameNotFoundException(username));
    };
}



    /* ---------- AuthenticationManager für den Controller ---------- */
    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }

    /* ---------- EINZIGE Security-Kette ---------- */
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        http
            .csrf(AbstractHttpConfigurer::disable)                 // CSRF für Demo aus
            .sessionManagement(sm ->
                    sm.sessionCreationPolicy(SessionCreationPolicy.ALWAYS)) // Session anlegen
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/login", "/api/logout", "/error", "/login").permitAll()
            .anyRequest().authenticated())
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .logout(logout -> logout.logoutUrl("/logout"));

        return http.build();
    }
}
