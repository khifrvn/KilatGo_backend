import { PrismaClient, UserRole, UserStatus, DriverStatus, OrderStatus, PaymentStatus, PaymentMethod } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'password123';

const customersData = [
  { name: 'Budi Santoso', email: 'budi@email.com', phone: '081234567890' },
  { name: 'Dewi Lestari', email: 'dewi@email.com', phone: '081234567891' },
  { name: 'Agus Wijaya', email: 'agus@email.com', phone: '081234567892' },
  { name: 'Siti Rahayu', email: 'siti@email.com', phone: '081234567893' },
  { name: 'Andi Kurniawan', email: 'andi@email.com', phone: '081234567894' },
  { name: 'Rina Susanti', email: 'rina@email.com', phone: '081234567895' },
  { name: 'Hendra Gunawan', email: 'hendra@email.com', phone: '081234567896' },
  { name: 'Maya Fitriani', email: 'maya@email.com', phone: '081234567897' },
  { name: 'Eko Prasetyo', email: 'eko@email.com', phone: '081234567898' },
  { name: 'Nia Ramadhani', email: 'nia@email.com', phone: '081234567899' },
  { name: 'Fajar Nugraha', email: 'fajar@email.com', phone: '081234567800' },
  { name: 'Lina Kusuma', email: 'lina@email.com', phone: '081234567801' },
];

const approvedDriversData = [
  { name: 'Joko Widodo', email: 'joko.driver@email.com', phone: '081345678901', vehicleType: 'Honda Beat', vehiclePlate: 'B 1234 ABC', licenseNumber: 'SIM C 1234567890' },
  { name: 'Ahmad Yani', email: 'ahmad.driver@email.com', phone: '081345678902', vehicleType: 'Yamaha NMax', vehiclePlate: 'B 5678 DEF', licenseNumber: 'SIM C 0987654321' },
  { name: 'Slamet Riyadi', email: 'slamet.driver@email.com', phone: '081345678903', vehicleType: 'Honda Vario', vehiclePlate: 'B 9012 GHI', licenseNumber: 'SIM C 1122334455' },
  { name: 'Diponegoro', email: 'dipo.driver@email.com', phone: '081345678904', vehicleType: 'Yamaha Aerox', vehiclePlate: 'B 3456 JKL', licenseNumber: 'SIM C 5566778899' },
  { name: 'Kartini Sari', email: 'kartini.driver@email.com', phone: '081345678905', vehicleType: 'Honda Scoopy', vehiclePlate: 'B 7890 MNO', licenseNumber: 'SIM C 2233445566' },
  { name: 'Sudirman', email: 'sudirman.driver@email.com', phone: '081345678906', vehicleType: 'Honda PCX', vehiclePlate: 'B 1357 PQR', licenseNumber: 'SIM C 6677889900' },
  { name: 'Hatta Rajasa', email: 'hatta.driver@email.com', phone: '081345678907', vehicleType: 'Yamaha Lexi', vehiclePlate: 'B 2468 STU', licenseNumber: 'SIM C 3344556677' },
  { name: 'Cut Nyak', email: 'cut.driver@email.com', phone: '081345678908', vehicleType: 'Honda Genio', vehiclePlate: 'B 9753 VWX', licenseNumber: 'SIM C 8899001122' },
];

const pendingDriversData = [
  { name: 'Pattimura', email: 'pattimura.driver@email.com', phone: '081456789012', vehicleType: 'Suzuki Address', vehiclePlate: 'B 1111 AAA', licenseNumber: 'SIM C 1212121212' },
  { name: 'Sisingamangaraja', email: 'sisinga.driver@email.com', phone: '081456789013', vehicleType: 'Honda Beat Deluxe', vehiclePlate: 'B 2222 BBB', licenseNumber: 'SIM C 3434343434' },
  { name: 'Imbon Bonjol', email: 'imbon.driver@email.com', phone: '081456789014', vehicleType: 'Yamaha Mio', vehiclePlate: 'B 3333 CCC', licenseNumber: 'SIM C 5656565656' },
];

