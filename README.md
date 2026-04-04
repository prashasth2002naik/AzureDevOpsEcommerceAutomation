# E-Commerce Microservices Application

## Project Structure
```
ecommerce-microservices/
├── eureka-server/          # Service Discovery (Port 8761)
├── api-gateway/            # API Gateway (Port 8080)
├── product-service/        # Product Management (Port 8081)
├── order-service/          # Order Management (Port 8082)
├── user-service/           # User Management (Port 8083)
└── frontend/               # React Frontend (Port 3000)
```

## Prerequisites
- Java 17 or higher
- Maven 3.6+
- Node.js 14+ and npm
- IDE (IntelliJ IDEA or Eclipse recommended)

## Setup Instructions (BAREMETAL)

### 1. Start Services (IN ORDER)

**Terminal 1 - Eureka Server:**
```bash
cd eureka-server
mvn clean install
mvn spring-boot:run
```
Wait until "Started EurekaServerApplication" appears
Verify at: http://localhost:8761

**Terminal 2 - API Gateway:**
```bash
cd api-gateway
mvn clean install
mvn spring-boot:run
```

**Terminal 3 - Product Service:**
```bash
cd product-service
mvn clean install
mvn spring-boot:run
```

**Terminal 4 - Order Service:**
```bash
cd order-service
mvn clean install
mvn spring-boot:run
```

**Terminal 5 - User Service:**
```bash
cd user-service
mvn clean install
mvn spring-boot:run
```

### 2. Start Frontend

**Terminal 6:**
```bash
cd frontend
npm install
npm start
```

## Verify Installation

1. Eureka Dashboard: http://localhost:8761
   - All services should be registered
2. API Gateway Test: http://localhost:8080/api/products
3. Frontend: http://localhost:3000

## API Endpoints

### Products
- GET    /api/products
- GET    /api/products/{id}
- POST   /api/products
- PUT    /api/products/{id}
- DELETE /api/products/{id}

### Orders
- GET    /api/orders
- GET    /api/orders/{id}
- GET    /api/orders/user/{userId}
- POST   /api/orders

### Users
- GET    /api/users
- GET    /api/users/{id}
- POST   /api/users

## Troubleshooting

1. **Port in use**: Change port in application.yml
2. **Services not registering**: Ensure Eureka is running first
3. **CORS errors**: Check API Gateway configuration
4. **Database errors**: Access H2 console at http://localhost:808X/h2-console

## Features

- Microservices architecture with service discovery
- API Gateway for routing
- H2 in-memory databases
- RESTful APIs
- React frontend with routing
- Pre-loaded sample data

## Technology Stack

**Backend:**
- Spring Boot 3.2.0
- Spring Cloud (Eureka, Gateway)
- Spring Data JPA
- H2 Database
- Lombok

**Frontend:**
- React 18
- React Router
- Axios
- CSS3



testing webhook
