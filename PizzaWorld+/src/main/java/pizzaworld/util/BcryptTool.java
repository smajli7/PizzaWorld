package pizzaworld.util;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class BcryptTool {
    public static void main(String[] args) {
        System.out.println("store_1:   " + new BCryptPasswordEncoder().encode("store_1"));
        System.out.println("state_1:   " + new BCryptPasswordEncoder().encode("state_1"));
        System.out.println("HQ_View:   " + new BCryptPasswordEncoder().encode("HQ_View"));
    }
}

