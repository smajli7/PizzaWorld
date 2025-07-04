# 🍕 PizzaWorld Dashboard

Ein vollständiges Dashboard-System für PizzaWorld mit Angular Frontend und Spring Boot Backend.

## 🚀 Schnellstart

### Windows
```bash
cd PizzaWorld+
./start.bat
```

### Mac/Linux
```bash
cd PizzaWorld+
./start.sh
```

Das war's! Die Anwendung startet automatisch auf `http://localhost:4200`

## 🔧 Was die Start-Skripte machen

Die Skripte (`start.bat` / `start.sh`) führen automatisch folgende Schritte aus:

1. **Setzen der Umgebungsvariablen** (sicher, ohne Passwörter im Code)
   - Datenbankverbindung
   - JWT-Secret
   - Weitere Konfigurationen

2. **Starten beider Services parallel**
   - Backend (Spring Boot) auf Port 8080
   - Frontend (Angular) auf Port 4200

3. **Automatische Proxy-Konfiguration**
   - Frontend leitet API-Calls automatisch an Backend weiter

## 🔒 Sicherheitsfeatures

- **JWT-basierte Authentifizierung**
- **Rollenbasierte Zugriffskontrolle**
- **Sichere Umgebungsvariablen** (keine Passwörter im Sourcecode)
- **BCrypt Passwort-Hashing**
- **Route Guards** im Frontend
- **Spring Security** im Backend

## 🏗️ Technologie-Stack

**Frontend:**
- Angular 19
- TypeScript
- Tailwind CSS
- PrimeNG Components
- ApexCharts für Visualisierungen

**Backend:**
- Spring Boot 3
- Spring Security
- JWT Authentication
- PostgreSQL (Supabase)
- Maven

## 📊 Features

- **Dashboard** mit KPIs und Charts
- **Bestellverwaltung**
- **Produktkatalog**
- **Filialverwaltung**
- **Verkaufsanalysen**
- **Kundenanalysen**
- **Liefermetriken**
- **Support-System**

## 🔧 Manuelle Installation (falls nötig)

### Voraussetzungen
- Node.js (v18+)
- Java 17+
- Maven

### Frontend Setup
```bash
cd PizzaWorld+/frontend
npm install
```

### Backend Setup
```bash
cd PizzaWorld+
./mvnw clean install
```

### Manueller Start
```bash
# Terminal 1: Backend
cd PizzaWorld+
./mvnw spring-boot:run

# Terminal 2: Frontend
cd PizzaWorld+/frontend
npm start
```

## 🌐 Zugriff

- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:8080/api

## 👤 Demo-Zugangsdaten

- **Username**: admin
- **Password**: admin123

## 🔍 Entwicklung

### Frontend-Entwicklung
```bash
cd PizzaWorld+/frontend
npm run watch    # Live-Reload für Entwicklung
npm run build    # Produktions-Build
npm run test     # Unit Tests
```

### Backend-Entwicklung
```bash
cd PizzaWorld+
./mvnw spring-boot:run    # Backend starten
./mvnw test              # Tests ausführen
```

## 📁 Projektstruktur

```
PizzaWorld+/
├── frontend/           # Angular Frontend
│   ├── src/app/       # Angular Components
│   ├── proxy.conf.json # Proxy-Konfiguration
│   └── package.json   # Frontend Dependencies
├── src/main/java/     # Spring Boot Backend
│   └── pizzaworld/    # Java Packages
├── start.bat          # Windows Start-Skript
├── start.sh           # Mac/Linux Start-Skript
└── pom.xml           # Backend Dependencies
```

## 🚨 Wichtige Hinweise

- **Verwende immer die Start-Skripte** (`start.bat` / `start.sh`)
- **Nicht direkt `npm run start:all` ausführen** - das führt zu Fehlern
- Die Umgebungsvariablen werden automatisch gesetzt
- Beide Services starten parallel für optimale Performance

## 🤝 Support

Bei Problemen oder Fragen wende dich an das Entwicklungsteam oder nutze das integrierte Support-System im Dashboard. 
