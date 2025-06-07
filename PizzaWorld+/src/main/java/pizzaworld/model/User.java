package pizzaworld.model;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false)             // Klartext-PW nur für Demo!
    private String password;

    @Column(nullable = false)             // HQ_ADMIN | STATE_MANAGER | STORE_MANAGER
    private String role;

    // FK-Spalten – je nach Rolle ist genau eine gefüllt
    private String storeId;               // STORE_MANAGER
    private String stateAbbr;             // STATE_MANAGER

    /* -----  Getter & Setter  ----- */

    public Long getId()                     { return id; }
    public String getUsername()             { return username; }
    public String getPassword()             { return password; }
    public String getRole()                 { return role; }
    public String getStoreId()              { return storeId; }
    public String getStateAbbr()            { return stateAbbr; }

    public void setUsername(String u)       { this.username = u; }
    public void setPassword(String p)       { this.password = p; }
    public void setRole(String r)           { this.role = r; }
    public void setStoreId(String s)        { this.storeId = s; }
    public void setStateAbbr(String a)      { this.stateAbbr = a; }

public boolean isHQ() {
    return "HQ_ADMIN".equals(role);
}

public boolean isStateManager() {
    return "STATE_MANAGER".equals(role);
}

public boolean isStoreManager() {
    return "STORE_MANAGER".equals(role);
}

}