const addresses = [
  { address: 'Jl. Sudirman No. 123, Jakarta Pusat', lat: -6.2088, lng: 106.8456 },
  { address: 'Jl. Thamrin No. 45, Jakarta Pusat', lat: -6.1944, lng: 106.8229 },
  { address: 'Jl. Gatot Subroto No. 88, Jakarta Selatan', lat: -6.2297, lng: 106.8165 },
  { address: 'Jl. Rasuna Said No. 10, Jakarta Selatan', lat: -6.2186, lng: 106.8325 },
  { address: 'Jl. Mangga Dua Raya No. 77, Jakarta Utara', lat: -6.1383, lng: 106.8237 },
  { address: 'Jl. MT Haryono No. 15, Jakarta Selatan', lat: -6.2442, lng: 106.8434 },
  { address: 'Jl. Asia Afrika No. 8, Jakarta Pusat', lat: -6.2146, lng: 106.8451 },
  { address: 'Jl. Palmerah Selatan No. 33, Jakarta Barat', lat: -6.2087, lng: 106.7979 },
  { address: 'Jl. Cideng Timur No. 21, Jakarta Pusat', lat: -6.1767, lng: 106.8098 },
  { address: 'Jl. Kramat Raya No. 67, Jakarta Pusat', lat: -6.1865, lng: 106.8431 },
  { address: 'Jl. Panglima Polim No. 99, Jakarta Selatan', lat: -6.2548, lng: 106.8007 },
  { address: 'Jl. Tebet Raya No. 12, Jakarta Selatan', lat: -6.2263, lng: 106.8573 },
];

