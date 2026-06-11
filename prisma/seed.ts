import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'doncielkabwe@gmail.com';
const ADMIN_PASSWORD = 'Donciel3.';
const ADMIN_NAME = 'Donciel';

async function main() {
  console.log('🌱 Seeding database...');

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existingAdmin) {
    // Update the admin password and ensure role/status are correct
    const hashedPassword = await hash(ADMIN_PASSWORD, 12);
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        password: hashedPassword,
        role: 'admin',
        status: 'approved',
        name: ADMIN_NAME,
      },
    });
    console.log(`✅ Admin user updated: ${ADMIN_EMAIL}`);
  } else {
    // Create admin user
    const hashedPassword = await hash(ADMIN_PASSWORD, 12);
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        password: hashedPassword,
        name: ADMIN_NAME,
        role: 'admin',
        status: 'approved',
      },
    });
    console.log(`✅ Admin user created: ${ADMIN_EMAIL}`);
  }

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
