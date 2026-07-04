# KilatGo Backend

Backend API untuk aplikasi ride-hailing / ojek online **KilatGo**.

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Framework**: Express.js
- **ORM**: Prisma
- **Database**: MySQL / MariaDB
- **Real-time**: Socket.io
- **Auth**: JWT + bcrypt
- **Validation**: Zod

## Features

- ✅ JWT Authentication (Customer, Driver, Admin)
- ✅ User management & driver approval
- ✅ Order booking & status flow
- ✅ Real-time driver tracking via WebSocket
- ✅ Payment module (mock gateway, ready for integration)
- ✅ Notification module (mock push, ready for FCM/OneSignal)
- ✅ Admin dashboard API (stats, orders, earnings)

## Project Structure

```
KilatGo_backend/
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Admin user seeder
├── src/
│   ├── config/          # Database config
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Auth, error, validation middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Helpers (JWT, response, fare, socket)
│   ├── validators/      # Zod schemas
│   ├── app.ts           # Express app setup
│   └── server.ts        # HTTP + Socket.io server
├── .env.example
├── package.json
└── tsconfig.json
```

## Prerequisites

- Node.js 20 or higher
- MySQL / MariaDB running (MAMP, XAMPP, atau standalone)
- npm / yarn / pnpm

## Installation

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
npm run setup:env
# atau manual: cp .env.example .env

# 3. Update .env sesuai database kamu
# Contoh untuk MAMP:
# DATABASE_URL="mysql://root:root@localhost:3306/kilatgo_db"

# 4. Generate Prisma client
npm run db:generate

# 5. Run database migrations
npm run db:migrate

# 6. Seed admin user
npm run db:seed

# 7. Jalankan server development
npm run dev
```

## Default Admin Credentials

Setelah seed, login dengan:

```
Email: admin@kilatgo.com
Password: admin123
```

Bisa diubah di `.env` sebelum menjalankan `npm run db:seed`.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run development server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed admin user |
| `npm run db:studio` | Open Prisma Studio |
| `npm run lint` | Type-check without emit |

## API Overview

### Auth
- `POST /api/auth/register/customer` - Register customer
- `POST /api/auth/register/driver` - Register driver (needs admin approval)
- `POST /api/auth/login` - Login

### Users
- `GET /api/users/profile` - Get current user profile
- `PATCH /api/users/profile` - Update profile
- `PATCH /api/users/driver/profile` - Update driver vehicle info

### Orders
- `POST /api/orders` - Create order (customer)
- `GET /api/orders` - List my orders
- `GET /api/orders/:id` - Get order detail
- `GET /api/orders/available` - List available orders (driver)
- `POST /api/orders/:id/accept` - Accept order (driver)
- `PATCH /api/orders/:id/status` - Update order status (driver)
- `PATCH /api/orders/:id/cancel` - Cancel order

### Tracking
- `POST /api/tracking/online` - Set driver online
- `POST /api/tracking/offline` - Set driver offline
- `POST /api/tracking/location` - Update driver location (REST)
- `GET /api/tracking/orders/:orderId` - Get order tracking

### Payments
- `POST /api/payments/process` - Process payment for order
- `GET /api/payments` - List payments
- `GET /api/payments/:id` - Get payment detail

### Notifications
- `GET /api/notifications` - List notifications
- `PATCH /api/notifications/:id/read` - Mark as read
- `PATCH /api/notifications/read-all` - Mark all as read

### Admin
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/orders` - All orders with filters
- `GET /api/admin/earnings` - Earnings report
- `GET /api/admin/drivers/pending` - Pending driver approvals
- `GET /api/users/drivers` - List drivers
- `GET /api/users/customers` - List customers
- `PATCH /api/users/drivers/:id/approve` - Approve/reject driver
- `POST /api/admin/users/:id/suspend` - Suspend user
- `POST /api/admin/users/:id/activate` - Activate user

## WebSocket Events

Connection: `ws://localhost:3000` dengan auth token:

```javascript
const socket = io('ws://localhost:3000', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});
```

### Driver emits
- `driver:online` - Set driver online
- `driver:offline` - Set driver offline
- `driver:location` - `{ orderId?, latitude, longitude }`

### Customer emits
- `customer:track` - `{ orderId }` - Subscribe to order location
- `customer:stop_track` - `{ orderId }` - Unsubscribe

### Customer listens
- `order:location` - `{ orderId, driverId, latitude, longitude, timestamp }`
- `customer:tracking` - Subscription status

### Driver listens
- `driver:status` - `{ status }`
- `driver:location:ack` - Location update acknowledgement

## Environment Variables

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="mysql://username:password@localhost:3306/kilatgo_db"
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=admin@kilatgo.com
ADMIN_PASSWORD=admin123
PAYMENT_GATEWAY=mock
NOTIFICATION_PROVIDER=mock
```

## License

MIT