function randomDate(daysAgo: number, daysForward: number = 0): Date {
  const now = new Date();
  const min = now.getTime() - daysAgo * 24 * 60 * 60 * 1000;
  const max = now.getTime() + daysForward * 24 * 60 * 60 * 1000;
  return new Date(min + Math.random() * (max - min));
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateFare(distanceKm: number): number {
  const baseFare = 5000;
  const perKmRate = 2500;
  return Math.round(baseFare + distanceKm * perKmRate);
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@kilatgo.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  // Clean existing dummy data (keep admin)
  console.log('Cleaning existing dummy data...');
  await prisma.notification.deleteMany({});
  await prisma.tracking.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.driver.deleteMany({});
  await prisma.admin.deleteMany({ where: { user: { email: { not: adminEmail } } } });
  await prisma.user.deleteMany({ where: { email: { not: adminEmail } } });

  // Create or update admin
  let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!adminUser) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        phone: '+6280000000000',
        name: 'System Admin',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.admin.create({ data: { userId: adminUser.id } });
    console.log(`Admin user created: ${adminUser.email}`);
  } else {
    console.log(`Admin user already exists: ${adminUser.email}`);
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // Create customers
  console.log('Creating customers...');
  const customers = await Promise.all(
    customersData.map((customer, index) =>
      prisma.user.create({
        data: {
          email: customer.email,
          password: hashedPassword,
          phone: customer.phone,
          name: customer.name,
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
          customer: {
            create: {
              rating: Number((3.5 + Math.random() * 1.5).toFixed(1)),
              totalRides: Math.floor(Math.random() * 50),
            },
          },
        },
        include: { customer: true },
      })
    )
  );

  // Create approved drivers
  console.log('Creating approved drivers...');
  const approvedDrivers = await Promise.all(
    approvedDriversData.map((driver, index) =>
      prisma.user.create({
        data: {
          email: driver.email,
          password: hashedPassword,
          phone: driver.phone,
          name: driver.name,
          role: UserRole.DRIVER,
          status: UserStatus.ACTIVE,
          driver: {
            create: {
              vehicleType: driver.vehicleType,
              vehiclePlate: driver.vehiclePlate,
              licenseNumber: driver.licenseNumber,
              status: index < 4 ? DriverStatus.ONLINE : DriverStatus.OFFLINE,
              latitude: -6.2088 + (Math.random() - 0.5) * 0.1,
              longitude: 106.8456 + (Math.random() - 0.5) * 0.1,
              lastLocationAt: new Date(),
              rating: Number((3.8 + Math.random() * 1.7).toFixed(1)),
              totalRides: Math.floor(Math.random() * 200),
              isApproved: true,
            },
          },
        },
        include: { driver: true },
      })
    )
  );

  // Create pending drivers
  console.log('Creating pending drivers...');
  await Promise.all(
    pendingDriversData.map((driver) =>
      prisma.user.create({
        data: {
          email: driver.email,
          password: hashedPassword,
          phone: driver.phone,
          name: driver.name,
          role: UserRole.DRIVER,
          status: UserStatus.PENDING,
          driver: {
            create: {
              vehicleType: driver.vehicleType,
              vehiclePlate: driver.vehiclePlate,
              licenseNumber: driver.licenseNumber,
              status: DriverStatus.OFFLINE,
              rating: 5.0,
              totalRides: 0,
              isApproved: false,
            },
          },
        },
        include: { driver: true },
      })
    )
  );

  // Create orders
  console.log('Creating orders...');
  const orderStatuses = [
    OrderStatus.PENDING,
    OrderStatus.ACCEPTED,
    OrderStatus.DRIVER_ARRIVED,
    OrderStatus.ON_RIDE,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ];

  const orderStatusWeights = [0.1, 0.1, 0.05, 0.1, 0.55, 0.1]; // 55% completed, 10% cancelled, etc.
  const paymentMethods = [PaymentMethod.CASH, PaymentMethod.EWALLET, PaymentMethod.BANK_TRANSFER, PaymentMethod.CARD];

  function weightedStatus(): OrderStatus {
    const rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < orderStatuses.length; i++) {
      cumulative += orderStatusWeights[i];
      if (rand < cumulative) return orderStatuses[i];
    }
    return OrderStatus.COMPLETED;
  }

  const orders = [];
  for (let i = 0; i < 50; i++) {
    const customer = randomElement(customers);
    const pickup = randomElement(addresses);
    let dropoff = randomElement(addresses);
    while (dropoff.address === pickup.address) {
      dropoff = randomElement(addresses);
    }

    const distanceKm = calculateDistance(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
    const fare = calculateFare(distanceKm);
    const status = weightedStatus();
    const createdAt = randomDate(60);
    const paymentMethod = randomElement(paymentMethods);

    const orderData: any = {
      customerId: customer.customer!.id,
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      pickupAddress: pickup.address,
      dropoffLat: dropoff.lat,
      dropoffLng: dropoff.lng,
      dropoffAddress: dropoff.address,
      status,
      distanceKm: Number(distanceKm.toFixed(2)),
      baseFare: fare,
      totalFare: fare,
      paymentMethod,
      notes: Math.random() > 0.7 ? 'Please hurry, important meeting' : null,
      createdAt,
      updatedAt: createdAt,
    };

    if (status !== OrderStatus.PENDING && status !== OrderStatus.CANCELLED) {
      const driver = randomElement(approvedDrivers);
      orderData.driverId = driver.driver!.id;
    }

    if (status === OrderStatus.COMPLETED) {
      orderData.completedAt = new Date(createdAt.getTime() + 15 + Math.random() * 45 * 60 * 1000);
      orderData.updatedAt = orderData.completedAt;
    } else if (status === OrderStatus.CANCELLED) {
      orderData.cancelledAt = new Date(createdAt.getTime() + 5 + Math.random() * 20 * 60 * 1000);
      orderData.cancellationReason = Math.random() > 0.5 ? 'Customer cancelled' : 'Driver not available';
      orderData.updatedAt = orderData.cancelledAt;
    } else {
      orderData.updatedAt = new Date(createdAt.getTime() + Math.random() * 10 * 60 * 1000);
    }

    const order = await prisma.order.create({ data: orderData });
    orders.push(order);

    // Create payment for completed orders
    if (status === OrderStatus.COMPLETED) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: fare,
          method: paymentMethod,
          status: paymentMethod === PaymentMethod.CASH ? PaymentStatus.PENDING : PaymentStatus.PAID,
          transactionId: paymentMethod === PaymentMethod.CASH ? null : `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          paidAt: paymentMethod === PaymentMethod.CASH ? null : orderData.completedAt,
          createdAt: orderData.completedAt,
          updatedAt: orderData.completedAt,
        },
      });
    }

    // Create tracking logs for orders with drivers
    if (orderData.driverId) {
      const driverRecord = approvedDrivers.find((d) => d.driver!.id === orderData.driverId);
      const numTrackingPoints = status === OrderStatus.COMPLETED ? 8 : Math.floor(Math.random() * 4) + 2;

      for (let t = 0; t < numTrackingPoints; t++) {
        const progress = t / (numTrackingPoints - 1);
        const lat = pickup.lat + (dropoff.lat - pickup.lat) * progress + (Math.random() - 0.5) * 0.002;
        const lng = pickup.lng + (dropoff.lng - pickup.lng) * progress + (Math.random() - 0.5) * 0.002;

        await prisma.tracking.create({
          data: {
            orderId: order.id,
            driverId: orderData.driverId,
            latitude: Number(lat.toFixed(6)),
            longitude: Number(lng.toFixed(6)),
            createdAt: new Date(createdAt.getTime() + t * 5 * 60 * 1000),
          },
        });
      }

      // Update driver location to last tracking point
      await prisma.driver.update({
        where: { id: orderData.driverId },
        data: {
          latitude: pickup.lat + (dropoff.lat - pickup.lat) * 0.9,
          longitude: pickup.lng + (dropoff.lng - pickup.lng) * 0.9,
          lastLocationAt: new Date(),
        },
      });
    }
  }

  // Create notifications
  console.log('Creating notifications...');
  const notificationTypes = ['ORDER_CREATED', 'DRIVER_ASSIGNED', 'ORDER_COMPLETED', 'PAYMENT_RECEIVED'];
  for (let i = 0; i < 30; i++) {
    const user = randomElement(customers);
    const type = randomElement(notificationTypes);
    const titles: Record<string, string> = {
      ORDER_CREATED: 'Pesanan Berhasil Dibuat',
      DRIVER_ASSIGNED: 'Driver Ditemukan',
      ORDER_COMPLETED: 'Perjalanan Selesai',
      PAYMENT_RECEIVED: 'Pembayaran Diterima',
    };
    const bodies: Record<string, string> = {
      ORDER_CREATED: 'Pesanan Anda sedang menunggu driver.',
      DRIVER_ASSIGNED: 'Driver telah ditugaskan untuk menjemput Anda.',
      ORDER_COMPLETED: 'Terima kasih telah menggunakan KilatGo.',
      PAYMENT_RECEIVED: 'Pembayaran untuk perjalanan Anda telah diterima.',
    };

    await prisma.notification.create({
      data: {
        userId: user.id,
        title: titles[type],
        body: bodies[type],
        type,
        isRead: Math.random() > 0.5,
        createdAt: randomDate(30),
      },
    });
  }

  console.log('\n✅ Dummy data created successfully!');
  console.log(`👥 Customers: ${customers.length}`);
  console.log(`🛵 Approved drivers: ${approvedDrivers.length}`);
  console.log(`⏳ Pending drivers: ${pendingDriversData.length}`);
  console.log(`📦 Orders: ${orders.length}`);
  console.log(`🔔 Notifications: 30`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
